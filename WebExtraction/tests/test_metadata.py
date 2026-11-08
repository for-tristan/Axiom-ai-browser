"""
Tests for metadata.py — SourceMetadata builder.
"""

from __future__ import annotations

from datetime import datetime, timezone

import pytest

from app.models.schemas import ExtractionMethod, ExtractionStatus
from app.services.extractor import ExtractionResult
from app.services.fetcher import FetchResult
from app.services.metadata import build_failed_metadata, build_metadata


def _fetch(
    url: str = "https://example.com/",
    final_url: str | None = None,
    status: int = 200,
    content_type: str = "text/html",
    success: bool = True,
    error: str | None = None,
) -> FetchResult:
    return FetchResult(
        original_url   = url,
        final_url      = final_url or url,
        status_code    = status,
        content_type   = content_type,
        fetch_timestamp = datetime.now(timezone.utc),
        success        = success,
        error          = error,
    )


def _extraction(
    text: str = "Some extracted text with enough words to be valid.",
    title: str | None = "Test Title",
    description: str | None = "Test description.",
    author: str | None = None,
    published_date: str | None = None,
    language: str | None = "en",
    canonical_url: str | None = None,
    method: ExtractionMethod = ExtractionMethod.BEAUTIFULSOUP,
    status: ExtractionStatus = ExtractionStatus.SUCCESS,
    word_count: int = 10,
) -> ExtractionResult:
    return ExtractionResult(
        text          = text,
        title         = title,
        description   = description,
        author        = author,
        published_date = published_date,
        language      = language,
        canonical_url = canonical_url,
        method        = method,
        status        = status,
        word_count    = word_count,
    )


class TestBuildMetadata:
    def test_basic_fields_populated(self):
        m = build_metadata("src_01", _fetch(), _extraction())
        assert m.source_id == "src_01"
        assert m.original_url == "https://example.com/"
        assert m.title == "Test Title"
        assert m.description == "Test description."
        assert m.language == "en"

    def test_domain_extracted(self):
        m = build_metadata("src_02", _fetch("https://news.bbc.co.uk/article"), _extraction())
        assert m.domain == "news.bbc.co.uk"

    def test_original_and_final_url_preserved(self):
        m = build_metadata(
            "src_03",
            _fetch("http://example.com/", final_url="https://example.com/"),
            _extraction()
        )
        assert m.original_url == "http://example.com/"
        assert m.final_url == "https://example.com/"

    def test_snippet_passthrough(self):
        m = build_metadata("src_04", _fetch(), _extraction(), snippet="Search snippet text")
        assert m.snippet == "Search snippet text"

    def test_search_rank_passthrough(self):
        m = build_metadata("src_05", _fetch(), _extraction(), search_rank=3)
        assert m.search_rank == 3

    def test_extraction_method_preserved(self):
        m = build_metadata("src_06", _fetch(), _extraction(method=ExtractionMethod.TRAFILATURA))
        assert m.extraction_method == ExtractionMethod.TRAFILATURA

    def test_http_status_preserved(self):
        m = build_metadata("src_07", _fetch(status=200), _extraction())
        assert m.http_status == 200

    def test_no_author_stays_none(self):
        m = build_metadata("src_08", _fetch(), _extraction(author=None))
        assert m.author is None

    def test_no_published_date_stays_none(self):
        m = build_metadata("src_09", _fetch(), _extraction(published_date=None))
        assert m.published_date is None


class TestBuildFailedMetadata:
    def test_failed_metadata_has_error(self):
        m = build_failed_metadata("src_err", "http://localhost/", "Security blocked")
        assert m.error_message == "Security blocked"
        assert m.extraction_status == ExtractionStatus.SECURITY_BLOCKED

    def test_failed_metadata_domain(self):
        m = build_failed_metadata("src_err2", "https://evil.example.com/", "SSRF")
        assert m.domain == "evil.example.com"
