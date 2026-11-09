"""FastAPI router exposing the Web Search & Query Intelligence service.

Endpoints:
    POST /search         — run the search pipeline, return source pages.
    POST /search/answer  — run search + Task 1 answer generation together.
    POST /search/analyze — classify + refine a query (no network).

The router is mounted by backend/api/main.py. It deliberately imports
the web_search service lazily so the API can still boot even if the
service's optional dependencies are missing.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(prefix="/search", tags=["search"])


# ── Request / response models ───────────────────────────────────────────
class SearchRequest(BaseModel):
    question: str = Field(..., description="The user's raw chat message.")
    max_results: int = Field(5, ge=1, le=20)
    fetch_content: bool = Field(
        True,
        description="If true, fetch full page text (slower, higher quality).",
    )


class Page(BaseModel):
    title: str
    url: str
    content: str


class SearchResponse(BaseModel):
    question: str
    refined: str
    intent: str
    needs_search: bool
    pages: list[Page]


class AnswerRequest(SearchRequest):
    """Same as SearchRequest — kept separate for clarity in the API."""


class Citation(BaseModel):
    number: int
    title: str
    url: str


class AnswerResponse(BaseModel):
    answer: str
    citations: list[Citation]
    sources: list[Page]


class AnalyzeRequest(BaseModel):
    question: str


class AnalyzeResponse(BaseModel):
    intent: str
    refined: str
    url: str | None = None
    needs_search: bool


# ── Lazy importer ───────────────────────────────────────────────────────
def _load_service():
    """Import the web_search service. Raises HTTPException on failure.

    The service lives at backend/services/web_search. Its modules use
    flat imports (``from query_intelligence import ...``), the same
    convention as the existing ai_chat/ folder, so we put BOTH the
    services dir (for ``import web_search``) and the web_search dir
    itself (for its flat internal imports) on sys.path.
    """
    import os
    import sys

    here = os.path.dirname(__file__)
    services_dir = os.path.abspath(os.path.join(here, "..", "services"))
    web_search_dir = os.path.join(services_dir, "web_search")
    for d in (services_dir, web_search_dir):
        if d not in sys.path:
            sys.path.insert(0, d)

    try:
        from web_search import (  # type: ignore
            search_for_pages,
            search_for_answer,
            analyze,
            is_search_needed,
        )
    except ImportError as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Web search service unavailable: {exc}",
        ) from exc
    return search_for_pages, search_for_answer, analyze, is_search_needed


# ── Routes ──────────────────────────────────────────────────────────────
@router.post("", response_model=SearchResponse)
@router.post("/", response_model=SearchResponse, include_in_schema=False)
def search(req: SearchRequest):
    """Run the search pipeline and return source pages (no LLM call)."""
    search_for_pages, _search_for_answer, analyze, is_search_needed = _load_service()

    intent = analyze(req.question)
    pages = search_for_pages(
        req.question,
        max_results=req.max_results,
        fetch_content=req.fetch_content,
    )
    return SearchResponse(
        question=req.question,
        refined=intent.refined,
        intent=intent.intent,
        needs_search=is_search_needed(req.question),
        pages=[Page(**p) for p in pages],
    )


@router.post("/answer", response_model=AnswerResponse)
def search_answer(req: AnswerRequest):
    """Run the search pipeline AND Task 1's answer generation together.

    Returns a full answer with citations and the source pages used.
    """
    _search_for_pages, search_for_answer, _analyze, _isn = _load_service()
    result = search_for_answer(
        req.question,
        max_results=req.max_results,
        fetch_content=req.fetch_content,
    )
    return AnswerResponse(
        answer=result.get("answer", ""),
        citations=[Citation(**c) for c in result.get("citations", [])],
        sources=[Page(**p) for p in result.get("sources", [])],
    )


@router.post("/analyze", response_model=AnalyzeResponse)
def analyze_query(req: AnalyzeRequest):
    """Classify and refine a query without any network calls.

    Cheap endpoint the frontend can hit on every keystroke to decide
    whether to show a "searching the web..." indicator.
    """
    _s, _a, analyze, is_search_needed = _load_service()
    intent = analyze(req.question)
    return AnalyzeResponse(
        intent=intent.intent,
        refined=intent.refined,
        url=intent.url,
        needs_search=is_search_needed(req.question),
    )
