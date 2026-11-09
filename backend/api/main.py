"""Axiom backend API entry point.

Run locally:
    cd backend/api
    python -B -m uvicorn main:app --reload --port 8000

The -B flag disables bytecode caching (.pyc files) which can cause stale
code to run on Windows/OneDrive where file timestamps are unreliable.
"""
from __future__ import annotations

import os
import sys

# Disable bytecode caching — prevents stale .pyc files from being used
# instead of the updated .py source files. This is critical on Windows
# with OneDrive where file sync can mess up timestamps.
# PYTHONDONTWRITEBYTECODE=1 is the env var equivalent that applies to
# ALL subprocesses (including the uvicorn --reload worker).
os.environ["PYTHONDONTWRITEBYTECODE"] = "1"
sys.dont_write_bytecode = True

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes_search import router as search_router
from routes_chat import router as chat_router

app = FastAPI(
    title="Axiom Backend API",
    description="AI browser backend — search, chat, retrieval.",
    version="0.1.0",
)

# Allow the Electron/React frontend (localhost:5173) to call the API.
# Also allow localhost:8000 for the API's own Swagger UI.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ],
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
app.include_router(chat_router)
