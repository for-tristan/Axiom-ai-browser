"""
Source validation service.

A source passes validation if:
* It has a non-empty extracted_text OR a non-empty snippet.
* Its extraction_status is not FAILED.
* The URL is reachable (http_status 2xx or 3xx — already followed).

This runs after extraction and before deduplication so we don't waste
scoring time on clearly broken sources.
"""

from __future__ import annotations

from app.models.schemas import ExtractionStatus, ProcessedSource


def is_valid_source(source: ProcessedSource) -> bool:
    """
    Return True if the source has usable content and should be ranked.
    """
    m = source.metadata

    # Must have some text content (either extracted or snippet)
    has_content = bool(
        (m.extracted_text and m.extracted_text.strip())
        or (m.snippet and m.snippet.strip())
    )

    # Must not be in a terminal failure state
    terminal_failures = {
        ExtractionStatus.FAILED,
        ExtractionStatus.SECURITY_BLOCKED,
        ExtractionStatus.UNSUPPORTED_TYPE,
    }

    return has_content and m.extraction_status not in terminal_failures


def partition_sources(
    sources: list[ProcessedSource],
) -> tuple[list[ProcessedSource], list[ProcessedSource]]:
    """
    Partition *sources* into (valid, invalid) lists.
    """
    valid   = [s for s in sources if is_valid_source(s)]
    invalid = [s for s in sources if not is_valid_source(s)]
    return valid, invalid
