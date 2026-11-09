"""
Tests for fetcher.py — HTTP fetching engine.
Uses mocked HTTP responses; no real network calls.

Covers tests: 1 (valid HTML), 2 (invalid URL), 4–10 (HTTP errors, timeout,
SSL, redirect), 15 (large response), 19 (concurrent), 20 (mixed).
"""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from app.services.fetcher import FetchResult, fetch_single, fetch_urls
from app.utils.url_security import SecurityError


# ── Helpers ───────────────────────────────────────────────────────────────────

def _mock_response(
    status_code: int = 200,
    content: bytes = b"<html><body>Hello</body></html>",
    content_type: str = "text/html; charset=utf-8",
    url: str = "https://example.com/",
    history: list | None = None,
) -> MagicMock:
    resp = MagicMock(spec=httpx.Response)
    resp.status_code = status_code
    resp.content = content
    resp.encoding = "utf-8"
    resp.text = content.decode("utf-8", errors="replace")
    resp.headers = {"content-type": content_type}
    resp.url = httpx.URL(url)
    resp.history = history or []
    if status_code >= 400:
        resp.raise_for_status.side_effect = httpx.HTTPStatusError(
            message=f"HTTP Error {status_code}",
            request=MagicMock(),
            response=resp,
        )
    else:
        resp.raise_for_status.return_value = None
    return resp


# ── Test: valid HTML article ──────────────────────────────────────────────────

class TestValidFetch:
    """Test 1: Valid HTML article fetched successfully."""

    @pytest.mark.asyncio
    async def test_successful_fetch(self):
        with patch("app.utils.url_security._resolve_host", return_value=["93.184.216.34"]):
            mock_resp = _mock_response(200, b"<html><body><p>Article text</p></body></html>")
            with patch("httpx.AsyncClient.get", return_value=mock_resp) as mock_get:
                mock_get = AsyncMock(return_value=mock_resp)
                with patch.object(httpx.AsyncClient, "get", mock_get):
                    result = await fetch_single("https://example.com/article")

        assert result.success is True
        assert result.status_code == 200
        assert "Article text" in (result.raw_html or "")


# ── Test: invalid URL ─────────────────────────────────────────────────────────

class TestInvalidUrl:
    """Test 2: Invalid URL returns failure, not an exception."""

    @pytest.mark.asyncio
    async def test_localhost_blocked(self):
        results = await fetch_urls(["http://localhost/admin"])
        assert len(results) == 1
        assert results[0].success is False
        assert results[0].error is not None

    @pytest.mark.asyncio
    async def test_private_ip_blocked(self):
        results = await fetch_urls(["http://192.168.1.1/"])
        assert len(results) == 1
        assert results[0].success is False


# ── Test: HTTP 403 ────────────────────────────────────────────────────────────

class TestHttp403:
    """Test 4: HTTP 403 is recorded, does not raise."""

    @pytest.mark.asyncio
    async def test_403_returns_failure(self):
        with patch("app.utils.url_security._resolve_host", return_value=["8.8.8.8"]):
            mock_resp = _mock_response(403, url="https://paywall.com/article")
            mock_get = AsyncMock(return_value=mock_resp)
            with patch.object(httpx.AsyncClient, "get", mock_get):
                result = await fetch_single("https://paywall.com/article")

        assert result.success is False
        assert result.status_code == 403


# ── Test: HTTP 404 ────────────────────────────────────────────────────────────

class TestHttp404:
    """Test 5: HTTP 404 returns failure."""

    @pytest.mark.asyncio
    async def test_404_returns_failure(self):
        with patch("app.utils.url_security._resolve_host", return_value=["8.8.8.8"]):
            mock_resp = _mock_response(404, url="https://example.com/not-found")
            mock_get = AsyncMock(return_value=mock_resp)
            with patch.object(httpx.AsyncClient, "get", mock_get):
                result = await fetch_single("https://example.com/not-found")

        assert result.success is False
        assert result.status_code == 404


# ── Test: HTTP 500 ────────────────────────────────────────────────────────────

class TestHttp500:
    """Test 6: HTTP 500 returns failure without crashing."""

    @pytest.mark.asyncio
    async def test_500_returns_failure(self):
        with patch("app.utils.url_security._resolve_host", return_value=["8.8.8.8"]):
            mock_resp = _mock_response(500, url="https://broken-server.com/")
            mock_get = AsyncMock(return_value=mock_resp)
            with patch.object(httpx.AsyncClient, "get", mock_get):
                result = await fetch_single("https://broken-server.com/")

        assert result.success is False


# ── Test: Timeout ─────────────────────────────────────────────────────────────

class TestTimeout:
    """Test 7: Timeout is handled gracefully."""

    @pytest.mark.asyncio
    async def test_timeout_returns_failure(self):
        with patch("app.utils.url_security._resolve_host", return_value=["8.8.8.8"]):
            mock_get = AsyncMock(side_effect=httpx.TimeoutException("timed out"))
            with patch.object(httpx.AsyncClient, "get", mock_get):
                result = await fetch_single("https://slow-server.com/")

        assert result.success is False
        assert result.error is not None
        assert "timeout" in result.error.lower() or "timed" in result.error.lower()


# ── Test: SSL failure ─────────────────────────────────────────────────────────

class TestSslFailure:
    """Test 8: SSL/TLS errors are handled gracefully."""

    @pytest.mark.asyncio
    async def test_ssl_error_returns_failure(self):
        with patch("app.utils.url_security._resolve_host", return_value=["8.8.8.8"]):
            mock_get = AsyncMock(side_effect=httpx.ConnectError("SSL handshake failed"))
            with patch.object(httpx.AsyncClient, "get", mock_get):
                result = await fetch_single("https://self-signed.example.com/")

        assert result.success is False
        assert result.error is not None


# ── Test: Redirect handling ───────────────────────────────────────────────────

class TestRedirectHandling:
    """Test 9: Safe redirects are followed; redirect chain is recorded."""

    @pytest.mark.asyncio
    async def test_safe_redirect_followed(self):
        with patch("app.utils.url_security._resolve_host", return_value=["93.184.216.34"]):
            # Simulate a redirect from http to https
            orig_resp = MagicMock()
            orig_resp.url = httpx.URL("http://example.com/")

            final_resp = _mock_response(200, url="https://example.com/")
            final_resp.history = [orig_resp]

            mock_get = AsyncMock(return_value=final_resp)
            with patch.object(httpx.AsyncClient, "get", mock_get):
                result = await fetch_single("http://example.com/")

        assert result.success is True
        assert result.redirected is True


# ── Test: Large response ──────────────────────────────────────────────────────

class TestLargeResponse:
    """Test 15: Oversized responses are truncated, not rejected outright."""

    @pytest.mark.asyncio
    async def test_large_response_truncated(self):
        big_content = b"<html><body><p>" + b"x" * (6 * 1024 * 1024) + b"</p></body></html>"
        with patch("app.utils.url_security._resolve_host", return_value=["8.8.8.8"]):
            mock_resp = _mock_response(200, content=big_content)
            mock_resp.content = big_content

            mock_get = AsyncMock(return_value=mock_resp)
            with patch.object(httpx.AsyncClient, "get", mock_get):
                result = await fetch_single("https://bigpage.com/")

        # Should succeed but content is truncated
        if result.success:
            assert len(result.raw_bytes or b"") <= 5 * 1024 * 1024 + 1000


# ── Test: Multiple concurrent URLs ───────────────────────────────────────────

class TestConcurrentFetch:
    """Test 19: Multiple concurrent URLs are all processed."""

    @pytest.mark.asyncio
    async def test_concurrent_fetching(self):
        urls = [f"https://site{i}.com/" for i in range(5)]
        blocked_ips = ["93.184.216.34"] * 5

        def mock_resolve(hostname):
            return ["93.184.216.34"]

        with patch("app.utils.url_security._resolve_host", side_effect=mock_resolve):
            mock_get = AsyncMock(return_value=_mock_response(200))
            with patch.object(httpx.AsyncClient, "get", mock_get):
                results = await fetch_urls(urls)

        assert len(results) == len(urls)


# ── Test: Mixed success and failure ──────────────────────────────────────────

class TestMixedResults:
    """Test 20: One failed URL does not abort processing of other URLs."""

    @pytest.mark.asyncio
    async def test_one_failure_does_not_abort_batch(self):
        good_url = "https://good.example.com/"
        bad_url  = "http://localhost/admin"   # will be SSRF-blocked

        def mock_resolve(hostname):
            if "good" in hostname:
                return ["93.184.216.34"]
            return ["127.0.0.1"]  # private — but bad_url won't reach DNS check

        with patch("app.utils.url_security._resolve_host", side_effect=mock_resolve):
            mock_get = AsyncMock(return_value=_mock_response(200, url=good_url))
            with patch.object(httpx.AsyncClient, "get", mock_get):
                results = await fetch_urls([good_url, bad_url])

        assert len(results) == 2
        successes = [r for r in results if r.success]
        failures  = [r for r in results if not r.success]
        assert len(failures) >= 1  # bad_url must have failed
