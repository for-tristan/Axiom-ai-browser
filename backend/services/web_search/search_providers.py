"""Web search providers.

A provider turns a query string into a list of SearchResult objects.

Two providers ship here:

  - DuckDuckGoProvider (default): scrapes DuckDuckGo's HTML endpoint.
    No API key, no signup, works out of the box. Good enough for the MVP.
  - BraveSearchProvider: uses the Brave Search API. Higher quality and
    rate-limited cleanly, but needs BRAVE_API_KEY in the environment.

get_provider() picks one automatically: Brave if a key is present,
otherwise DuckDuckGo. Callers can also pass an explicit provider to
search_for_pages() in the pipeline.

Why scrape instead of using a library? The popular `duckduckgo-search`
package breaks every few months when DDG changes their backend. Parsing
the stable HTML endpoint with requests + BeautifulSoup is more durable
and adds no third-party dependency beyond what the project already uses.
"""

from __future__ import annotations

import os
from abc import ABC, abstractmethod
from typing import Optional

import requests
from bs4 import BeautifulSoup

from result import SearchResult

# A real-looking browser User-Agent. DuckDuckGo blocks requests with the
# default python-requests UA, so we pretend to be a normal browser.
_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
)
_HEADERS = {
    "User-Agent": _USER_AGENT,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}


class SearchProviderError(Exception):
    """Raised when a provider cannot return results after all retries."""


class SearchProvider(ABC):
    """Interface every search backend implements."""

    name: str = "base"

    @abstractmethod
    def search(self, query: str, max_results: int = 5) -> list[SearchResult]:
        """Run a search and return up to max_results hits."""
        raise NotImplementedError


# ── DuckDuckGo (HTML scraping, no key) ──────────────────────────────────
class DuckDuckGoProvider(SearchProvider):
    """Search via DuckDuckGo's HTML endpoint.

    Pros: no API key, no signup, no rate-limit hassle for MVP usage.
    Cons: result quality is lower than Brave/Google, and HTML structure
          could change (we parse defensively to handle that gracefully).
    """

    name = "duckduckgo"
    _ENDPOINT = "https://html.duckduckgo.com/html/"
    _TIMEOUT = 15

    def search(self, query: str, max_results: int = 5) -> list[SearchResult]:
        if not query or not query.strip():
            return []

        params = {"q": query, "kl": "us-en"}
        last_error: Optional[Exception] = None

        # DDG occasionally returns an empty page on the first hit; one
        # retry is usually enough. We cap at 2 attempts to stay fast.
        for _attempt in range(2):
            try:
                resp = requests.get(
                    self._ENDPOINT,
                    params=params,
                    headers=_HEADERS,
                    timeout=self._TIMEOUT,
                )
                resp.raise_for_status()
                results = self._parse(resp.text, max_results)
                if results:
                    return results
                # Empty page — retry once.
            except requests.RequestException as exc:
                last_error = exc

        if last_error:
            raise SearchProviderError(
                f"DuckDuckGo search failed: {last_error}"
            ) from last_error
        # No error but no results either — return what we have.
        return []

    @staticmethod
    def _parse(html: str, max_results: int) -> list[SearchResult]:
        """Pull result blocks out of the DDG HTML page.

        Each result lives in a <div class="result ..."> with:
          - <a class="result__a" href="...">title</a>
          - <a class="result__snippet" ...>snippet</a>  (sometimes <td class="result__snippet">)
        The href goes through DDG's redirect (//duckduckgo.com/l/?uddg=ENCODED),
        so we unwrap it to get the real destination URL.
        """
        soup = BeautifulSoup(html, "html.parser")
        results: list[SearchResult] = []

        for block in soup.select("div.result"):
            if len(results) >= max_results:
                break

            link = block.select_one("a.result__a")
            if not link:
                continue
            href = link.get("href", "")
            url = DuckDuckGoProvider._unwrap_ddg_url(href)
            title = link.get_text(strip=True)
            if not url or not title:
                continue

            snippet_node = block.select_one(".result__snippet")
            snippet = snippet_node.get_text(" ", strip=True) if snippet_node else ""

            results.append(
                SearchResult(
                    title=title,
                    url=url,
                    snippet=snippet,
                    source="duckduckgo",
                    rank=len(results) + 1,
                )
            )
        return results

    @staticmethod
    def _unwrap_ddg_url(href: str) -> str:
        """DuckDuckGo wraps result URLs in a redirect. Extract the real URL.

        Example href:
          //duckduckgo.com/l/?uddg=https%3A%2F%2Fen.wikipedia.org%2Fwiki%2FEgypt&rut=...
        We pull the `uddg` query param and decode it. If the href is already
        a direct URL (DDG sometimes does this), we return it as-is.
        """
        if not href:
            return ""
        # Make it absolute for parsing if it's protocol-relative.
        if href.startswith("//"):
            href = "https:" + href
        from urllib.parse import urlparse, parse_qs, unquote

        parsed = urlparse(href)
        if "duckduckgo.com" in (parsed.netloc or "") and parsed.query:
            qs = parse_qs(parsed.query)
            if "uddg" in qs:
                return unquote(qs["uddg"][0])
        # Already a direct URL.
        return href


# ── Brave Search API (needs BRAVE_API_KEY) ──────────────────────────────
class BraveSearchProvider(SearchProvider):
    """Search via the Brave Search API.

    Sign up at https://api.search.brave.com/ and set BRAVE_API_KEY in
    your .env. Higher quality results and a clean rate limit; use this
    in production instead of scraping DuckDuckGo.
    """

    name = "brave"
    _ENDPOINT = "https://api.search.brave.com/res/v1/web/search"
    _TIMEOUT = 15

    def __init__(self, api_key: str | None = None):
        self.api_key = api_key or os.getenv("BRAVE_API_KEY")

    def search(self, query: str, max_results: int = 5) -> list[SearchResult]:
        if not query or not query.strip():
            return []
        if not self.api_key:
            raise SearchProviderError(
                "BraveSearchProvider requires BRAVE_API_KEY in the environment."
            )

        headers = {
            "Accept": "application/json",
            "Accept-Encoding": "gzip",
            "X-Subscription-Token": self.api_key,
        }
        params = {
            "q": query,
            "count": max_results,
            "country": "us",
            "search_lang": "en",
        }

        try:
            resp = requests.get(
                self._ENDPOINT, params=params, headers=headers, timeout=self._TIMEOUT
            )
            resp.raise_for_status()
        except requests.RequestException as exc:
            raise SearchProviderError(f"Brave search failed: {exc}") from exc

        data = resp.json()
        results: list[SearchResult] = []
        for i, item in enumerate(data.get("web", {}).get("results", []) or []):
            results.append(
                SearchResult(
                    title=item.get("title", ""),
                    url=item.get("url", ""),
                    snippet=item.get("description", ""),
                    source="brave",
                    rank=i + 1,
                )
            )
            if len(results) >= max_results:
                break
        return results


# ── Factory ─────────────────────────────────────────────────────────────
def get_provider(name: str | None = None) -> SearchProvider:
    """Pick a search provider.

    - name="brave"       → BraveSearchProvider (needs BRAVE_API_KEY)
    - name="duckduckgo"  → DuckDuckGoProvider
    - name=None          → auto: Brave if BRAVE_API_KEY is set, else DuckDuckGo
    """
    if name is None:
        name = "brave" if os.getenv("BRAVE_API_KEY") else "duckduckgo"

    if name == "brave":
        return BraveSearchProvider()
    if name == "duckduckgo":
        return DuckDuckGoProvider()
    raise ValueError(f"Unknown search provider: {name!r}")
