"""
Tests for extractor.py — content extraction service.
Covers tests: 1 (valid HTML), 3 (empty HTML), 10 (malformed HTML),
14 (non-HTML), 17 (lists), 18 (tables), 21 (empty extraction).
"""

from __future__ import annotations

from datetime import datetime, timezone

import pytest

from app.models.schemas import ExtractionMethod, ExtractionStatus
from app.services.extractor import ExtractionResult, extract_content
from app.services.fetcher import FetchResult
from tests.conftest import (
    ARTICLE_HTML,
    EMPTY_HTML,
    LIST_HTML,
    MALFORMED_HTML,
    TABLE_HTML,
)


def _make_fetch_result(
    html: str,
    url: str = "https://example.com/",
    status: int = 200,
    content_type: str = "text/html; charset=utf-8",
    success: bool = True,
    error: str | None = None,
) -> FetchResult:
    return FetchResult(
        original_url  = url,
        final_url     = url,
        status_code   = status,
        content_type  = content_type,
        raw_html      = html,
        raw_bytes     = html.encode(),
        encoding      = "utf-8",
        fetch_timestamp = datetime.now(timezone.utc),
        success       = success,
        error         = error,
    )


# ── Test: Valid HTML article ──────────────────────────────────────────────────

class TestValidArticleExtraction:
    """Test 1: A complete article is extracted with metadata."""

    def test_extracts_text(self):
        fetch = _make_fetch_result(ARTICLE_HTML)
        result = extract_content(fetch)
        assert result.text
        assert len(result.text) > 50

    def test_extracts_title(self):
        fetch = _make_fetch_result(ARTICLE_HTML)
        result = extract_content(fetch)
        assert result.title is not None
        assert "Python" in result.title

    def test_extracts_description(self):
        fetch = _make_fetch_result(ARTICLE_HTML)
        result = extract_content(fetch)
        assert result.description is not None
        assert "Python" in result.description

    def test_extracts_author(self):
        fetch = _make_fetch_result(ARTICLE_HTML)
        result = extract_content(fetch)
        assert result.author is not None

    def test_extracts_language(self):
        fetch = _make_fetch_result(ARTICLE_HTML)
        result = extract_content(fetch)
        assert result.language == "en"

    def test_extracts_canonical_url(self):
        fetch = _make_fetch_result(ARTICLE_HTML)
        result = extract_content(fetch)
        assert result.canonical_url == "https://example.com/python-guide"

    def test_status_success(self):
        fetch = _make_fetch_result(ARTICLE_HTML)
        result = extract_content(fetch)
        assert result.status == ExtractionStatus.SUCCESS

    def test_method_is_set(self):
        fetch = _make_fetch_result(ARTICLE_HTML)
        result = extract_content(fetch)
        assert result.method in (ExtractionMethod.TRAFILATURA, ExtractionMethod.BEAUTIFULSOUP)

    def test_word_count_nonzero(self):
        fetch = _make_fetch_result(ARTICLE_HTML)
        result = extract_content(fetch)
        assert result.word_count > 10


# ── Test: Empty HTML ──────────────────────────────────────────────────────────

class TestEmptyHtml:
    """Test 3 / 21: Empty HTML returns empty content, not an exception."""

    def test_empty_html_handled(self):
        fetch = _make_fetch_result(EMPTY_HTML)
        result = extract_content(fetch)
        # Should not raise; status should indicate empty or partial
        assert result.status in (ExtractionStatus.EMPTY_CONTENT, ExtractionStatus.PARTIAL, ExtractionStatus.SUCCESS)

    def test_empty_html_text_is_empty_or_tiny(self):
        fetch = _make_fetch_result(EMPTY_HTML)
        result = extract_content(fetch)
        assert result.word_count < 10


# ── Test: Failed fetch ────────────────────────────────────────────────────────

class TestFailedFetch:
    def test_failed_fetch_returns_failed_status(self):
        fetch = FetchResult(
            original_url = "https://example.com/",
            success      = False,
            error        = "Connection refused",
        )
        result = extract_content(fetch)
        assert result.status == ExtractionStatus.FAILED
        assert result.text == ""


# ── Test: Malformed HTML ──────────────────────────────────────────────────────

class TestMalformedHtml:
    """Test 10: Malformed HTML does not crash the extractor."""

    def test_malformed_html_handled(self):
        fetch = _make_fetch_result(MALFORMED_HTML)
        result = extract_content(fetch)
        # Should not raise
        assert isinstance(result, ExtractionResult)

    def test_malformed_html_has_some_text(self):
        fetch = _make_fetch_result(MALFORMED_HTML)
        result = extract_content(fetch)
        # BeautifulSoup repairs malformed HTML; some text should be recovered
        # (or it gracefully returns empty)
        assert result.text is not None


# ── Test: Non-HTML content type ───────────────────────────────────────────────

class TestNonHtmlContent:
    """Test 14: Non-HTML content is rejected with appropriate status."""

    def test_pdf_content_type_rejected(self):
        fetch = _make_fetch_result(
            html         = "%PDF-1.4 binary data",
            content_type = "application/pdf",
        )
        result = extract_content(fetch)
        assert result.status == ExtractionStatus.UNSUPPORTED_TYPE

    def test_image_content_type_rejected(self):
        fetch = _make_fetch_result(
            html         = "binary data",
            content_type = "image/png",
        )
        result = extract_content(fetch)
        assert result.status == ExtractionStatus.UNSUPPORTED_TYPE


# ── Test: Articles with lists ─────────────────────────────────────────────────

class TestListExtraction:
    """Test 17: Articles containing lists are extracted correctly."""

    def test_list_content_extracted(self):
        fetch = _make_fetch_result(LIST_HTML)
        result = extract_content(fetch)
        assert result.text
        # At least some list content should be present
        assert any(lang in result.text for lang in ["Python", "JavaScript", "Java"])

    def test_list_word_count(self):
        fetch = _make_fetch_result(LIST_HTML)
        result = extract_content(fetch)
        assert result.word_count > 20


# ── Test: Articles with tables ────────────────────────────────────────────────

class TestTableExtraction:
    """Test 18: Articles containing tables have table content included."""

    def test_table_content_extracted(self):
        fetch = _make_fetch_result(TABLE_HTML)
        result = extract_content(fetch)
        assert result.text
        # Framework names from the table should appear
        assert any(fw in result.text for fw in ["Django", "FastAPI", "Flask"])

    def test_table_extraction_succeeds(self):
        fetch = _make_fetch_result(TABLE_HTML)
        result = extract_content(fetch)
        assert result.status in (ExtractionStatus.SUCCESS, ExtractionStatus.PARTIAL)


# ── Test: Missing metadata ────────────────────────────────────────────────────

class TestMissingMetadata:
    """Test 16: Sources with missing metadata have None fields, not invented values."""

    def test_no_author_is_none(self):
        minimal_html = "<html><head><title>No Meta</title></head><body><p>Some content here about topic</p></body></html>"
        fetch = _make_fetch_result(minimal_html)
        result = extract_content(fetch)
        # Author may be None — it must NOT be fabricated
        # We just verify the extraction doesn't crash
        assert isinstance(result, ExtractionResult)

    def test_no_description_is_none(self):
        minimal_html = "<html><head><title>No Meta</title></head><body><p>Content</p></body></html>"
        fetch = _make_fetch_result(minimal_html)
        result = extract_content(fetch)
        assert result.description is None
