"""
Tests for deduplicator.py — source deduplication.
Covers tests 11 (duplicate URLs), 12 (duplicate content), 13 (tracking params).
"""

from __future__ import annotations

import pytest

from app.models.schemas import ExtractionStatus, ProcessedSource, SourceMetadata
from app.services.deduplicator import deduplicate_sources, normalize_url


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_source(
    url: str,
    final_url: str | None = None,
    canonical_url: str | None = None,
    text: str | None = None,
    source_id: str | None = None,
) -> ProcessedSource:
    sid = source_id or f"src_{url[:8]}"
    m = SourceMetadata(
        source_id        = sid,
        original_url     = url,
        final_url        = final_url or url,
        canonical_url    = canonical_url,
        extracted_text   = text,
        extraction_status = ExtractionStatus.SUCCESS if text else ExtractionStatus.EMPTY_CONTENT,
    )
    return ProcessedSource(metadata=m)


# ── URL normalisation ─────────────────────────────────────────────────────────

class TestNormalizeUrl:
    def test_strips_tracking_params(self):
        url = "https://example.com/article?utm_source=twitter&utm_campaign=promo"
        normalised = normalize_url(url)
        assert "utm_source" not in normalised
        assert "utm_campaign" not in normalised
        assert "example.com/article" in normalised

    def test_strips_fbclid(self):
        url = "https://example.com/post?fbclid=abc123"
        normalised = normalize_url(url)
        assert "fbclid" not in normalised

    def test_strips_trailing_slash(self):
        a = normalize_url("https://example.com/page/")
        b = normalize_url("https://example.com/page")
        assert a == b

    def test_strips_fragment(self):
        a = normalize_url("https://example.com/page#section-1")
        b = normalize_url("https://example.com/page")
        assert a == b

    def test_lowercases_scheme_and_host(self):
        url = "HTTPS://Example.COM/Path"
        normalised = normalize_url(url)
        assert normalised.startswith("https://example.com")


# ── Duplicate URLs ────────────────────────────────────────────────────────────

class TestDuplicateUrls:
    """Test 11: Duplicate URLs are detected and removed."""

    def test_exact_duplicate_removed(self):
        a = _make_source("https://example.com/article", text="Some article text here.", source_id="src_a")
        b = _make_source("https://example.com/article", text="Same article text.", source_id="src_b")
        unique, dupes = deduplicate_sources([a, b])
        assert len(unique) == 1
        assert len(dupes) == 1

    def test_tracking_param_duplicate(self):
        """Test 13: URLs with tracking params that resolve to same content."""
        a = _make_source("https://example.com/post", text="Article content here.", source_id="src_a")
        b = _make_source(
            "https://example.com/post?utm_source=twitter",
            text="Article content here.",
            source_id="src_b"
        )
        unique, dupes = deduplicate_sources([a, b])
        assert len(unique) == 1

    def test_first_occurrence_wins(self):
        a = _make_source("https://example.com/page", text="Content A", source_id="src_a")
        b = _make_source("https://example.com/page", text="Content B", source_id="src_b")
        unique, _ = deduplicate_sources([a, b])
        assert unique[0].metadata.source_id == "src_a"


# ── Duplicate content ─────────────────────────────────────────────────────────

class TestDuplicateContent:
    """Test 12: Identical content from different URLs is deduplicated."""

    def test_same_hash_different_url(self):
        text = "Identical article content that appears on multiple URLs."
        a = _make_source("https://site-a.com/article", text=text, source_id="src_a")
        b = _make_source("https://site-b.com/article", text=text, source_id="src_b")
        unique, dupes = deduplicate_sources([a, b])
        assert len(unique) == 1
        assert len(dupes) == 1
        assert dupes[0].reason == "content_hash"

    def test_different_content_not_deduped(self):
        a = _make_source("https://a.com/", text="Article about Python programming.", source_id="src_a")
        b = _make_source("https://b.com/", text="Article about JavaScript frameworks.", source_id="src_b")
        unique, dupes = deduplicate_sources([a, b])
        assert len(unique) == 2
        assert len(dupes) == 0


# ── Canonical URL ─────────────────────────────────────────────────────────────

class TestCanonicalDedup:
    def test_same_canonical_url_deduped(self):
        a = _make_source(
            "https://m.example.com/article",
            canonical_url="https://www.example.com/article",
            text="Mobile version text.",
            source_id="src_a",
        )
        b = _make_source(
            "https://www.example.com/article",
            canonical_url="https://www.example.com/article",
            text="Desktop version text.",
            source_id="src_b",
        )
        unique, dupes = deduplicate_sources([a, b])
        assert len(unique) == 1
        assert len(dupes) == 1

    def test_different_canonical_not_deduped(self):
        a = _make_source(
            "https://example.com/article-1",
            canonical_url="https://example.com/article-1",
            text="First article.",
            source_id="src_a",
        )
        b = _make_source(
            "https://example.com/article-2",
            canonical_url="https://example.com/article-2",
            text="Second article.",
            source_id="src_b",
        )
        unique, _ = deduplicate_sources([a, b])
        assert len(unique) == 2


# ── Empty list ────────────────────────────────────────────────────────────────

class TestEmptyInput:
    def test_empty_list_returns_empty(self):
        unique, dupes = deduplicate_sources([])
        assert unique == []
        assert dupes == []
