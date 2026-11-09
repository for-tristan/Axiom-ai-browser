"""Axiom backend API entry point.

Run locally:
    cd backend/api
    uvicorn main:app --reload --port 8000

This mounts every module's router.
"""

from __future__ import annotations

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
