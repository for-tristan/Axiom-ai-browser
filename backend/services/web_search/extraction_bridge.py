"""Extraction bridge — wires Task 2 (search) to Task 3 (web extraction).

This module replaces the old content_fetcher.py bridge. Instead of doing
a naive BeautifulSoup text dump, it delegates to Task 3's professional
extraction pipeline (Trafilatura + BS4 fallback + cleaning) so the chat
gets clean article text instead of boilerplate-heavy page dumps.

The contract is intentionally identical to the old bridge so the
pipeline (pipeline.py) can swap imports with no other changes:

    from extraction_bridge import fetch_page_content
    content = fetch_page_content(url)  # -> str (clean article text or "")

Task 3's fetcher and extractor are async, but the pipeline is sync, so
we run the async fetch in a new event loop via asyncio.run(). This is
fine because fetch_page_content is called a few times per search, not in
a hot loop.
"""

from __future__ import annotations

import asyncio
import logging
import os
import sys

# Make Task 3's `app` package importable. Task 3 lives at
# backend/services/web_extraction/app/ — we add its parent to sys.path
# so `from app.services.fetcher import ...` resolves.
_TASK3_ROOT = os.path.join(os.path.dirname(__file__), "..", "web_extraction")
if _TASK3_ROOT not in sys.path:
    sys.path.insert(0, _TASK3_ROOT)

try:
    from app.services.fetcher import fetch_urls, FetchResult  # type: ignore
    from app.services.extractor import extract_content  # type: ignore
    from app.services.cleaner import clean_text  # type: ignore
    from app.utils.url_security import SecurityError, validate_url  # type: ignore
    _TASK3_AVAILABLE = True
except ImportError as exc:
    logging.getLogger(__name__).warning(
        "Task 3 web_extraction not available (%s); falling back to empty content.", exc
    )
    _TASK3_AVAILABLE = False

logger = logging.getLogger(__name__)

# Cap the returned text so one giant page can't blow up the LLM context
# window. The LLM context_builder also caps — this is defense in depth.
MAX_CHARS = 8000


def fetch_page_content(url: str, timeout: int = 15) -> str:
    """Fetch a URL and return clean article text, or "" on any failure.

    This is the drop-in replacement for the old content_fetcher bridge.
    It uses Task 3's async fetcher + Trafilatura extractor under the hood.

    Args:
        url:     The page to fetch.
        timeout: Per-request timeout in seconds (passed to Task 3's fetcher
                 via its config; the argument is kept for API compat).

    Returns:
        Cleaned article text up to MAX_CHARS characters. Empty string if
        the request fails, the page is not HTML, or extraction yields
        nothing. Never raises.
    """
    if not url or not _TASK3_AVAILABLE:
        return ""

    # SSRF pre-check — don't even fetch if the URL is unsafe.
    try:
        validate_url(url)
    except SecurityError:
        logger.debug("URL blocked by security check: %s", url)
        return ""
    except Exception:
        # If validation itself fails unexpectedly, treat as no content.
        return ""

    try:
        # Task 3's fetcher is async; run it in a fresh event loop.
        results = asyncio.run(fetch_urls([url]))
    except Exception as exc:
        logger.debug("Fetch failed for %s: %s", url, exc)
        return ""

    if not results or not results[0].success:
        return ""

    fetch_result: FetchResult = results[0]

    # Extract main content (Trafilatura → BS4 fallback).
    extraction = extract_content(fetch_result)

    text = extraction.text or ""
    if text:
        text = clean_text(text)

    if len(text) > MAX_CHARS:
        text = text[:MAX_CHARS]

    return text


def fetch_page_title(url: str) -> str:
    """Fetch a URL and return just the page title, or "" on failure.

    Used by the pipeline when the user pastes a bare URL and we want a
    nice display title instead of showing the raw URL.
    """
    if not url or not _TASK3_AVAILABLE:
        return ""

    try:
        validate_url(url)
    except Exception:
        return ""

    try:
        results = asyncio.run(fetch_urls([url]))
    except Exception:
        return ""

    if not results or not results[0].success:
        return ""

    extraction = extract_content(results[0])
    return extraction.title or ""
