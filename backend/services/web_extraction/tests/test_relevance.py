"""
Tests for relevance.py — relevance scoring and ranking.
"""

from __future__ import annotations

import pytest

from app.models.schemas import ExtractionMethod, ExtractionStatus, ProcessedSource, SourceMetadata
from app.services.relevance import rank_sources, score_source


def _make_source(
    url: str = "https://example.com/",
    title: str = "",
    description: str = "",
    text: str = "",
    snippet: str = "",
    word_count: int = 100,
    method: ExtractionMethod = ExtractionMethod.BEAUTIFULSOUP,
    http_status: int = 200,
    source_id: str = "src_test",
) -> ProcessedSource:
    m = SourceMetadata(
        source_id        = source_id,
        original_url     = url,
        final_url        = url,
        title            = title or None,
        description      = description or None,
        extracted_text   = text or None,
        snippet          = snippet,
        word_count       = word_count,
        extraction_method = method,
        extraction_status = ExtractionStatus.SUCCESS,
        http_status      = http_status,
    )
    return ProcessedSource(metadata=m)


class TestScoreSource:
    def test_high_relevance_title_match(self):
        src = _make_source(
            title="Python programming tutorial",
            text="Python is a great programming language for beginners.",
            source_id="src_a",
        )
        score = score_source(src, "Python programming")
        assert score.relevance_score > 50.0

    def test_low_relevance_unrelated(self):
        src = _make_source(
            title="Chocolate cake recipe",
            text="This chocolate cake is delicious. Mix flour sugar and cocoa.",
            source_id="src_b",
        )
        score = score_source(src, "Python programming")
        assert score.relevance_score < 50.0

    def test_score_range_0_100(self):
        src = _make_source(
            title="Completely irrelevant content",
            text="Something totally unrelated to anything you asked.",
            source_id="src_c",
        )
        score = score_source(src, "quantum physics")
        assert 0.0 <= score.relevance_score <= 100.0
        assert 0.0 <= score.final_score <= 100.0
        assert 0.0 <= score.content_quality_score <= 100.0

    def test_explanation_non_empty(self):
        src = _make_source(title="Test title", text="Test content.", source_id="src_d")
        score = score_source(src, "test query")
        assert score.relevance_explanation

    def test_no_query_returns_neutral(self):
        src = _make_source(title="Test", text="Content", source_id="src_e")
        score = score_source(src, "")
        # Should not crash; returns neutral scores
        assert score.final_score >= 0.0


class TestRankSources:
    def test_ranks_by_relevance(self):
        relevant = _make_source(
            title="Python tutorial",
            text="Python programming is used for data science and web development.",
            source_id="src_relevant",
        )
        irrelevant = _make_source(
            title="Gardening tips",
            text="Water your plants regularly for best results in the garden.",
            source_id="src_irrelevant",
        )
        ranked = rank_sources([irrelevant, relevant], "Python programming")
        assert ranked[0].metadata.source_id == "src_relevant"

    def test_ranking_positions_assigned(self):
        sources = [
            _make_source(title="First", text="Python data science.", source_id="src_1"),
            _make_source(title="Second", text="JavaScript web dev.", source_id="src_2"),
            _make_source(title="Third", text="Rust systems programming.", source_id="src_3"),
        ]
        ranked = rank_sources(sources, "Python")
        positions = [s.scores.ranking_position for s in ranked if s.scores]
        assert sorted(positions) == list(range(1, len(ranked) + 1))

    def test_empty_list_returns_empty(self):
        assert rank_sources([], "query") == []

    def test_single_source_ranked(self):
        src = _make_source(title="Only source", text="Content.", source_id="src_only")
        ranked = rank_sources([src], "query")
        assert len(ranked) == 1
        assert ranked[0].scores is not None
        assert ranked[0].scores.ranking_position == 1
