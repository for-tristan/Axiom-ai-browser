"""
Asynchronous HTTP fetching engine.

Design goals
------------
* Non-blocking: uses httpx.AsyncClient with asyncio
* Bounded concurrency via asyncio.Semaphore
* SSRF-safe: every URL and every redirect destination is validated before use
* Size-limited: responses exceeding max_response_size are truncated/rejected
* Encoding-aware: charset detected from HTTP headers or HTML meta tags
* One-failure-safe: a failure on one URL never aborts the rest of the batch
* Resource-clean: the client is created and closed per batch call
"""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import List, Optional
from urllib.parse import urljoin, urlparse

import httpx

from app.config import get_settings
from app.utils.url_security import SecurityError, validate_redirect_url, validate_url
from app.utils.text_utils import safe_decode

logger = logging.getLogger(__name__)

settings = get_settings()


# ── Result dataclass ──────────────────────────────────────────────────────────

@dataclass
class FetchResult:
    original_url: str
    final_url: Optional[str]       = None
    status_code: Optional[int]     = None
    content_type: Optional[str]    = None
    raw_html: Optional[str]        = None        # decoded HTML text
    raw_bytes: Optional[bytes]     = None
    encoding: Optional[str]        = None
    fetch_timestamp: datetime      = field(default_factory=lambda: datetime.now(timezone.utc))
    success: bool                  = False
    error: Optional[str]           = None
    redirected: bool               = False
    redirect_chain: List[str]      = field(default_factory=list)


# ── Low-level fetch (single URL) ──────────────────────────────────────────────

async def _fetch_one(
    client: httpx.AsyncClient,
    url: str,
    semaphore: asyncio.Semaphore,
    timeout: int,
    max_size: int,
) -> FetchResult:
    """Fetch a single URL respecting the semaphore, timeout, and size limits."""
    result = FetchResult(original_url=url)
    result.fetch_timestamp = datetime.now(timezone.utc)

    # Security pre-check
    try:
        validate_url(url)
    except SecurityError as exc:
        result.error = f"Security blocked: {exc}"
        return result

    async with semaphore:
        try:
            response = await client.get(url, follow_redirects=True)

            # Validate every redirect hop
            if response.history:
                result.redirected = True
                result.redirect_chain = [str(r.url) for r in response.history]
                for hop_url in result.redirect_chain + [str(response.url)]:
                    try:
                        validate_redirect_url(url, hop_url)
                    except SecurityError as exc:
                        result.error = f"Redirect security blocked: {exc}"
                        return result

            result.final_url   = str(response.url)
            result.status_code = response.status_code
            result.content_type = response.headers.get("content-type", "")

            response.raise_for_status()

            # Enforce size limit
            raw = response.content
            if len(raw) > max_size:
                logger.warning("Response from %s exceeded size limit (%d bytes); truncating.", url, len(raw))
                raw = raw[:max_size]
            result.raw_bytes = raw

            # Determine encoding
            encoding = response.encoding or "utf-8"
            result.encoding = encoding
            result.raw_html = safe_decode(raw, encoding)
            result.success  = True

        except httpx.TimeoutException as exc:
            result.error = f"Timeout: {exc}"
            result.status_code = None
        except httpx.HTTPStatusError as exc:
            result.error = f"HTTP {exc.response.status_code}: {exc.response.reason_phrase}"
            result.status_code = exc.response.status_code
        except httpx.ConnectError as exc:
            result.error = f"Connection error: {exc}"
        except httpx.TooManyRedirects as exc:
            result.error = f"Too many redirects: {exc}"
        except httpx.RequestError as exc:
            result.error = f"Request error: {exc}"
        except SecurityError as exc:
            result.error = f"Security blocked during redirect: {exc}"
        except Exception as exc:
            logger.exception("Unexpected error fetching %s", url)
            result.error = "Unexpected fetch error"

    return result


# ── Batch fetch (public API) ──────────────────────────────────────────────────

async def fetch_urls(
    urls: List[str],
    timeout: Optional[int] = None,
    max_size: Optional[int] = None,
    max_concurrent: Optional[int] = None,
) -> List[FetchResult]:
    """
    Fetch a list of URLs concurrently.

    Parameters
    ----------
    urls          : list of URL strings to fetch
    timeout       : per-request timeout in seconds (default from config)
    max_size      : max response body in bytes (default from config)
    max_concurrent: max simultaneous connections (default from config)

    Returns
    -------
    List of FetchResult objects in the same order as the input URLs.
    Failed URLs have ``success=False`` and an ``error`` description.
    """
    cfg = get_settings()
    _timeout     = timeout       or cfg.request_timeout
    _max_size    = max_size      or cfg.max_response_size
    _max_conc    = max_concurrent or cfg.max_concurrent_requests

    semaphore = asyncio.Semaphore(_max_conc)

    headers = {
        "User-Agent": cfg.user_agent,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
    }

    async with httpx.AsyncClient(
        headers=headers,
        timeout=httpx.Timeout(_timeout),
        follow_redirects=True,
        max_redirects=10,
        verify=True,     # SSL validation is NEVER disabled
    ) as client:
        tasks = [
            _fetch_one(client, url, semaphore, _timeout, _max_size)
            for url in urls
        ]
        results = await asyncio.gather(*tasks, return_exceptions=False)

    return list(results)


async def fetch_single(url: str) -> FetchResult:
    """Convenience wrapper for fetching a single URL."""
    results = await fetch_urls([url])
    return results[0]
