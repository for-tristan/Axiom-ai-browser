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
    page_content: Optional[str] = Field(
        None, description="Pre-extracted page text from the browser webview. "
        "When provided, the backend uses this directly instead of re-fetching "
        "the page (which may be blocked by the site)."
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
    mode: str = "web_search"
    debug: str = ""


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
    """Answer a user question, using the current page or web search."""
    import logging
    logger = logging.getLogger(__name__)

    debug_parts = []
    debug_parts.append(f"page_url={req.page_url}")
    debug_parts.append(f"page_title={req.page_title}")
    debug_parts.append(f"page_content_len={len(req.page_content) if req.page_content else 0}")

    (
        search_for_answer,
        search_for_pages,
        fetch_page_content,
        fetch_page_title,
        answer_with_citations,
    ) = _load_services()

    debug_parts.append(f"answer_with_citations={'yes' if answer_with_citations else 'no'}")
    debug_parts.append(f"fetch_page_content={'yes' if fetch_page_content else 'no'}")

    # ── Mode 1: Page chat — answer based on the current page's content ──
    page_content = req.page_content

    if not page_content and req.page_url:
        # Try extraction_bridge first
        if fetch_page_content:
            try:
                page_content = fetch_page_content(req.page_url)
                debug_parts.append(f"bridge fetch: {len(page_content) if page_content else 0} chars")
            except Exception as e:
                debug_parts.append(f"bridge fetch failed: {e}")
                page_content = ""

        # Direct requests fallback — synchronous, always works
        if not page_content:
            debug_parts.append("trying direct requests fetch")
            try:
                import requests as _requests
                from bs4 import BeautifulSoup as _BS4
                _ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
                _r = _requests.get(req.page_url, headers={"User-Agent": _ua, "Accept-Language": "en-US,en;q=0.9"}, timeout=15)
                _r.raise_for_status()
                _soup = _BS4(_r.text, "html.parser")
                for tag in _soup(["script", "style", "noscript", "nav", "footer", "header", "aside", "form", "button", "svg", "iframe"]):
                    tag.decompose()
                _el = _soup.select_one("#mw-content-text") or _soup.select_one("article") or _soup.select_one("main") or _soup.select_one("[role=main]") or _soup.body or _soup
                _text = _el.get_text(" ", strip=True)
                if _text:
                    import re as _re
                    _text = _re.sub(r"\s+", " ", _text).strip()
                    if len(_text) > 8000:
                        _text = _text[:8000]
                    page_content = _text
                    debug_parts.append(f"direct fetch: {len(page_content)} chars")
                else:
                    debug_parts.append("direct fetch: empty text")
            except Exception as e:
                debug_parts.append(f"direct fetch failed: {e}")
                page_content = ""

    # Try page chat mode if we have content
    if page_content:
        if answer_with_citations:
            debug_parts.append(f"page chat mode (content: {len(page_content)} chars)")
            title = req.page_title or req.page_url or "this page"
            pages = [{"title": title, "url": req.page_url or "", "content": page_content}]
            try:
                result = answer_with_citations(req.question, pages)
                return ChatResponse(
                    answer=result.get("answer", ""),
                    citations=[Citation(**c) for c in result.get("citations", [])],
                    sources=[PageSource(**p) for p in pages],
                    mode="page_chat",
                    debug=" | ".join(debug_parts),
                )
            except Exception as exc:
                debug_parts.append(f"LLM failed: {exc}")
        else:
            debug_parts.append("answer_with_citations is None — cannot do page chat")
    else:
        debug_parts.append("no page_content available")

    # ── Mode 2: Web search — search the web and answer ──────────────────
    debug_parts.append("web search mode")
    try:
        result = search_for_answer(req.question, max_results=5, fetch_content=True)
        return ChatResponse(
            answer=result.get("answer", "I couldn't find an answer to that."),
            citations=[Citation(**c) for c in result.get("citations", [])],
            sources=[PageSource(**p) for p in result.get("sources", [])],
            mode="web_search",
            debug=" | ".join(debug_parts),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"AI pipeline error: {exc} | debug: {' | '.join(debug_parts)}",
        ) from exc
