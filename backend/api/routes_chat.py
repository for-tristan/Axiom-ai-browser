"""FastAPI router for the AI Chat — the browser's AI assistant endpoint.

Endpoints:
    POST /chat  — ask the AI a question, with optional page context.

When the user is on a web page and asks a question, the frontend sends
{question, page_url, page_title}. The backend:
  1. If page_url is provided: extract the page's content via Task 3
     (Trafilatura) and feed it to Task 1's answer_with_citations.
  2. If no page_url: run the full web-search pipeline (Task 2 → Task 3
     → Task 1) to search the web and answer.

In both cases the response is {answer, citations, sources} where
citations are [{number, title, url}] extracted from the LLM's answer.
"""

from __future__ import annotations

import os
import sys
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(prefix="/chat", tags=["chat"])


# ── Request / response models ───────────────────────────────────────────
class ChatRequest(BaseModel):
    question: str = Field(..., description="The user's question.")
    page_url: Optional[str] = Field(
        None, description="URL of the page the user is currently viewing."
    )
    page_title: Optional[str] = Field(
        None, description="Title of the page the user is currently viewing."
    )


class Citation(BaseModel):
    number: int
    title: str
    url: str


class PageSource(BaseModel):
    title: str
    url: str
    content: str = ""


class ChatResponse(BaseModel):
    answer: str
    citations: list[Citation]
    sources: list[PageSource] = []


# ── Lazy importer ───────────────────────────────────────────────────────
def _load_services():
    """Import the AI services lazily so the API can still boot even if
    a dependency is missing. Adds the service folders to sys.path."""
    here = os.path.dirname(os.path.abspath(__file__))
    services_dir = os.path.normpath(os.path.join(here, "..", "services"))
    for folder in ("web_search", "ai_chat", "web_extraction"):
        p = os.path.join(services_dir, folder)
        if p not in sys.path:
            sys.path.insert(0, p)

    # Ensure NVIDIA_API_KEY is available (load .env from ai_chat folder)
    try:
        from dotenv import load_dotenv
        env_path = os.path.join(services_dir, "ai_chat", ".env")
        load_dotenv(env_path)
    except Exception:
        pass

    try:
        from pipeline import search_for_answer, search_for_pages  # type: ignore
    except ImportError as exc:
        raise HTTPException(
            status_code=503,
            detail=f"AI services unavailable: {exc}",
        ) from exc

    # Import extraction_bridge for page-content extraction
    try:
        from extraction_bridge import fetch_page_content, fetch_page_title  # type: ignore
    except ImportError:
        fetch_page_content = None
        fetch_page_title = None

    # Import answer_generator for page-chat mode
    try:
        from answer_generator import answer_with_citations  # type: ignore
    except ImportError:
        answer_with_citations = None

    return (
        search_for_answer,
        search_for_pages,
        fetch_page_content,
        fetch_page_title,
        answer_with_citations,
    )


# ── Route ───────────────────────────────────────────────────────────────
@router.post("", response_model=ChatResponse)
@router.post("/", response_model=ChatResponse, include_in_schema=False)
def chat(req: ChatRequest):
    """Answer a user question, using the current page or web search.

    - If page_url is provided: extract that page's content and answer
      based on it (page chat mode).
    - If no page_url: search the web and answer (web search mode).
    """
    (
        search_for_answer,
        search_for_pages,
        fetch_page_content,
        fetch_page_title,
        answer_with_citations,
    ) = _load_services()

    # ── Mode 1: Page chat — user is on a page, answer from its content ──
    if req.page_url and answer_with_citations and fetch_page_content:
        try:
            content = fetch_page_content(req.page_url)
        except Exception:
            content = ""

        if content:
            title = req.page_title or ""
            if not title and fetch_page_title:
                try:
                    title = fetch_page_title(req.page_url) or req.page_url
                except Exception:
                    title = req.page_url

            pages = [{"title": title, "url": req.page_url, "content": content}]
            try:
                result = answer_with_citations(req.question, pages)
                return ChatResponse(
                    answer=result.get("answer", ""),
                    citations=[Citation(**c) for c in result.get("citations", [])],
                    sources=[PageSource(**p) for p in pages],
                )
            except Exception as exc:
                # If the LLM fails, fall through to web search mode.
                pass

    # ── Mode 2: Web search — search the web and answer ──────────────────
    try:
        result = search_for_answer(req.question, max_results=5, fetch_content=True)
        return ChatResponse(
            answer=result.get("answer", "I couldn't find an answer to that."),
            citations=[Citation(**c) for c in result.get("citations", [])],
            sources=[PageSource(**p) for p in result.get("sources", [])],
        )
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"AI pipeline error: {exc}",
        ) from exc
