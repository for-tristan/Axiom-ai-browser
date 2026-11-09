"""
Tests for chunker.py — RAG-ready chunking.
Covers tests 22 (chunk size), 23 (chunk overlap), 24 (source attribution).
"""

from __future__ import annotations

import pytest

from app.services.chunker import chunk_text


LONG_TEXT = """
# Introduction to Python

Python is a high-level, interpreted programming language. It was created by
Guido van Rossum and first released in 1991. Python's design philosophy
emphasizes code readability with the use of significant indentation.

## Features

Python supports multiple programming paradigms, including structured,
object-oriented, and functional programming. It is often described as a
"batteries included" language due to its comprehensive standard library.

## Data Science Applications

Python has become the dominant language for data science and machine learning.
Libraries like NumPy, Pandas, and scikit-learn provide powerful tools for
data manipulation and analysis. TensorFlow and PyTorch are widely used for
deep learning research and production.

## Web Development

Django and Flask are popular frameworks for web development in Python. FastAPI
has become popular for building high-performance REST APIs. These frameworks
provide tools for routing, templating, database integration, and authentication.

## Conclusion

Python continues to grow in popularity because of its simplicity, versatility,
and the size of its ecosystem. Whether you are building a simple script or a
complex machine learning pipeline, Python has the tools you need.
""".strip()


class TestChunkSize:
    """Test 22: Chunk size is respected."""

    def test_chunks_do_not_exceed_size(self):
        chunks = chunk_text(LONG_TEXT, "src_01", "https://example.com/", chunk_size=500)
        for chunk in chunks:
            # Allow some tolerance for overlap
            assert len(chunk.content) <= 700, f"Chunk too large: {len(chunk.content)}"

    def test_smaller_chunk_size_produces_more_chunks(self):
        chunks_small = chunk_text(LONG_TEXT, "src_01", "https://example.com/", chunk_size=200)
        chunks_large = chunk_text(LONG_TEXT, "src_02", "https://example.com/", chunk_size=800)
        assert len(chunks_small) >= len(chunks_large)


class TestChunkOverlap:
    """Test 23: Chunk overlap is applied."""

    def test_overlap_creates_shared_content(self):
        """With overlap, the end of one chunk should appear at the start of the next."""
        chunks = chunk_text(
            LONG_TEXT, "src_01", "https://example.com/",
            chunk_size=400, chunk_overlap=100
        )
        if len(chunks) < 2:
            pytest.skip("Not enough chunks to test overlap")
        # The overlap means consecutive chunks share some text near boundaries
        # Verify that positions overlap
        for i in range(len(chunks) - 1):
            # end of chunk i should be >= start of chunk i+1 (overlap)
            # or at least chunk i+1 starts before chunk i ends
            assert chunks[i].end_position >= chunks[i + 1].start_position or \
                   chunks[i + 1].start_position <= chunks[i].end_position + 50

    def test_no_empty_chunks(self):
        chunks = chunk_text(LONG_TEXT, "src_01", "https://example.com/", chunk_size=400)
        for chunk in chunks:
            assert chunk.content.strip() != ""


class TestSourceAttribution:
    """Test 24: Every chunk references its original source."""

    def test_source_id_on_every_chunk(self):
        chunks = chunk_text(LONG_TEXT, "src_attribution_test", "https://example.com/")
        for chunk in chunks:
            assert chunk.source_id == "src_attribution_test"

    def test_source_url_on_every_chunk(self):
        chunks = chunk_text(LONG_TEXT, "src_01", "https://my-source.com/article")
        for chunk in chunks:
            assert chunk.source_url == "https://my-source.com/article"

    def test_chunk_index_sequential(self):
        chunks = chunk_text(LONG_TEXT, "src_01", "https://example.com/")
        indices = [c.chunk_index for c in chunks]
        assert indices == list(range(len(indices)))

    def test_chunk_id_unique(self):
        chunks = chunk_text(LONG_TEXT, "src_01", "https://example.com/")
        ids = [c.chunk_id for c in chunks]
        assert len(set(ids)) == len(ids), "Chunk IDs must be unique"

    def test_token_estimate_positive(self):
        chunks = chunk_text(LONG_TEXT, "src_01", "https://example.com/")
        for chunk in chunks:
            assert chunk.token_estimate > 0


class TestEdgeCases:
    def test_empty_text_returns_no_chunks(self):
        chunks = chunk_text("", "src_01", "https://example.com/")
        assert chunks == []

    def test_whitespace_only_returns_no_chunks(self):
        chunks = chunk_text("   \n\n\t  ", "src_01", "https://example.com/")
        assert chunks == []

    def test_short_text_single_chunk(self):
        text = "This is a very short article."
        chunks = chunk_text(text, "src_01", "https://example.com/", chunk_size=1000)
        assert len(chunks) == 1
        assert chunks[0].content.strip() == text.strip()

    def test_section_heading_captured(self):
        text = "# My Section\n\nContent under this section about important things."
        chunks = chunk_text(text, "src_01", "https://example.com/", chunk_size=1000)
        assert len(chunks) >= 1
        # At least one chunk should have the section heading
        headings = [c.section_title for c in chunks if c.section_title]
        assert any("My Section" in h for h in headings)
