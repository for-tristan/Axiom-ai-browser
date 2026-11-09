"""
Tests for the FastAPI endpoints — /health, /extract, /process-sources.
Covers tests 29 (invalid API requests), 30 (health endpoint), 31 (process-sources).
"""

from __future__ import annotations

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timezone

from fastapi.testclient import TestClient

from app.main import app
from app.services.fetcher import FetchResult

client = TestClient(app)


def _ok_fetch(url: str, html: str | None = None) -> FetchResult:
    html = html or "<html><head><title>Test Page</title><meta name='description' content='Test.'></head><body><main><p>This is a test article about Python programming. It has enough content to be extracted properly by the system.</p></main></body></html>"
    return FetchResult(
        original_url   = url,
        final_url      = url,
        status_code    = 200,
        content_type   = "text/html; charset=utf-8",
        raw_html       = html,
        raw_bytes      = html.encode(),
        encoding       = "utf-8",
        fetch_timestamp = datetime.now(timezone.utc),
        success        = True,
    )


def _failed_fetch(url: str, error: str = "Connection refused", status: int | None = None) -> FetchResult:
    return FetchResult(
        original_url  = url,
        final_url     = url,
        status_code   = status,
        fetch_timestamp = datetime.now(timezone.utc),
        success       = False,
        error         = error,
    )


# ── Health endpoint ───────────────────────────────────────────────────────────

class TestHealthEndpoint:
    """Test 30: GET /health returns 200 with status ok."""

    def test_health_returns_200(self):
        response = client.get("/health")
        assert response.status_code == 200

    def test_health_status_ok(self):
        response = client.get("/health")
        data = response.json()
        assert data["status"] == "ok"

    def test_health_has_service_name(self):
        response = client.get("/health")
        data = response.json()
        assert "service" in data
        assert len(data["service"]) > 0

    def test_health_has_version(self):
        response = client.get("/health")
        data = response.json()
        assert "version" in data


# ── /extract endpoint ─────────────────────────────────────────────────────────

class TestExtractEndpoint:
    def test_extract_valid_url(self):
        url = "https://example.com/article"
        with patch("app.utils.url_security._resolve_host", return_value=["93.184.216.34"]):
            with patch("app.services.fetcher.fetch_urls", new_callable=AsyncMock) as mock_fetch:
                mock_fetch.return_value = [_ok_fetch(url)]
                response = client.post("/extract", json={"urls": [url]})

        assert response.status_code == 200
        data = response.json()
        assert "processed_sources" in data
        assert "failed_sources" in data
        assert "stats" in data

    def test_extract_no_urls(self):
        """Test 29: Empty URL list is rejected."""
        response = client.post("/extract", json={"urls": []})
        assert response.status_code == 422

    def test_extract_too_many_urls(self):
        """Test 29: Too many URLs are rejected."""
        urls = [f"https://example{i}.com/" for i in range(25)]
        with patch("app.utils.url_security._resolve_host", return_value=["8.8.8.8"]):
            response = client.post("/extract", json={"urls": urls})
        assert response.status_code == 422

    def test_extract_missing_body(self):
        """Test 29: Missing request body returns 422."""
        response = client.post("/extract")
        assert response.status_code == 422

    def test_extract_ssrf_url_blocked(self):
        """SSRF URL should appear in failed_sources."""
        response = client.post("/extract", json={"urls": ["http://localhost/admin"]})
        assert response.status_code == 200
        data = response.json()
        # The localhost URL should be in failed_sources
        assert len(data["failed_sources"]) >= 1

    def test_extract_response_has_stats(self):
        url = "https://example.com/"
        with patch("app.utils.url_security._resolve_host", return_value=["93.184.216.34"]):
            with patch("app.services.fetcher.fetch_urls", new_callable=AsyncMock) as mock_fetch:
                mock_fetch.return_value = [_ok_fetch(url)]
                response = client.post("/extract", json={"urls": [url]})

        data = response.json()
        stats = data["stats"]
        assert "total_requested" in stats
        assert "processing_time_seconds" in stats
        assert stats["total_requested"] == 1

    def test_extract_includes_chunks(self):
        url = "https://example.com/"
        with patch("app.utils.url_security._resolve_host", return_value=["93.184.216.34"]):
            with patch("app.services.fetcher.fetch_urls", new_callable=AsyncMock) as mock_fetch:
                mock_fetch.return_value = [_ok_fetch(url)]
                response = client.post("/extract", json={"urls": [url], "include_chunks": True})

        data = response.json()
        assert "chunks" in data


# ── /process-sources endpoint ─────────────────────────────────────────────────

class TestProcessSourcesEndpoint:
    """Test 31: POST /process-sources — complete pipeline."""

    def _search_result(self, url: str, title: str = "Test", snippet: str = "Test snippet.", rank: int = 1):
        return {"url": url, "title": title, "snippet": snippet, "source": "duckduckgo", "rank": rank}

    def test_process_sources_success(self):
        url = "https://python.org/"
        with patch("app.utils.url_security._resolve_host", return_value=["8.8.8.8"]):
            with patch("app.services.fetcher.fetch_urls", new_callable=AsyncMock) as mock_fetch:
                mock_fetch.return_value = [_ok_fetch(url)]
                response = client.post("/process-sources", json={
                    "query": "What is Python?",
                    "search_results": [self._search_result(url, "Python.org", "Python programming language.")],
                })

        assert response.status_code == 200
        data = response.json()
        assert "ranked_sources" in data
        assert "task1_pages" in data
        assert "chunks" in data
        assert "stats" in data
        assert "duplicates" in data
        assert data["query"] == "What is Python?"

    def test_task1_pages_format(self):
        """Verify task1_pages has the exact {title, url, content} format Task 1 expects."""
        url = "https://example.com/"
        with patch("app.utils.url_security._resolve_host", return_value=["93.184.216.34"]):
            with patch("app.services.fetcher.fetch_urls", new_callable=AsyncMock) as mock_fetch:
                mock_fetch.return_value = [_ok_fetch(url)]
                response = client.post("/process-sources", json={
                    "query": "test query",
                    "search_results": [self._search_result(url)],
                })

        data = response.json()
        for page in data.get("task1_pages", []):
            assert "title" in page
            assert "url" in page
            assert "content" in page

    def test_process_sources_no_query(self):
        """Test 29: Missing query returns 422."""
        response = client.post("/process-sources", json={
            "search_results": [{"url": "https://example.com/", "title": "T", "snippet": "S"}]
        })
        assert response.status_code == 422

    def test_process_sources_empty_results(self):
        """Test 29: Empty search_results returns 422."""
        response = client.post("/process-sources", json={
            "query": "test",
            "search_results": [],
        })
        assert response.status_code == 422

    def test_ssrf_in_process_sources(self):
        """SSRF URLs in search results are blocked, not crashing the pipeline."""
        response = client.post("/process-sources", json={
            "query": "internal service",
            "search_results": [
                {"url": "http://localhost:8080/admin", "title": "Admin", "snippet": "Admin page."}
            ],
        })
        assert response.status_code == 200
        data = response.json()
        assert len(data["failed_sources"]) >= 1

    def test_mixed_success_failure(self):
        """Mixed search results: some succeed, some fail."""
        good_url = "https://good.example.com/"
        bad_url  = "http://10.0.0.1/"  # private IP

        with patch("app.utils.url_security._resolve_host", return_value=["93.184.216.34"]):
            with patch("app.services.fetcher.fetch_urls", new_callable=AsyncMock) as mock_fetch:
                mock_fetch.return_value = [_ok_fetch(good_url)]
                response = client.post("/process-sources", json={
                    "query": "test",
                    "search_results": [
                        self._search_result(good_url, "Good Site"),
                        self._search_result(bad_url, "Bad Site"),
                    ],
                })

        assert response.status_code == 200
        data = response.json()
        assert len(data["failed_sources"]) >= 1


# ── Docs availability ─────────────────────────────────────────────────────────

class TestDocsAvailability:
    def test_swagger_docs_available(self):
        response = client.get("/docs")
        assert response.status_code == 200

    def test_openapi_json_available(self):
        response = client.get("/openapi.json")
        assert response.status_code == 200
