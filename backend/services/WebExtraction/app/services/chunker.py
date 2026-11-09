"""
RAG-ready chunking service.

Chunks extracted text into overlapping segments for future retrieval-augmented
generation pipelines.  No embedding, vector store, or LLM is used here.

Chunking strategy
-----------------
1. Split the text on paragraph boundaries (double newlines).
2. Try to keep each chunk within ``chunk_size`` characters.
3. If a paragraph is longer than ``chunk_size``, split it on sentence
   boundaries (the _split_sentences helper) and pack greedily.
4. Apply a character overlap between consecutive chunks so context is not
   lost at chunk boundaries.
5. Each chunk records the section heading that was most recently seen before
   the chunk starts (extracted from lines that look like "# Heading").

Every chunk is fully attributed: ``source_id`` + ``source_url`` tie it back
to the originating page.
"""

from __future__ import annotations

import re
import uuid
from typing import List, Optional

from app.models.schemas import ContentChunk
from app.utils.text_utils import estimate_tokens, split_sentences


# ── Heading detection ─────────────────────────────────────────────────────────

_HEADING_RE = re.compile(r"^#{1,3}\s+(.+)$", re.MULTILINE)
_HEADING_LINE_RE = re.compile(r"^#{1,3}\s+")

def _is_heading_line(line: str) -> bool:
    return bool(_HEADING_LINE_RE.match(line.strip()))

def _heading_text(line: str) -> str:
    return _HEADING_LINE_RE.sub("", line).strip()


# ── Paragraph splitting ───────────────────────────────────────────────────────

def _split_paragraphs(text: str) -> List[str]:
    """Split on one or more blank lines, returning non-empty paragraphs."""
    return [p.strip() for p in re.split(r"\n{2,}", text) if p.strip()]


# ── Core chunking ─────────────────────────────────────────────────────────────

def _pack_chunks(
    paragraphs: List[str],
    chunk_size: int,
    chunk_overlap: int,
) -> List[tuple[str, Optional[str]]]:
    """
    Pack paragraphs into (chunk_text, section_heading) tuples.

    Returns a list of (text, heading) tuples.
    """
    chunks: List[tuple[str, Optional[str]]] = []
    current_parts: List[str]  = []
    current_len: int          = 0
    current_heading: Optional[str] = None
    overlap_buffer: str       = ""

    for para in paragraphs:
        # Track section heading
        if _is_heading_line(para):
            current_heading = _heading_text(para)

        # If this paragraph alone exceeds chunk_size, sentence-split it
        if len(para) > chunk_size:
            # First flush what we have
            if current_parts:
                chunk_text = "\n\n".join(current_parts)
                if overlap_buffer:
                    chunk_text = overlap_buffer + "\n\n" + chunk_text
                chunks.append((chunk_text.strip(), current_heading))
                # Prepare overlap from the tail of the current chunk
                overlap_buffer = _tail_chars(chunk_text, chunk_overlap)
                current_parts  = []
                current_len    = 0

            sentences = split_sentences(para)
            sent_buf: List[str] = []
            sent_len = 0
            for sent in sentences:
                if sent_len + len(sent) + 1 > chunk_size and sent_buf:
                    chunk_text = " ".join(sent_buf)
                    if overlap_buffer:
                        chunk_text = overlap_buffer + " " + chunk_text
                    chunks.append((chunk_text.strip(), current_heading))
                    overlap_buffer = _tail_chars(chunk_text, chunk_overlap)
                    sent_buf = []
                    sent_len = 0
                sent_buf.append(sent)
                sent_len += len(sent) + 1
            if sent_buf:
                chunk_text = " ".join(sent_buf)
                if overlap_buffer:
                    chunk_text = overlap_buffer + " " + chunk_text
                chunks.append((chunk_text.strip(), current_heading))
                overlap_buffer = _tail_chars(chunk_text, chunk_overlap)
            continue

        # Normal paragraph: add to current chunk
        if current_len + len(para) + 2 > chunk_size and current_parts:
            # Flush
            chunk_text = "\n\n".join(current_parts)
            if overlap_buffer:
                chunk_text = overlap_buffer + "\n\n" + chunk_text
            chunks.append((chunk_text.strip(), current_heading))
            overlap_buffer = _tail_chars(chunk_text, chunk_overlap)
            current_parts  = []
            current_len    = 0

        current_parts.append(para)
        current_len += len(para) + 2

    # Final flush
    if current_parts:
        chunk_text = "\n\n".join(current_parts)
        if overlap_buffer:
            chunk_text = overlap_buffer + "\n\n" + chunk_text
        chunks.append((chunk_text.strip(), current_heading))

    return chunks


def _tail_chars(text: str, n: int) -> str:
    """Return the last *n* characters of *text* (or less if shorter)."""
    if n <= 0 or not text:
        return ""
    return text[-n:]


# ── Public API ────────────────────────────────────────────────────────────────

def chunk_text(
    text: str,
    source_id: str,
    source_url: str,
    chunk_size: int   = 1000,
    chunk_overlap: int = 200,
) -> List[ContentChunk]:
    """
    Split *text* into overlapping, paragraph-aware ContentChunk objects.

    Parameters
    ----------
    text         : Full extracted article text.
    source_id    : Identifier of the originating ProcessedSource.
    source_url   : URL of the originating page.
    chunk_size   : Target maximum characters per chunk.
    chunk_overlap: Characters of overlap between consecutive chunks.

    Returns
    -------
    List of ContentChunk objects (may be empty if text is empty).
    """
    if not text or not text.strip():
        return []

    paragraphs = _split_paragraphs(text)
    if not paragraphs:
        return []

    raw_chunks = _pack_chunks(paragraphs, chunk_size, chunk_overlap)

    chunks: List[ContentChunk] = []
    position = 0

    for idx, (chunk_text_content, section_heading) in enumerate(raw_chunks):
        if not chunk_text_content.strip():
            continue

        start = text.find(chunk_text_content[:min(50, len(chunk_text_content))], max(0, position - 10))
        if start == -1:
            start = position
        end = start + len(chunk_text_content)

        chunks.append(ContentChunk(
            chunk_id       = str(uuid.uuid4()),
            source_id      = source_id,
            chunk_index    = idx,
            section_title  = section_heading,
            content        = chunk_text_content,
            start_position = start,
            end_position   = end,
            token_estimate = estimate_tokens(chunk_text_content),
            source_url     = source_url,
        ))
        position = end

    return chunks
