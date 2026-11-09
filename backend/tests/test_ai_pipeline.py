"""Unified end-to-end test for the Axiom AI pipeline (Tasks 1 + 2 + 3).

This test exercises the three AI backend modules as a single integrated
system, verifying that they compose correctly:

    user question
        │
        ▼
    Task 2: query_intelligence → search_providers → extraction_bridge
        │  (classify, refine, search, fetch+extract via Task 3)
        ▼
    [{title, url, content}, ...]   ← the page dict contract
        │
        ▼
    Task 1: answer_generator.answer_with_citations
        │  (LLM call mocked — we verify the wiring, not the LLM)
        ▼
    {answer, citations, sources}

All network calls (search engine, page fetching) are mocked so the test
runs fully offline in milliseconds. The LLM is also mocked so no API
key is needed.

Run:
    cd backend/tests
    python -m pytest test_ai_pipeline.py -v
"""

from __future__ import annotations

import asyncio
import sys
import os
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# ── Path setup ──────────────────────────────────────────────────────────────
# Make the three task modules importable.
_BACKEND = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
_SERVICES = os.path.join(_BACKEND, "services")

for _p in (
    os.path.join(_SERVICES, "web_search"),       # Task 2 (flat imports)
    os.path.join(_SERVICES, "ai_chat"),           # Task 1 (flat imports)
    os.path.join(_SERVICES, "web_extraction"),    # Task 3 (app.* package)
):
    if _p not in sys.path:
        sys.path.insert(0, _p)

# Task 1's answer_generator creates LLMClient() at import time, which
# requires NVIDIA_API_KEY. Set a dummy value so the import doesn't crash.
# The actual LLM calls are mocked in the tests.
os.environ.setdefault("NVIDIA_API_KEY", "test-key-not-real")


# ── Test fixtures ───────────────────────────────────────────────────────────

# A realistic HTML page that Task 3's extractor can parse.
_MOCK_HTML = """<!DOCTYPE html>
<html lang="en"><head>
  <meta charset="UTF-8">
  <meta name="description" content="Paris is the capital of France.">
  <title>Paris - Wikipedia</title>
</head><body>
  <nav><a href="/">Home</a></nav>
  <main><article>
    <h1>Paris</h1>
    <p>Paris is the capital and most populous city of France. With an
    official estimated population of 2,102,650 residents, Paris is the
    fifth-largest city in the European Union.</p>
  </article></main>
  <footer>(c) Wikipedia</footer>
</body></html>"""

# Task 3 FetchResult that the mocked fetch_urls will return.
def _make_fetch_result(url: str, html: str = _MOCK_HTML):
    from app.services.fetcher import FetchResult
    return FetchResult(
        original_url=url,
        final_url=url,
        status_code=200,
        content_type="text/html; charset=utf-8",
        raw_html=html,
        raw_bytes=html.encode(),
        encoding="utf-8",
        fetch_timestamp=datetime.now(timezone.utc),
        success=True,
    )


# ── Tests ───────────────────────────────────────────────────────────────────

class TestQueryIntelligence:
    """Task 2a: query intelligence layer (offline, no network)."""

    def test_classify_factual(self):
        from query_intelligence import classify_query
        assert classify_query("What is the capital of France?") == "factual"

    def test_classify_greeting(self):
        from query_intelligence import classify_query
        assert classify_query("hello") == "greeting"

    def test_is_search_needed_for_factual(self):
        from query_intelligence import is_search_needed
        assert is_search_needed("What is the capital of France?") is True

    def test_is_search_needed_for_greeting(self):
        from query_intelligence import is_search_needed
        assert is_search_needed("hi") is False

    def test_refine_strips_filler(self):
        from query_intelligence import refine_query
        assert refine_query("Can you tell me what is the capital of France?") == "capital of France"

    def test_split_compound_query(self):
        from query_intelligence import split_query
        parts = split_query("What is the capital of France and what is its population?")
        assert len(parts) == 2

    def test_extract_bare_url(self):
        from query_intelligence import extract_url
        assert extract_url("https://example.com") == "https://example.com"
        assert extract_url("not a url") is None


class TestSearchToExtraction:
    """Task 2b → Task 3: search results flow through extraction_bridge.

    Verifies that search_for_pages() calls Task 3's fetcher+extractor
    (via extraction_bridge) and produces {title, url, content} dicts
    with real extracted text — not just search snippets.
    """

    def test_search_for_pages_uses_task3_extraction(self):
        """search_for_pages should return pages with content extracted by Task 3."""
        from result import SearchResult
        from search_providers import SearchProvider

        # Mock search provider returns one hit.
        mock_provider = MagicMock(spec=SearchProvider)
        mock_provider.search.return_value = [
            SearchResult(
                title="Paris - Wikipedia",
                url="https://en.wikipedia.org/wiki/Paris",
                snippet="Paris is the capital of France.",
                source="duckduckgo",
                rank=1,
            )
        ]

        # Mock Task 3's async fetch_urls so no real network call happens.
        with patch("app.utils.url_security._resolve_host", return_value=["93.184.216.34"]):
            with patch("extraction_bridge.fetch_urls", new_callable=AsyncMock) as mock_fetch:
                mock_fetch.return_value = [_make_fetch_result("https://en.wikipedia.org/wiki/Paris")]

                from pipeline import search_for_pages
                pages = search_for_pages(
                    "What is the capital of France?",
                    max_results=3,
                    fetch_content=True,
                    provider=mock_provider,
                )

        assert len(pages) == 1
        page = pages[0]
        # Contract: exactly these three keys
        assert set(page.keys()) == {"title", "url", "content"}
        assert page["title"] == "Paris - Wikipedia"
        assert page["url"] == "https://en.wikipedia.org/wiki/Paris"
        # Content should be the extracted article text, not just the snippet.
        assert len(page["content"]) > 50
        assert "Paris" in page["content"]

    def test_greeting_returns_no_pages(self):
        """A greeting should not trigger a search."""
        from pipeline import search_for_pages
        pages = search_for_pages("hello there")
        assert pages == []

    def test_search_snippet_fallback_on_extraction_failure(self):
        """If Task 3 extraction fails, the search snippet should be used."""
        from result import SearchResult
        from search_providers import SearchProvider

        mock_provider = MagicMock(spec=SearchProvider)
        mock_provider.search.return_value = [
            SearchResult(
                title="Test",
                url="https://fallback-test.example.com/article",
                snippet="Search snippet text.",
                source="duckduckgo",
                rank=1,
            )
        ]

        # Mock fetch_urls to return a failed result (extraction will fail).
        from app.services.fetcher import FetchResult
        failed_result = FetchResult(
            original_url="https://fallback-test.example.com/article",
            fetch_timestamp=datetime.now(timezone.utc),
            success=False,
            error="Connection refused",
        )

        with patch("app.utils.url_security._resolve_host", return_value=["93.184.216.34"]):
            with patch("extraction_bridge.fetch_urls", new_callable=AsyncMock) as mock_fetch:
                mock_fetch.return_value = [failed_result]

                from pipeline import search_for_pages
                pages = search_for_pages(
                    "test query fallback",
                    max_results=1,
                    provider=mock_provider,
                )

        assert len(pages) == 1
        # Should fall back to the snippet.
        assert pages[0]["content"] == "Search snippet text."


class TestTask1Contract:
    """Task 1: verify answer_with_citations accepts the pages from Task 2+3."""

    def test_pages_have_correct_shape(self):
        """The page dicts produced by Task 2+3 must have title/url/content."""
        from result import SearchResult
        from search_providers import SearchProvider

        mock_provider = MagicMock(spec=SearchProvider)
        mock_provider.search.return_value = [
            SearchResult(title="T", url="https://example.com", snippet="S", source="ddg", rank=1)
        ]

        with patch("app.utils.url_security._resolve_host", return_value=["93.184.216.34"]):
            with patch("extraction_bridge.fetch_urls", new_callable=AsyncMock) as mock_fetch:
                mock_fetch.return_value = [_make_fetch_result("https://example.com")]
                from pipeline import search_for_pages
                pages = search_for_pages("test", max_results=1, provider=mock_provider)

        for p in pages:
            assert isinstance(p, dict)
            assert "title" in p and isinstance(p["title"], str)
            assert "url" in p and isinstance(p["url"], str)
            assert "content" in p and isinstance(p["content"], str)

    def test_answer_with_citations_accepts_pages(self):
        """Task 1's answer_with_citations should accept Task 2+3 pages."""
        pages = [
            {
                "title": "Paris - Wikipedia",
                "url": "https://en.wikipedia.org/wiki/Paris",
                "content": "Paris is the capital and most populous city of France.",
            }
        ]

        # Patch the module-level llm instance that answer_generator
        # created at import time (not the class — the instance already exists).
        with patch("answer_generator.llm") as mock_llm:
            mock_llm.chat.return_value = "The capital of France is Paris [1]."

            from answer_generator import answer_with_citations
            result = answer_with_citations("What is the capital of France?", pages)

        assert "answer" in result
        assert "citations" in result
        assert "Paris" in result["answer"]
        assert len(result["citations"]) >= 1
        assert result["citations"][0]["url"] == "https://en.wikipedia.org/wiki/Paris"

    def test_citations_extracted_from_answer(self):
        """The citation extractor should pull [1] references from the answer."""
        from citations import extract_citations
        pages = [
            {"title": "Source A", "url": "https://a.com"},
            {"title": "Source B", "url": "https://b.com"},
        ]
        answer = "According to [1] and also [2], the answer is clear."
        cites = extract_citations(answer, pages)
        assert len(cites) == 2
        assert cites[0]["number"] == 1
        assert cites[0]["url"] == "https://a.com"
        assert cites[1]["number"] == 2
        assert cites[1]["url"] == "https://b.com"


class TestFullPipeline:
    """End-to-end: Task 2 (search) → Task 3 (extraction) → Task 1 (answer)."""

    def test_full_pipeline_produces_cited_answer(self):
        """The complete pipeline: question → search → extract → answer."""
        from result import SearchResult
        from search_providers import SearchProvider

        # Step 1: mock the search provider (Task 2).
        mock_provider = MagicMock(spec=SearchProvider)
        mock_provider.search.return_value = [
            SearchResult(
                title="Paris - Wikipedia",
                url="https://en.wikipedia.org/wiki/Paris",
                snippet="Paris is the capital of France.",
                source="duckduckgo",
                rank=1,
            )
        ]

        # Step 2: mock Task 3's fetcher so extraction uses our test HTML.
        with patch("app.utils.url_security._resolve_host", return_value=["93.184.216.34"]):
            with patch("extraction_bridge.fetch_urls", new_callable=AsyncMock) as mock_fetch:
                mock_fetch.return_value = [_make_fetch_result("https://en.wikipedia.org/wiki/Paris")]

                # Step 3: mock Task 1's LLM (patch the module-level instance).
                with patch("answer_generator.llm") as mock_llm:
                    mock_llm.chat.return_value = (
                        "The capital of France is Paris [1]. "
                        "It is also the most populous city in the country."
                    )

                    from pipeline import search_for_answer
                    result = search_for_answer(
                        "What is the capital of France?",
                        max_results=3,
                        provider=mock_provider,
                    )

        # Verify the full result structure.
        assert "answer" in result
        assert "citations" in result
        assert "sources" in result
        assert len(result["sources"]) == 1
        assert "Paris" in result["answer"]
        assert len(result["citations"]) >= 1
        assert result["citations"][0]["url"] == "https://en.wikipedia.org/wiki/Paris"

    def test_full_pipeline_no_results(self):
        """When search returns nothing, the pipeline should not crash."""
        from search_providers import SearchProvider

        mock_provider = MagicMock(spec=SearchProvider)
        mock_provider.search.return_value = []

        from pipeline import search_for_answer
        result = search_for_answer("obscure query xyzzy", max_results=3, provider=mock_provider)

        assert "answer" in result
        assert "citations" in result
        assert result["citations"] == []
        assert "couldn't find" in result["answer"].lower() or "no" in result["answer"].lower()


class TestTask3Standalone:
    """Task 3: verify the extraction service works on its own."""

    def test_extract_content_from_html(self):
        """Task 3's extractor should pull article text from HTML."""
        from app.services.fetcher import FetchResult
        from app.services.extractor import extract_content

        fr = _make_fetch_result("https://example.com/article")
        result = extract_content(fr)
        assert result.text
        assert "Paris" in result.text

    def test_clean_text_removes_artifacts(self):
        """Task 3's cleaner should normalize whitespace and control chars."""
        from app.services.cleaner import clean_text
        # Multiple spaces within a line should be collapsed; 3+ blank
        # lines should be reduced to at most 2.
        messy = "Hello     world\n\n\n\n\nBye"
        cleaned = clean_text(messy)
        # Within-line spaces collapsed
        assert "     " not in cleaned
        # 3+ blank lines collapsed to at most 2
        assert "\n\n\n" not in cleaned
        # Content preserved
        assert "Hello" in cleaned
        assert "Bye" in cleaned

    def test_ssrf_blocked(self):
        """Task 3's security layer should block localhost."""
        from app.utils.url_security import validate_url, SecurityError
        with pytest.raises(SecurityError):
            validate_url("http://localhost/admin")
        with pytest.raises(SecurityError):
            validate_url("http://127.0.0.1/admin")
        with pytest.raises(SecurityError):
            validate_url("http://10.0.0.1/internal")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
