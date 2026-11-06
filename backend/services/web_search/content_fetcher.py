"""Minimal page content fetcher — BRIDGE module.

This is a temporary bridge so the chat pipeline works end to end before
Task 3 (Web Extraction & Source Processing) is built. It does a plain
HTTP GET and pulls visible text out of the HTML with BeautifulSoup.

When Task 3 is ready it should provide a stronger extractor — e.g.
trafilatura, readability, or a custom boilerplate remover — and the
pipeline (pipeline.py) should call THAT instead of fetch_page_content().
The contract is just: url -> cleaned text string (or "" on failure).

Design notes:
  - We strip <script>, <style>, <nav>, <footer>, <header>, <aside>,
    <form>, <noscript> before extracting text. That removes most
    boilerplate without needing a full readability model.
  - We cap the returned text at MAX_CHARS so one giant page can't blow
    up the LLM context window (the LLM context_builder also caps, this
    is just defense in depth).
  - We never raise: a failed fetch returns "" so the caller can fall
    back to the search snippet.
"""

from __future__ import annotations

import requests
from bs4 import BeautifulSoup

from search_providers import _USER_AGENT  # reuse the same browser UA

_TIMEOUT = 12
MAX_CHARS = 8000

# Tags whose text is almost never part of the article body.
_STRIP_TAGS = (
    "script", "style", "noscript", "nav", "footer", "header",
    "aside", "form", "button", "svg", "iframe",
)


def fetch_page_content(url: str, timeout: int = _TIMEOUT) -> str:
    """Fetch a URL and return its visible text, or "" on any failure.

    Args:
        url:    The page to fetch.
        timeout: Per-request timeout in seconds.

    Returns:
        Cleaned text up to MAX_CHARS characters. Empty string if the
        request fails, the page is not HTML, or there is no readable text.
    """
    if not url:
        return ""

    headers = {
        "User-Agent": _USER_AGENT,
        "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
    }

    try:
        resp = requests.get(url, headers=headers, timeout=timeout, allow_redirects=True)
        resp.raise_for_status()
    except requests.RequestException:
        return ""

    content_type = resp.headers.get("Content-Type", "")
    if "html" not in content_type and "text" not in content_type:
        # PDFs, images, binary — leave to Task 3's specialist extractors.
        return ""

    soup = BeautifulSoup(resp.text, "html.parser")

    # Remove obviously-non-content tags entirely.
    for tag in soup(list(_STRIP_TAGS)):
        tag.decompose()

    # Prefer <article> or <main> if present, else fall back to whole body.
    container = soup.find("article") or soup.find("main") or soup.body or soup

    text = container.get_text(" ", strip=True)
    # Collapse runs of whitespace.
    import re
    text = re.sub(r"\s+", " ", text).strip()

    if len(text) > MAX_CHARS:
        text = text[:MAX_CHARS]
    return text
