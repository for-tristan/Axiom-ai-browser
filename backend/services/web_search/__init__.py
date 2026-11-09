"""Axiom — Web Search & Query Intelligence (Task 2).

Public API:
    from backend.services.web_search import search_for_pages, search_for_answer

    # Task 2 alone — returns source pages for the answer generator:
    pages = search_for_pages("What is the capital of France?")
    # -> [{"title": ..., "url": ..., "content": ...}, ...]

    # Task 2 + Task 1 wired together — returns a full answer + citations:
    result = search_for_answer("What is the capital of France?")
    # -> {"answer": "...", "citations": [...], "sources": [...]}

The page dict shape (title / url / content) matches exactly what
backend/services/ai_chat/answer_generator.py expects, so Task 2 and
Task 1 compose with no glue code.
"""

# Dual-import: works both as a package (backend.services.web_search)
# and standalone from inside the folder (like the ai_chat convention).
try:
    from .pipeline import search_for_pages, search_for_answer
    from .query_intelligence import (
        classify_query,
        is_search_needed,
        refine_query,
        split_query,
        analyze,
        QueryIntent,
    )
    from .result import SearchResult
    from .search_providers import (
        SearchProvider,
        DuckDuckGoProvider,
        BraveSearchProvider,
        get_provider,
        SearchProviderError,
    )
    from .extraction_bridge import fetch_page_content, fetch_page_title
except ImportError:  # pragma: no cover — standalone execution
    from pipeline import search_for_pages, search_for_answer
    from query_intelligence import (
        classify_query,
        is_search_needed,
        refine_query,
        split_query,
        analyze,
        QueryIntent,
    )
    from result import SearchResult
    from search_providers import (
        SearchProvider,
        DuckDuckGoProvider,
        BraveSearchProvider,
        get_provider,
        SearchProviderError,
    )
    from extraction_bridge import fetch_page_content, fetch_page_title

__all__ = [
    "search_for_pages",
    "search_for_answer",
    "classify_query",
    "is_search_needed",
    "refine_query",
    "split_query",
    "analyze",
    "QueryIntent",
    "SearchResult",
    "SearchProvider",
    "DuckDuckGoProvider",
    "BraveSearchProvider",
    "get_provider",
    "SearchProviderError",
    "fetch_page_content",
    "fetch_page_title",
]
