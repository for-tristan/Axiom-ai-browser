"""Axiom backend API entry point.

Run locally:
    cd backend/api
    uvicorn main:app --reload --port 8000

This mounts every module's router. For now only the web_search router
(Task 2) is wired; other engineers add their routers here as they land.
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes_search import router as search_router

app = FastAPI(
    title="Axiom Backend API",
    description="AI browser backend — search, chat, retrieval.",
    version="0.1.0",
)

# Allow the Electron/React frontend (localhost:5173) to call the API.
# Tighten this in production to the exact origin.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    """Liveness probe."""
    return {"status": "ok"}


# Mount module routers.
app.include_router(search_router)
