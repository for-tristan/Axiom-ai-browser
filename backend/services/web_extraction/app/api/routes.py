"""
FastAPI routes for Task 3 — Web Extraction & Source Processing.

Endpoints
---------
GET  /health           → service liveness check
POST /extract          → extract content from one or more URLs
POST /process-sources  → full pipeline: validate → fetch → extract →
                         clean → dedup → rank → chunk

Security
--------
* Every URL is validated through url_security.validate_url before fetching.
* Stack traces and secrets are never returned to clients.
* Request bodies are size-limited by FastAPI's default body limit.
"""

from __future__ import annotations

import asyncio
import logging
import time
import uuid
from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException, Request, status

from app.config import get_settings
from app.models.schemas import (
    ContentChunk,
    DuplicateInfo,
    ExtractionRequest,
    ExtractionResponse,
    ExtractionStatus,
    HealthResponse,
    ProcessedSource,
    ProcessSourcesRequest,
    ProcessSourcesResponse,
    ProcessingStats,
    SourceMetadata,
)
from app.services.chunker import chunk_text
from app.services.cleaner import clean_description, clean_text, clean_title
from app.services.deduplicator import deduplicate_sources
from app.services.extractor import extract_content
from app.services.fetcher import FetchResult, fetch_urls
from app.services.metadata import build_failed_metadata, build_metadata
from app.services.relevance import rank_sources
from app.services.validator import partition_sources
from app.utils.url_security import SecurityError, validate_url

logger = logging.getLogger(__name__)
router = APIRouter()
settings = get_settings()


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_source_id() -> str:
    return f"src_{uuid.uuid4().hex[:12]}"


async def _process_url_list(
    urls: List[str],
    query: str | None,
    include_chunks: bool,
    snippets: Dict[str, str] | None = None,
    search_ranks: Dict[str, int] | None = None,
    search_sources: Dict[str, str] | None = None,
) -> tuple[List[ProcessedSource], List[SourceMetadata], List[ContentChunk]]:
    """
    Core processing pipeline for a list of URLs.

    Returns (processed_sources, failed_sources, chunks).
    """
    snippets       = snippets       or {}
    search_ranks   = search_ranks   or {}
    search_sources = search_sources or {}

    # 1. Security pre-validation
    safe_urls: List[str]      = []
    pre_failed: List[SourceMetadata] = []

    for url in urls:
        source_id = _make_source_id()
        try:
            validate_url(url)
            safe_urls.append(url)
        except SecurityError as exc:
            pre_failed.append(build_failed_metadata(
                source_id    = source_id,
                url          = url,
                error        = str(exc),
                snippet      = snippets.get(url, ""),
                search_rank  = search_ranks.get(url, 0),
                search_source = search_sources.get(url, ""),
            ))

    if not safe_urls:
        return [], pre_failed, []

    # 2. Fetch
    fetch_results: List[FetchResult] = await fetch_urls(safe_urls)

    # 3. Extract → Clean → Build metadata
    processed: List[ProcessedSource] = []
    post_failed: List[SourceMetadata] = []

    for fetch_result in fetch_results:
        source_id = _make_source_id()
        url = fetch_result.original_url

        # Extraction
        extraction = extract_content(fetch_result)

        # Cleaning
        if extraction.text:
            extraction.text = clean_text(extraction.text)
        if extraction.title:
            extraction.title = clean_title(extraction.title)
        if extraction.description:
            extraction.description = clean_description(extraction.description)

        # Build metadata
        meta = build_metadata(
            source_id        = source_id,
            fetch_result     = fetch_result,
            extraction_result = extraction,
            snippet          = snippets.get(url, ""),
            search_rank      = search_ranks.get(url, 0),
            search_source    = search_sources.get(url, ""),
        )

        src = ProcessedSource(metadata=meta)

        if extraction.status in (
            ExtractionStatus.FAILED,
            ExtractionStatus.SECURITY_BLOCKED,
            ExtractionStatus.HTTP_ERROR,
        ) or not fetch_result.success:
            post_failed.append(meta)
        else:
            processed.append(src)

    # 4. Collect chunks
    all_chunks: List[ContentChunk] = []
    if include_chunks:
        cfg = get_settings()
        for src in processed:
            text = src.metadata.extracted_text or ""
            if text:
                chunks = chunk_text(
                    text       = text,
                    source_id  = src.metadata.source_id,
                    source_url = src.metadata.final_url or src.metadata.original_url,
                    chunk_size  = cfg.chunk_size,
                    chunk_overlap = cfg.chunk_overlap,
                )
                all_chunks.extend(chunks)

    return processed, pre_failed + post_failed, all_chunks


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Service health check",
    tags=["Health"],
)
async def health() -> HealthResponse:
    """Return current service health status."""
    cfg = get_settings()
    return HealthResponse(
        status      = "ok",
        service     = cfg.app_name,
        version     = "3.0.0",
        environment = cfg.environment,
    )


@router.post(
    "/extract",
    response_model=ExtractionResponse,
    summary="Extract content from one or more URLs",
    tags=["Extraction"],
    status_code=status.HTTP_200_OK,
)
async def extract(request: ExtractionRequest) -> ExtractionResponse:
    """
    Accepts a list of URLs, fetches them, extracts main content, and
    returns structured source objects with optional RAG chunks.
    """
    cfg = get_settings()

    if len(request.urls) > cfg.max_urls_per_request:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"Too many URLs. Maximum is {cfg.max_urls_per_request}.",
        )

    t0 = time.monotonic()

    processed, failed, chunks = await _process_url_list(
        urls          = request.urls,
        query         = request.query,
        include_chunks = request.include_chunks,
    )

    # Score if query provided
    if request.query and processed:
        processed = rank_sources(processed, request.query)

    elapsed = round(time.monotonic() - t0, 3)

    stats = ProcessingStats(
        total_requested       = len(request.urls),
        successfully_fetched  = sum(1 for s in processed if s.metadata.http_status and s.metadata.http_status < 400),
        successfully_extracted = len(processed),
        failed                = len(failed),
        duplicates_removed    = 0,
        total_chunks          = len(chunks),
        processing_time_seconds = elapsed,
    )

    return ExtractionResponse(
        query            = request.query,
        processed_sources = processed,
        failed_sources   = failed,
        chunks           = chunks,
        stats            = stats,
    )


@router.post(
    "/process-sources",
    response_model=ProcessSourcesResponse,
    summary="Full pipeline: search results → processed, ranked, chunked sources",
    tags=["Processing"],
    status_code=status.HTTP_200_OK,
)
async def process_sources(request: ProcessSourcesRequest) -> ProcessSourcesResponse:
    """
    The main integration endpoint.

    Accepts the user query and search results from Task 2, runs the full
    extraction pipeline, and returns ranked, deduplicated sources with
    RAG chunks and a pre-formatted ``task1_pages`` list ready for Task 1's
    ``answer_with_citations``.

    Task 2 → Task 3 input format
    ----------------------------
    Each item in ``search_results`` maps directly from Task 2's
    ``SearchResult`` dataclass:
        {title, url, snippet, source, rank, content}

    Task 3 → Task 1 output format
    ------------------------------
    ``task1_pages`` is a list of ``{title, url, content}`` dicts exactly as
    expected by ``answer_generator.answer_with_citations``.
    """
    cfg = get_settings()
    t0  = time.monotonic()

    # Apply max_sources cap
    search_results = request.search_results
    if request.max_sources:
        search_results = search_results[: request.max_sources]

    if len(search_results) > cfg.max_urls_per_request:
        search_results = search_results[: cfg.max_urls_per_request]

    urls          = [sr.url for sr in search_results]
    snippets      = {sr.url: sr.snippet       for sr in search_results}
    search_ranks  = {sr.url: sr.rank          for sr in search_results}
    search_srcs   = {sr.url: sr.source        for sr in search_results}

    # If Task 2 already fetched content, we can use it as a fallback
    prefetched: Dict[str, str] = {
        sr.url: sr.content
        for sr in search_results
        if sr.content
    }

    # Run the full pipeline
    processed, failed, chunks = await _process_url_list(
        urls          = urls,
        query         = request.query,
        include_chunks = request.include_chunks,
        snippets      = snippets,
        search_ranks  = search_ranks,
        search_sources = search_srcs,
    )

    # Inject pre-fetched content where our extractor got nothing
    for src in processed:
        url = src.metadata.original_url
        if not src.metadata.extracted_text and url in prefetched:
            src.metadata.extracted_text = prefetched[url]
            src.metadata.word_count = len(prefetched[url].split())

    # Deduplication
    unique_sources, duplicates = deduplicate_sources(processed)

    # Validation partition
    valid_sources, invalid_sources = partition_sources(unique_sources)
    failed += [s.metadata for s in invalid_sources]

    # Relevance scoring + ranking
    ranked = rank_sources(valid_sources, request.query)

    # Additional chunking for valid sources not yet chunked
    if request.include_chunks:
        already_chunked_ids = {c.source_id for c in chunks}
        for src in ranked:
            if src.metadata.source_id in already_chunked_ids:
                continue
            text = src.metadata.extracted_text or ""
            if text:
                new_chunks = chunk_text(
                    text       = text,
                    source_id  = src.metadata.source_id,
                    source_url = src.metadata.final_url or src.metadata.original_url,
                    chunk_size  = cfg.chunk_size,
                    chunk_overlap = cfg.chunk_overlap,
                )
                chunks.extend(new_chunks)

    elapsed = round(time.monotonic() - t0, 3)

    stats = ProcessingStats(
        total_requested        = len(search_results),
        successfully_fetched   = sum(1 for s in processed if s.metadata.http_status and s.metadata.http_status < 400),
        successfully_extracted = len(valid_sources),
        failed                 = len(failed),
        duplicates_removed     = len(duplicates),
        total_chunks           = len(chunks),
        processing_time_seconds = elapsed,
    )

    # Pre-format for Task 1
    task1_pages = [src.to_task1_page() for src in ranked]

    return ProcessSourcesResponse(
        query             = request.query,
        processed_sources = valid_sources,
        failed_sources    = failed,
        duplicates        = duplicates,
        ranked_sources    = ranked,
        chunks            = chunks,
        stats             = stats,
        task1_pages       = task1_pages,
    )
