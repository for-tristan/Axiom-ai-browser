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
# Wikipedia requires a descriptive UA per their API policy.
_WIKI_UA = (
    "AxiomBrowser/3.0 (https://github.com/for-tristan/Axiom-ai-browser; "
    "graduation-project)"
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


# ── DuckDuckGo (lite endpoint, no key) ─────────────────────────────────
class DuckDuckGoProvider(SearchProvider):
    """Search via DuckDuckGo's lite endpoint.

    The lite endpoint (POST to lite.duckduckgo.com/lite/) is much less
    aggressively rate-limited than the html endpoint. We try it first,
    then fall back to the html endpoint, then to Google scraping.

    Pros: no API key, no signup.
    Cons: result quality is lower than Brave; HTML structure could change
          (we parse defensively to handle that gracefully).
    """

    name = "duckduckgo"
    _LITE_ENDPOINT = "https://lite.duckduckgo.com/lite/"
    _HTML_ENDPOINT = "https://html.duckduckgo.com/html/"
    _TIMEOUT = 15

    def search(self, query: str, max_results: int = 5) -> list[SearchResult]:
        if not query or not query.strip():
            return []

        # Strategy 1: Wikipedia API — most reliable, returns JSON, not
        # region-blocked. Perfect for factual queries (which is what the
        # AI chat is for). No scraping, no anti-bot, no JS required.
        results = self._search_wikipedia(query, max_results)
        if results:
            return results

        # Strategy 2: DDG lite endpoint (POST).
        results = self._search_lite(query, max_results)
        if results:
            return results

        # Strategy 3: DDG html endpoint (GET).
        results = self._search_html(query, max_results)
        if results:
            return results

        # Strategy 4: Bing scraping — reliable from some networks.
        results = self._search_bing(query, max_results)
        if results:
            return results

        # Strategy 5: Google scraping — last resort.
        results = self._search_google(query, max_results)
        if results:
            return results

        # All strategies failed.
        raise SearchProviderError(
            "Search failed: all providers (Wikipedia, DDG lite, DDG html, "
            "Bing, Google) returned no results. Your network may be blocking "
            "search engines. Try setting BRAVE_API_KEY in your .env for a "
            "more reliable search provider."
        )

    def _search_wikipedia(self, query: str, max_results: int) -> list[SearchResult]:
        """Search via the Wikipedia API (JSON). Returns [] on failure.

        Wikipedia's API is the most reliable search source:
        - Returns clean JSON (no HTML scraping)
        - Not region-blocked or anti-bot'd
        - Free, no API key
        - Perfect for factual queries
        """
        try:
            resp = requests.get(
                "https://en.wikipedia.org/w/api.php",
                params={
                    "action": "query",
                    "list": "search",
                    "srsearch": query,
                    "format": "json",
                    "srlimit": str(max_results),
                },
                headers={"User-Agent": _WIKI_UA},
                timeout=self._TIMEOUT,
            )
            if resp.status_code != 200:
                return []
            data = resp.json()
            search_results = data.get("query", {}).get("search", [])
            results: list[SearchResult] = []
            for item in search_results:
                title = item.get("title", "")
                pageid = item.get("pageid", "")
                # Build the Wikipedia URL from the page ID
                url = f"https://en.wikipedia.org/?curid={pageid}" if pageid else ""
                # Clean the snippet (Wikipedia returns HTML in the snippet)
                snippet_raw = item.get("snippet", "")
                soup = BeautifulSoup(snippet_raw, "html.parser")
                snippet = soup.get_text(" ", strip=True)
                if not title or not url:
                    continue
                results.append(SearchResult(
                    title=title, url=url, snippet=snippet,
                    source="wikipedia", rank=len(results) + 1,
                ))
            return results
        except Exception:
            return []

    def _search_lite(self, query: str, max_results: int) -> list[SearchResult]:
        """Search via the lite endpoint (POST). Returns [] on failure."""
        try:
            resp = requests.post(
                self._LITE_ENDPOINT,
                data={"q": query, "kl": "us-en"},
                headers={**_HEADERS, "Content-Type": "application/x-www-form-urlencoded"},
                timeout=self._TIMEOUT,
            )
            resp.raise_for_status()
            return self._parse_lite(resp.text, max_results)
        except Exception:
            return []

    def _search_html(self, query: str, max_results: int) -> list[SearchResult]:
        """Search via the html endpoint (GET). Returns [] on failure."""
        try:
            resp = requests.get(
                self._HTML_ENDPOINT,
                params={"q": query, "kl": "us-en"},
                headers=_HEADERS,
                timeout=self._TIMEOUT,
            )
            resp.raise_for_status()
            return self._parse_html(resp.text, max_results)
        except Exception:
            return []

    def _search_bing(self, query: str, max_results: int) -> list[SearchResult]:
        """Fallback: scrape Bing search results. Returns [] on failure."""
        try:
            resp = requests.get(
                "https://www.bing.com/search",
                params={
                    "q": query,
                    "count": str(max_results),
                    "setlang": "en-US",
                    "cc": "US",
                },
                headers=_HEADERS,
                timeout=self._TIMEOUT,
            )
            resp.raise_for_status()
            return self._parse_bing(resp.text, max_results)
        except Exception:
            return []

    def _search_google(self, query: str, max_results: int) -> list[SearchResult]:
        """Fallback: scrape Google search results. Returns [] on failure."""
        try:
            resp = requests.get(
                "https://www.google.com/search",
                params={"q": query, "num": str(max_results)},
                headers=_HEADERS,
                timeout=self._TIMEOUT,
            )
            resp.raise_for_status()
            return self._parse_google(resp.text, max_results)
        except Exception:
            return []

    # ── Parsers ──────────────────────────────────────────────────────────

    @staticmethod
    def _parse_lite(html: str, max_results: int) -> list[SearchResult]:
        """Parse the lite.duckduckgo.com response.

        The lite endpoint returns a simple HTML table. Each result has:
          - <a class="result-link" href="...">Title</a>
          - <td class="result-snippet">Snippet text</td>
        The href is a direct URL (no DDG redirect wrapper).
        """
        soup = BeautifulSoup(html, "html.parser")
        results: list[SearchResult] = []

        for link in soup.select("a.result-link"):
            if len(results) >= max_results:
                break
            href = link.get("href", "")
            url = DuckDuckGoProvider._unwrap_ddg_url(href)
            title = link.get_text(strip=True)
            if not url or not title:
                continue
            # Find the snippet: it's in the next <td> with class result-snippet
            snippet = ""
            parent_tr = link.find_parent("tr")
            if parent_tr:
                # The snippet is usually in the next sibling <tr>
                next_tr = parent_tr.find_next_sibling("tr")
                if next_tr:
                    snippet_td = next_tr.find("td", class_="result-snippet")
                    if snippet_td:
                        snippet = snippet_td.get_text(" ", strip=True)

            results.append(SearchResult(
                title=title, url=url, snippet=snippet,
                source="duckduckgo", rank=len(results) + 1,
            ))
        return results

    @staticmethod
    def _parse_html(html: str, max_results: int) -> list[SearchResult]:
        """Parse the html.duckduckgo.com response (the old parser)."""
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
            results.append(SearchResult(
                title=title, url=url, snippet=snippet,
                source="duckduckgo", rank=len(results) + 1,
            ))
        return results

    @staticmethod
    def _parse_bing(html: str, max_results: int) -> list[SearchResult]:
        """Parse Bing search results.

        Bing wraps result URLs in a /ck/a redirect with a 'u' parameter
        that is base64-encoded (with an 'a1' prefix). We decode it to
        get the real destination URL.
        """
        import base64
        soup = BeautifulSoup(html, "html.parser")
        results: list[SearchResult] = []

        for block in soup.select("li.b_algo"):
            if len(results) >= max_results:
                break
            h2 = block.select_one("h2")
            link = h2.find("a") if h2 else None
            if not link:
                continue
            title = h2.get_text(strip=True)
            href = link.get("href", "")

            # Unwrap Bing's ck/a redirect: the 'u' param is 'a1' + base64 URL
            url = href
            if "bing.com/ck/a" in href:
                try:
                    from urllib.parse import urlparse, parse_qs
                    parsed = urlparse(href)
                    qs = parse_qs(parsed.query)
                    u_val = qs.get("u", [""])[0]
                    if u_val.startswith("a1"):
                        # Strip 'a1' prefix, pad, base64 decode
                        b64 = u_val[2:]
                        b64 += "=" * (4 - len(b64) % 4) if len(b64) % 4 else ""
                        url = base64.b64decode(b64).decode("utf-8")
                except Exception:
                    pass  # Keep the raw href if decoding fails

            if not url or not title:
                continue

            # Snippet is in .b_caption p
            snippet_node = block.select_one(".b_caption p")
            snippet = snippet_node.get_text(" ", strip=True) if snippet_node else ""

            results.append(SearchResult(
                title=title, url=url, snippet=snippet,
                source="bing", rank=len(results) + 1,
            ))
        return results

    @staticmethod
    def _parse_google(html: str, max_results: int) -> list[SearchResult]:
        """Parse Google search results as a fallback."""
        soup = BeautifulSoup(html, "html.parser")
        results: list[SearchResult] = []

        # Google wraps results in <div> blocks with <h3> titles and <a> links.
        for h3 in soup.select("h3"):
            if len(results) >= max_results:
                break
            link = h3.find_parent("a")
            if not link:
                continue
            url = link.get("href", "")
            # Google uses /url?q= redirects
            if url.startswith("/url?q="):
                from urllib.parse import urlparse, parse_qs, unquote
                parsed = urlparse("https://www.google.com" + url)
                qs = parse_qs(parsed.query)
                url = unquote(qs.get("q", [""])[0])
            elif url.startswith("http"):
                pass
            else:
                continue
            title = h3.get_text(strip=True)
            if not url or not title:
                continue
            # Google doesn't easily expose snippets per-result in the HTML;
            # use the next text block as a rough snippet.
            snippet = ""
            parent = link.find_parent("div")
            if parent:
                spans = parent.find_all("span")
                for span in spans:
                    text = span.get_text(strip=True)
                    if len(text) > 40:
                        snippet = text
                        break

            results.append(SearchResult(
                title=title, url=url, snippet=snippet,
                source="google", rank=len(results) + 1,
            ))
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
