"""Search pipeline — the public entry point for Task 2.

This is what the rest of Axiom calls to turn a user's chat message into
a list of source pages that Task 1 (answer_generator) can answer from.

    from pipeline import search_for_pages
    pages = search_for_pages("What is the capital of France?")
    # pages == [{"title": ..., "url": ..., "content": ...}, ...]

Pipeline steps:
  1. classify the message (query_intelligence)
  2. if it doesn't need a search (greeting / chitchat), return []
  3. refine + optionally split into sub-queries
  4. run each sub-query through the search provider
  5. deduplicate by URL, keep the best snippet per URL
  6. fetch full page text via Task 3's extraction pipeline (extraction_bridge)
  7. return page dicts in the shape Task 1 expects

The output contract (title / url / content) matches exactly what
backend/services/ai_chat/answer_generator.py::answer_with_citations
expects, so the two tasks compose with no glue code.
"""

from __future__ import annotations

from typing import Optional

from query_intelligence import (
    analyze,
    is_search_needed,
    refine_query,
    split_query,
    extract_url,
)
from result import SearchResult
from search_providers import SearchProvider, SearchProviderError, get_provider
from extraction_bridge import fetch_page_content, fetch_page_title


def search_for_pages(
    question: str,
    max_results: int = 5,
    fetch_content: bool = True,
    provider: Optional[SearchProvider] = None,
) -> list[dict]:
    """Turn a user message into source pages for the answer generator.

    Args:
        question:      The raw user message from the chat.
        max_results:   Max number of distinct pages to return.
        fetch_content: If True (default), fetch full page text via the
                       content_fetcher bridge. Set False to return only
                       search snippets (faster, lower quality).
        provider:      A SearchProvider instance. If None, auto-selects
                       Brave (if BRAVE_API_KEY is set) else DuckDuckGo.

    Returns:
        List of dicts: {"title": str, "url": str, "content": str}.
        Empty list if the message does not need a search, or if the
        search returned nothing. Never raises for "no results" — only
        for genuine provider failures (SearchProviderError), which the
        caller can catch and surface to the user.
    """
    if not question or not question.strip():
        return []

    # 1) Decide whether to search at all.
    if not is_search_needed(question):
        return []

    # 2) If the user pasted a bare URL, skip the search engine and fetch
    #    that page directly — there's nothing to "search" for.
    direct_url = extract_url(question.strip())
    if direct_url:
        page = _url_to_page(direct_url, fetch_content)
        return [page] if page else []

    # 3) Refine + split compound questions.
    sub_queries = split_query(question)
    if not sub_queries:
        return []

    engine = provider or get_provider()

    # 4) Search each sub-query, merge, dedup by URL.
    seen: dict[str, SearchResult] = {}
    per_query_limit = max(3, max_results)
    for sq in sub_queries:
        try:
            hits = engine.search(sq, max_results=per_query_limit)
        except SearchProviderError:
            # If one sub-query fails, keep going — the others may still
            # return useful sources.
            continue
        for hit in hits:
            if hit.url and hit.url not in seen:
                seen[hit.url] = hit
            if len(seen) >= max_results:
                break
        if len(seen) >= max_results:
            break

    if not seen:
        return []

    # 5) Optionally fetch full page text, then convert to page dicts.
    pages: list[dict] = []
    for hit in list(seen.values())[:max_results]:
        content = fetch_page_content(hit.url) if fetch_content else None
        # If extraction returned empty, pass None so to_page() falls back
        # to the search snippet instead of an empty string.
        if content == "":
            content = None
        pages.append(hit.to_page(content=content))
    return pages


def _url_to_page(url: str, fetch_content: bool) -> dict | None:
    """Build a single page dict for a bare-URL message."""
    if fetch_content:
        content = fetch_page_content(url)
    else:
        content = ""
    # Use Task 3's extractor to get a proper page title (nicer than the URL).
    title = url
    if fetch_content and content:
        extracted_title = fetch_page_title(url)
        if extracted_title:
            title = extracted_title
    return {"title": title, "url": url, "content": content}


def search_for_answer(
    question: str,
    max_results: int = 5,
    fetch_content: bool = True,
    provider: Optional[SearchProvider] = None,
) -> dict:
    """Convenience: run the search pipeline AND the answer generator.

    This wires Task 2 (search) to Task 1 (answer generation) in one call.
    It lazily imports ai_chat so this module still works standalone if
    ai_chat (or the NVIDIA_API_KEY) isn't configured.

    Returns:
        {"answer": str, "citations": list, "sources": list}
        If no sources were found, "answer" is a short message saying so
        and "citations" is empty.
    """
    pages = search_for_pages(
        question,
        max_results=max_results,
        fetch_content=fetch_content,
        provider=provider,
    )

    if not pages:
        return {
            "answer": (
                "I couldn't find any web sources for that. "
                "Try rephrasing your question."
            ),
            "citations": [],
            "sources": [],
        }

    # Lazy import: ai_chat lives in a sibling folder. Try several import
    # strategies so it works whether run as a package, standalone, or from
    # the unified test harness.
    answer_with_citations = None
    import importlib
    for _mod_path, _func_name in (
        ("backend.services.ai_chat.answer_generator", "answer_with_citations"),
        ("ai_chat.answer_generator", "answer_with_citations"),
        ("answer_generator", "answer_with_citations"),
    ):
        try:
            _mod = importlib.import_module(_mod_path)
            answer_with_citations = getattr(_mod, _func_name, None)
            if answer_with_citations:
                break
        except Exception:
            continue

    if answer_with_citations is None:
        # Task 1 not available — return just the sources.
        return {
            "answer": "(answer generation unavailable — showing sources only)",
            "citations": [],
            "sources": pages,
        }

    result = answer_with_citations(question, pages)
    result["sources"] = pages
    return result
