"""
Metadata builder — assembles a SourceMetadata object from raw fetch and
extraction results.

No network calls, no fabrication.  Every field that cannot be derived from
the actual page is left as None.
"""

from __future__ import annotations

from urllib.parse import urlparse

from app.models.schemas import ExtractionStatus, SourceMetadata
from app.services.extractor import ExtractionResult
from app.services.fetcher import FetchResult


def build_metadata(
    source_id: str,
    fetch_result: FetchResult,
    extraction_result: ExtractionResult,
    snippet: str = "",
    search_rank: int = 0,
    search_source: str = "",
) -> SourceMetadata:
    """
    Combine a FetchResult and ExtractionResult into a SourceMetadata record.

    Parameters
    ----------
    source_id        : Unique identifier for this source (assigned by the pipeline).
    fetch_result     : Raw HTTP fetch outcome.
    extraction_result: Content extraction outcome.
    snippet          : Short description from Task 2 (fallback text).
    search_rank      : Position in the original search result list.
    search_source    : Name of the search provider ("duckduckgo", "brave", …).

    Returns
    -------
    SourceMetadata Pydantic model.
    """
    original_url = fetch_result.original_url
    final_url    = fetch_result.final_url or original_url

    # Domain from final URL
    try:
        domain = urlparse(final_url).netloc or urlparse(original_url).netloc
    except Exception:
        domain = ""

    return SourceMetadata(
        source_id        = source_id,
        original_url     = original_url,
        final_url        = final_url,
        canonical_url    = extraction_result.canonical_url,
        title            = extraction_result.title,
        description      = extraction_result.description,
        domain           = domain,
        author           = extraction_result.author,
        published_date   = extraction_result.published_date,
        last_modified    = None,                      # not reliably available
        language         = extraction_result.language,
        http_status      = fetch_result.status_code,
        content_type     = fetch_result.content_type,
        extracted_text   = extraction_result.text or None,
        word_count       = extraction_result.word_count,
        extraction_method = extraction_result.method,
        extraction_status = extraction_result.status,
        fetch_timestamp  = fetch_result.fetch_timestamp,
        error_message    = fetch_result.error,
        snippet          = snippet,
        search_rank      = search_rank,
        search_source    = search_source,
    )


def build_failed_metadata(
    source_id: str,
    url: str,
    error: str,
    snippet: str = "",
    search_rank: int = 0,
    search_source: str = "",
) -> SourceMetadata:
    """
    Build a SourceMetadata for a URL that failed security validation
    before fetching even started.
    """
    try:
        domain = urlparse(url).netloc
    except Exception:
        domain = ""

    return SourceMetadata(
        source_id        = source_id,
        original_url     = url,
        final_url        = url,
        domain           = domain,
        extraction_status = ExtractionStatus.SECURITY_BLOCKED,
        error_message    = error,
        snippet          = snippet,
        search_rank      = search_rank,
        search_source    = search_source,
    )
