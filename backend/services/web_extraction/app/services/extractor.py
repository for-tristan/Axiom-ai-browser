"""
Main content extraction service.

Strategy
--------
1. Try Trafilatura first — it is the best open-source boilerplate remover.
2. Fall back to a custom BeautifulSoup heuristic extractor if Trafilatura
   returns empty or None.
3. Record which method was used so callers can inspect extraction quality.

We deliberately avoid calling any external LLM or service here: the
extraction pipeline must work fully offline.

What we extract
---------------
* Main article text (cleaned)
* Page title
* Description / meta description
* Author name
* Publication date
* Language
* Canonical URL
* Content type (from HTTP headers)

What we strip
-------------
* <script>, <style>, <noscript>
* <nav>, <header>, <footer>, <aside>
* Advertisements, popups, cookie banners, sidebars
* Social sharing widgets, tracking pixels
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from typing import Optional
from urllib.parse import urlparse

from bs4 import BeautifulSoup

from app.models.schemas import ExtractionMethod, ExtractionStatus
from app.services.fetcher import FetchResult

logger = logging.getLogger(__name__)

# Tags that never contain article body text
_BOILERPLATE_TAGS = [
    "script", "style", "noscript", "nav", "header", "footer",
    "aside", "form", "button", "svg", "iframe", "canvas",
    "figure",   # keep figcaption but drop the img-only figure? we keep both
]

# CSS class / id patterns that strongly suggest non-content
_BOILERPLATE_ATTRS = re.compile(
    r"\b(nav|navigation|menu|sidebar|widget|advertisement|ad-|cookie|"
    r"banner|footer|header|popup|modal|overlay|newsletter|subscribe|"
    r"social|share|comment|related|recommendation|trending|promo|"
    r"breadcrumb|pagination|toc|table-of-contents)\b",
    re.IGNORECASE,
)


# ── Result dataclass ──────────────────────────────────────────────────────────

@dataclass
class ExtractionResult:
    text: str                           = ""
    title: Optional[str]               = None
    description: Optional[str]         = None
    author: Optional[str]              = None
    published_date: Optional[str]      = None
    language: Optional[str]            = None
    canonical_url: Optional[str]       = None
    method: ExtractionMethod           = ExtractionMethod.NONE
    status: ExtractionStatus           = ExtractionStatus.FAILED
    word_count: int                    = 0
    headings: list[str]                = field(default_factory=list)


# ── Trafilatura extraction ────────────────────────────────────────────────────

def _extract_with_trafilatura(html: str, url: str) -> Optional[str]:
    """
    Use Trafilatura to extract main article text.
    Returns None if Trafilatura cannot extract anything meaningful.
    """
    try:
        import trafilatura  # optional but strongly recommended
        result = trafilatura.extract(
            html,
            url=url,
            include_comments=False,
            include_tables=True,
            include_links=False,
            favor_recall=True,       # prefer completeness over precision
            deduplicate=True,
        )
        return result
    except ImportError:
        logger.warning("Trafilatura not installed; falling back to BeautifulSoup.")
        return None
    except Exception as exc:
        logger.warning("Trafilatura failed (%s); falling back to BeautifulSoup.", exc)
        return None


# ── BeautifulSoup fallback ────────────────────────────────────────────────────

def _is_boilerplate_element(tag) -> bool:
    """Return True if a BS4 element looks like navigation / sidebar / ads."""
    for attr in ("class", "id"):
        values = tag.get(attr, [])
        if isinstance(values, str):
            values = [values]
        for v in values:
            if _BOILERPLATE_ATTRS.search(v):
                return True
    return False


def _extract_with_bs4(html: str) -> str:
    """
    Heuristic BeautifulSoup extraction.

    1. Remove all boilerplate tags.
    2. Remove elements whose class/id look like navigation or ads.
    3. Prefer <article> > <main> > <body> as the content container.
    4. Extract .get_text() with a space separator.
    """
    soup = BeautifulSoup(html, "lxml")

    # Remove known boilerplate tags
    for tag_name in _BOILERPLATE_TAGS:
        for tag in soup.find_all(tag_name):
            tag.decompose()

    # Remove elements that look like navigation/ads based on class/id
    for tag in soup.find_all(True):
        if _is_boilerplate_element(tag):
            tag.decompose()

    # Find the best content container
    container = (
        soup.find("article")
        or soup.find("main")
        or soup.find(attrs={"role": "main"})
        or soup.find("div", class_=re.compile(r"\bcontent\b", re.IGNORECASE))
        or soup.body
        or soup
    )

    text = container.get_text(separator="\n", strip=True) if container else ""
    # Collapse excessive blank lines
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


# ── Metadata extraction (BeautifulSoup) ──────────────────────────────────────

def _extract_metadata(soup: BeautifulSoup, base_url: str) -> dict:
    """Extract meta-level information from the parsed HTML."""
    meta: dict = {}

    # Title
    title_tag = soup.find("title")
    og_title  = soup.find("meta", property="og:title")
    meta["title"] = (
        (og_title.get("content") if og_title else None)
        or (title_tag.get_text(strip=True) if title_tag else None)
    )

    # Description
    desc_tag = (
        soup.find("meta", attrs={"name": "description"})
        or soup.find("meta", property="og:description")
        or soup.find("meta", attrs={"name": "twitter:description"})
    )
    meta["description"] = desc_tag.get("content") if desc_tag else None

    # Author
    author_tag = (
        soup.find("meta", attrs={"name": "author"})
        or soup.find("meta", property="article:author")
        or soup.find(class_=re.compile(r"\bauthor\b", re.IGNORECASE))
    )
    if author_tag:
        if author_tag.name == "meta":
            meta["author"] = author_tag.get("content")
        else:
            meta["author"] = author_tag.get_text(strip=True)
    else:
        meta["author"] = None

    # Publication date
    date_tag = (
        soup.find("meta", property="article:published_time")
        or soup.find("meta", attrs={"name": "pubdate"})
        or soup.find("meta", attrs={"name": "date"})
        or soup.find("time", attrs={"datetime": True})
    )
    if date_tag:
        meta["published_date"] = (
            date_tag.get("content") or date_tag.get("datetime") or date_tag.get_text(strip=True)
        )
    else:
        meta["published_date"] = None

    # Language
    html_tag = soup.find("html")
    meta["language"] = html_tag.get("lang") if html_tag else None

    # Canonical URL
    canonical_tag = soup.find("link", rel="canonical")
    meta["canonical_url"] = canonical_tag.get("href") if canonical_tag else None

    return meta


# ── Headings extraction ───────────────────────────────────────────────────────

def _extract_headings(soup: BeautifulSoup) -> list[str]:
    """Return all heading texts (h1-h3) in document order."""
    headings = []
    for tag in soup.find_all(["h1", "h2", "h3"]):
        text = tag.get_text(strip=True)
        if text:
            headings.append(text)
    return headings


# ── Public API ────────────────────────────────────────────────────────────────

def extract_content(fetch_result: FetchResult) -> ExtractionResult:
    """
    Extract article content and metadata from a FetchResult.

    Returns an ExtractionResult; never raises.  Failed extractions are
    indicated by ``status != SUCCESS`` and an empty / None ``text``.
    """
    result = ExtractionResult()

    if not fetch_result.success or not fetch_result.raw_html:
        result.status = ExtractionStatus.FAILED
        return result

    html = fetch_result.raw_html
    url  = fetch_result.final_url or fetch_result.original_url

    # Check content type — only process HTML
    ct = (fetch_result.content_type or "").lower()
    if ct and "html" not in ct and "text" not in ct:
        result.status = ExtractionStatus.UNSUPPORTED_TYPE
        return result

    # Parse once for metadata
    try:
        soup = BeautifulSoup(html, "lxml")
    except Exception as exc:
        logger.warning("BeautifulSoup parsing failed for %s: %s", url, exc)
        result.status = ExtractionStatus.FAILED
        return result

    # Extract metadata
    meta = _extract_metadata(soup, url)
    result.title          = meta.get("title")
    result.description    = meta.get("description")
    result.author         = meta.get("author")
    result.published_date = meta.get("published_date")
    result.language       = meta.get("language")
    result.canonical_url  = meta.get("canonical_url")
    result.headings       = _extract_headings(soup)

    # 1. Try Trafilatura
    traf_text = _extract_with_trafilatura(html, url)
    if traf_text and len(traf_text.strip()) > 100:
        result.text   = traf_text.strip()
        result.method = ExtractionMethod.TRAFILATURA
    else:
        # 2. Fall back to BeautifulSoup
        bs4_text = _extract_with_bs4(html)
        if bs4_text and len(bs4_text.strip()) > 50:
            result.text   = bs4_text.strip()
            result.method = ExtractionMethod.BEAUTIFULSOUP
        else:
            result.status = ExtractionStatus.EMPTY_CONTENT
            result.method = ExtractionMethod.NONE
            return result

    result.word_count = len(result.text.split())
    result.status = ExtractionStatus.SUCCESS

    # Partial if very little was extracted
    if result.word_count < 20:
        result.status = ExtractionStatus.PARTIAL

    return result
