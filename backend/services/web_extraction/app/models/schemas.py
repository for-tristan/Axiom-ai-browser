"""
Pydantic schemas shared across all Task 3 components.

Design principles
-----------------
* Every field that may be absent from a real web page is ``Optional[X]``
  with a ``None`` default.  We never fabricate values.
* Field names deliberately match what Task 1 and Task 2 already use so
  the team-leader integration layer is minimal.
* The ``ProcessedSource`` → ``to_task1_page()`` helper produces exactly
  the ``{"title", "url", "content"}`` dict that Task 1's
  ``answer_generator.answer_with_citations`` expects.
* ``SearchResultInput`` accepts the ``SearchResult`` fields from Task 2's
  ``result.py`` dataclass, so Task 2 output can be forwarded here with no
  field renaming.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, HttpUrl, field_validator


# ── Enumerations ──────────────────────────────────────────────────────────────

class ExtractionStatus(str, Enum):
    SUCCESS           = "success"
    PARTIAL           = "partial"
    FAILED            = "failed"
    BLOCKED           = "blocked"
    EMPTY_CONTENT     = "empty_content"
    UNSUPPORTED_TYPE  = "unsupported_content_type"
    DYNAMIC_CONTENT   = "unsupported_dynamic_content"
    SECURITY_BLOCKED  = "security_blocked"
    TIMEOUT           = "timeout"
    HTTP_ERROR        = "http_error"


class ExtractionMethod(str, Enum):
    TRAFILATURA  = "trafilatura"
    BEAUTIFULSOUP = "beautifulsoup"
    FALLBACK     = "fallback"
    NONE         = "none"


# ── Input schemas ─────────────────────────────────────────────────────────────

class ExtractionRequest(BaseModel):
    """POST /extract — accept one or many URLs."""
    urls: List[str] = Field(..., min_length=1, description="One or more URLs to extract content from.")
    include_chunks: bool = Field(True, description="Whether to include RAG-ready chunks in the response.")
    query: Optional[str] = Field(None, description="Optional query context for relevance scoring.")

    @field_validator("urls")
    @classmethod
    def deduplicate_urls(cls, v: List[str]) -> List[str]:
        seen: list[str] = []
        for u in v:
            if u not in seen:
                seen.append(u)
        return seen


class SearchResultInput(BaseModel):
    """
    Mirrors Task 2's SearchResult dataclass so Task 2 output can be
    forwarded directly to POST /process-sources without any adaptation.

    Fields
    ------
    title   : search-result title (Task 2 field)
    url     : canonical destination URL (Task 2 field)
    snippet : short description shown by the search engine (Task 2 field)
    source  : provider name, e.g. "duckduckgo" / "brave" (Task 2 field)
    rank    : 1-based position in the search results list (Task 2 field)
    content : full page text, if Task 2 already fetched it (optional)
    """
    title: str = Field(..., description="Result title from the search engine.")
    url: str   = Field(..., description="Destination URL.")
    snippet: str = Field("", description="Short description / search snippet.")
    source: str  = Field("", description="Search provider name.")
    rank: int    = Field(0,  description="Position in search results (1-based).")
    content: Optional[str] = Field(None, description="Pre-fetched full text, if available.")


class ProcessSourcesRequest(BaseModel):
    """POST /process-sources — the main pipeline entry point."""
    query: str = Field(..., description="Original user query.")
    search_results: List[SearchResultInput] = Field(
        ..., min_length=1, description="Search results produced by Task 2."
    )
    include_chunks: bool = Field(True, description="Return RAG chunks in the response.")
    max_sources: Optional[int] = Field(
        None, ge=1, description="Limit processed sources; None = no limit."
    )


# ── Core data models ──────────────────────────────────────────────────────────

class SourceMetadata(BaseModel):
    """Rich metadata for one processed web source."""
    source_id: str
    original_url: str
    final_url: Optional[str]           = None
    canonical_url: Optional[str]       = None
    title: Optional[str]               = None
    description: Optional[str]         = None
    domain: Optional[str]              = None
    author: Optional[str]              = None
    published_date: Optional[str]      = None
    last_modified: Optional[str]       = None
    language: Optional[str]            = None
    http_status: Optional[int]         = None
    content_type: Optional[str]        = None
    extracted_text: Optional[str]      = None
    word_count: int                    = 0
    extraction_method: ExtractionMethod = ExtractionMethod.NONE
    extraction_status: ExtractionStatus = ExtractionStatus.FAILED
    fetch_timestamp: Optional[datetime] = None
    error_message: Optional[str]       = None
    # Task-2 passthrough fields
    snippet: str  = ""
    search_rank: int = 0
    search_source: str = ""


class RelevanceScore(BaseModel):
    """Scoring breakdown for a single source."""
    relevance_score: float    = Field(0.0, ge=0.0, le=100.0)
    content_quality_score: float = Field(0.0, ge=0.0, le=100.0)
    final_score: float        = Field(0.0, ge=0.0, le=100.0)
    ranking_position: int     = 0
    relevance_explanation: str = ""


class ProcessedSource(BaseModel):
    """A fully processed, ranked, and attributed source."""
    metadata: SourceMetadata
    scores: Optional[RelevanceScore] = None

    def to_task1_page(self) -> Dict[str, Any]:
        """
        Convert to the page dict that Task 1's answer_generator expects.

        Task 1 contract (from context_builder.py):
            {"title": str, "url": str, "content": str}

        Content priority: extracted_text → snippet → ""
        """
        content = (
            self.metadata.extracted_text
            or self.metadata.snippet
            or ""
        )
        return {
            "title":   self.metadata.title or self.metadata.original_url,
            "url":     self.metadata.final_url or self.metadata.original_url,
            "content": content,
        }


class ContentChunk(BaseModel):
    """A single RAG-ready text chunk."""
    chunk_id: str
    source_id: str
    chunk_index: int
    section_title: Optional[str] = None
    content: str
    start_position: int
    end_position: int
    token_estimate: int
    source_url: str


class DuplicateInfo(BaseModel):
    """Information about one detected duplicate."""
    duplicate_url: str
    canonical_url: str
    reason: str   # "url_normalized" | "canonical_url" | "content_hash" | "similarity"


class ProcessingStats(BaseModel):
    """Summary statistics for one /process-sources call."""
    total_requested: int    = 0
    successfully_fetched: int = 0
    successfully_extracted: int = 0
    failed: int             = 0
    duplicates_removed: int = 0
    total_chunks: int       = 0
    processing_time_seconds: float = 0.0


# ── Response schemas ──────────────────────────────────────────────────────────

class ExtractionResponse(BaseModel):
    """Response for POST /extract."""
    query: Optional[str]
    processed_sources: List[ProcessedSource]
    failed_sources: List[SourceMetadata]
    chunks: List[ContentChunk]
    stats: ProcessingStats


class ProcessSourcesResponse(BaseModel):
    """Response for POST /process-sources."""
    query: str
    processed_sources: List[ProcessedSource]
    failed_sources: List[SourceMetadata]
    duplicates: List[DuplicateInfo]
    ranked_sources: List[ProcessedSource]
    chunks: List[ContentChunk]
    stats: ProcessingStats
    # Convenience: pre-formatted for Task 1 consumption
    task1_pages: List[Dict[str, Any]]


class HealthResponse(BaseModel):
    """Response for GET /health."""
    status: str
    service: str
    version: str
    environment: str
