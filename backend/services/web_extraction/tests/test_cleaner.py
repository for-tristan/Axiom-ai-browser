"""
Tests for cleaner.py — text cleaning service.
"""

from __future__ import annotations

import pytest

from app.services.cleaner import clean_description, clean_text, clean_title


class TestCleanText:
    def test_removes_artifacts(self):
        text = "This is an article. Share this article. More content."
        cleaned = clean_text(text)
        assert "Share this article" not in cleaned
        assert "More content" in cleaned

    def test_collapses_blank_lines(self):
        text = "Line 1\n\n\n\n\nLine 2"
        cleaned = clean_text(text)
        assert "\n\n\n" not in cleaned

    def test_removes_duplicate_lines(self):
        text = "Same line\nSame line\nDifferent line"
        cleaned = clean_text(text)
        lines = [l for l in cleaned.splitlines() if l]
        same_lines = [l for l in lines if l == "Same line"]
        assert len(same_lines) == 1

    def test_preserves_paragraph_boundaries(self):
        text = "Paragraph one.\n\nParagraph two.\n\nParagraph three."
        cleaned = clean_text(text)
        assert "\n\n" in cleaned

    def test_removes_control_characters(self):
        text = "Normal text\x01\x02\x03 more text"
        cleaned = clean_text(text)
        assert "\x01" not in cleaned
        assert "\x02" not in cleaned
        assert "Normal text" in cleaned

    def test_normalises_line_endings(self):
        text = "Line 1\r\nLine 2\rLine 3\n"
        cleaned = clean_text(text)
        assert "\r" not in cleaned

    def test_empty_string(self):
        assert clean_text("") == ""

    def test_preserves_headings(self):
        text = "# Introduction\n\nSome content here.\n\n## Details\n\nMore details."
        cleaned = clean_text(text)
        assert "Introduction" in cleaned
        assert "Details" in cleaned

    def test_preserves_lists(self):
        text = "Items:\n- Item one\n- Item two\n- Item three"
        cleaned = clean_text(text)
        assert "Item one" in cleaned
        assert "Item two" in cleaned

    def test_removes_cookie_banner(self):
        text = "Article content. Accept all cookies. More content."
        cleaned = clean_text(text)
        assert "Accept all cookies" not in cleaned
        assert "Article content" in cleaned

    def test_removes_newsletter_cta(self):
        text = "Good article. Subscribe to our newsletter. The end."
        cleaned = clean_text(text)
        assert "Subscribe to our newsletter" not in cleaned


class TestCleanTitle:
    def test_strips_whitespace(self):
        assert clean_title("  Hello World  ") == "Hello World"

    def test_collapses_internal_spaces(self):
        assert clean_title("Hello   World") == "Hello World"

    def test_none_returns_none(self):
        assert clean_title(None) is None

    def test_empty_returns_none(self):
        assert clean_title("") is None

    def test_normal_title_unchanged(self):
        assert clean_title("Paris - Wikipedia") == "Paris - Wikipedia"


class TestCleanDescription:
    def test_collapses_whitespace(self):
        desc = "A   very   long   description."
        assert clean_description(desc) == "A very long description."

    def test_none_returns_none(self):
        assert clean_description(None) is None

    def test_empty_returns_none(self):
        assert clean_description("") is None
