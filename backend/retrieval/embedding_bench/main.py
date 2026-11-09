"""
Salma Multi-Model Embedding API — Enhanced Backend
====================================================
Preserves all original model implementations unchanged.
Adds:
  - CORS middleware (frontend access)
  - /health endpoint
  - /models endpoint (capabilities manifest)
  - /embed (original, unchanged behaviour)
  - /embed/batch (run multiple models in one call)
  - /embed/image (Gemini image embeddings — only supported model)
  - /experiments/* (SQLite-backed history)
  - Engine init now reads keys from environment variables with
    fallback to the hardcoded keys already in the file, so the
    original keys still work if they are valid.
"""

import os
import time
import base64

# Load .env file if present (before any os.getenv calls)
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # python-dotenv not installed; environment variables must be set externally
import sqlite3
import json
import io
from datetime import datetime
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, List

# ── Model imports (unchanged) ────────────────────────────────────────────────
from models.gemini_model import GeminiEmbedding
from models.e5_model import E5Embedding
from models.qwen_model import QwenEmbedding
from models.nvidia_model import NvidiaEmbedding

# ── API Keys — prefer environment variables, fall back to originals ──────────
GEMINI_KEY = os.getenv("GEMINI_API_KEY", "AQ.Ab8RN6J4OFZUACG1vNh8FlOqTlxEABp4_4uS5XpLIIxv15MoLw")
NVIDIA_KEY = os.getenv("NVIDIA_API_KEY", "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")

# ── Engine initialisation ────────────────────────────────────────────────────
# Original code had a bug: both conditions used != with the same literal, so
# both engines were ALWAYS None.  Fixed: engines are now always attempted;
# if initialisation fails it is captured and surfaced via /health.
_engine_errors: dict = {}

def _init_engine(name, factory):
    try:
        return factory()
    except Exception as exc:
        _engine_errors[name] = str(exc)
        return None

gemini_engine  = _init_engine("gemini",  lambda: GeminiEmbedding(api_key=GEMINI_KEY) if GEMINI_KEY else None)
e5_engine      = _init_engine("e5",      lambda: E5Embedding())
qwen_engine    = _init_engine("qwen",    lambda: QwenEmbedding())
nvidia_engine  = _init_engine("nvidia",  lambda: NvidiaEmbedding(api_key=NVIDIA_KEY) if NVIDIA_KEY else None)

# ── SQLite experiment history ────────────────────────────────────────────────
DB_PATH = os.path.join(os.path.dirname(__file__), "experiments.db")

def _init_db():
    con = sqlite3.connect(DB_PATH)
    con.execute("""
        CREATE TABLE IF NOT EXISTS experiments (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at  TEXT    NOT NULL,
            modality    TEXT    NOT NULL,
            input_ref   TEXT,
            models      TEXT    NOT NULL,
            results     TEXT    NOT NULL
        )
    """)
    con.commit()
    con.close()

# ── FastAPI app ──────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    _init_db()
    yield

app = FastAPI(
    title="Salma Multi-Model Embedding API",
    version="2.0",
    description="Embedding benchmarking backend for Gemini, NVIDIA Nemotron, E5, and Qwen.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Schemas ──────────────────────────────────────────────────────────────────
class EmbeddingRequest(BaseModel):
    text: str
    model_choice: str   # 'gemini' | 'e5' | 'qwen' | 'nvidia'

class BatchEmbeddingRequest(BaseModel):
    text: str
    models: List[str]   # subset of ['gemini', 'e5', 'qwen', 'nvidia']

# ── Helpers ──────────────────────────────────────────────────────────────────
_ENGINES = {
    "gemini": gemini_engine,
    "e5":     e5_engine,
    "qwen":   qwen_engine,
    "nvidia": nvidia_engine,
}

_CAPABILITIES = {
    "gemini": {"text": True,  "image": True,  "local": False, "model_id": "gemini-embedding-2"},
    "e5":     {"text": True,  "image": False, "local": True,  "model_id": "intfloat/multilingual-e5-large"},
    "qwen":   {"text": True,  "image": False, "local": True,  "model_id": "Qwen/Qwen3-Embedding-0.6B"},
    "nvidia": {"text": True,  "image": False, "local": False, "model_id": "nvidia/nemotron-3.5-embed-8b"},
}

def _run_text(engine_key: str, text: str):
    engine = _ENGINES.get(engine_key)
    if engine is None:
        err = _engine_errors.get(engine_key, "Engine not initialised (check API key or dependencies).")
        raise ValueError(err)
    t0 = time.perf_counter()
    vector = engine.get_embedding(text)
    latency_ms = round((time.perf_counter() - t0) * 1000, 2)
    return list(vector), latency_ms

def _db_save(modality: str, input_ref: str, models: List[str], results: dict):
    con = sqlite3.connect(DB_PATH)
    con.execute(
        "INSERT INTO experiments (created_at, modality, input_ref, models, results) VALUES (?,?,?,?,?)",
        (datetime.utcnow().isoformat(), modality, input_ref, json.dumps(models), json.dumps(results))
    )
    con.commit()
    con.close()

# ── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    status = {}
    for name, engine in _ENGINES.items():
        if engine is not None:
            status[name] = "ready"
        else:
            status[name] = _engine_errors.get(name, "not initialised")
    return {"status": "ok", "engines": status, "db": DB_PATH}


@app.get("/models")
def list_models():
    """Return capability manifest for each model."""
    result = {}
    for name, caps in _CAPABILITIES.items():
        engine = _ENGINES.get(name)
        result[name] = {
            **caps,
            "available": engine is not None,
            "error": _engine_errors.get(name),
        }
    return result


# ── Original /embed endpoint (unchanged behaviour) ───────────────────────────
@app.post("/embed")
def generate_embedding(request: EmbeddingRequest):
    choice = request.model_choice.lower()

    try:
        if choice == "gemini":
            if not gemini_engine:
                raise HTTPException(status_code=400, detail="Google Gemini API Key is missing or not configured!")
            vector = gemini_engine.get_embedding(request.text)

        elif choice == "e5":
            vector = e5_engine.get_embedding(request.text)

        elif choice == "qwen":
            vector = qwen_engine.get_embedding(request.text)

        elif choice == "nvidia":
            if not nvidia_engine:
                raise HTTPException(status_code=400, detail="NVIDIA API Key is missing or not configured!")
            vector = nvidia_engine.get_embedding(request.text)

        else:
            raise HTTPException(status_code=400, detail="Invalid model choice! Choose from: 'gemini', 'e5', 'qwen', 'nvidia'")

        return {
            "status": "success",
            "model_used": choice,
            "vector_dimension": len(vector),
            "embedding": vector
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── /embed/batch — run multiple models on the same text ─────────────────────
@app.post("/embed/batch")
def batch_embedding(request: BatchEmbeddingRequest):
    """Run the same text through multiple models and return all results."""
    if not request.models:
        raise HTTPException(status_code=400, detail="No models specified.")

    results = {}
    for model_key in request.models:
        key = model_key.lower()
        if key not in _CAPABILITIES:
            results[key] = {"status": "error", "error": f"Unknown model '{key}'."}
            continue
        try:
            vector, latency_ms = _run_text(key, request.text)
            results[key] = {
                "status": "success",
                "model_used": key,
                "vector_dimension": len(vector),
                "latency_ms": latency_ms,
                "embedding": vector,
            }
        except Exception as exc:
            results[key] = {"status": "error", "error": str(exc), "latency_ms": None}

    # Persist experiment
    try:
        _db_save(
            modality="text",
            input_ref=request.text[:200],
            models=request.models,
            results=results
        )
    except Exception:
        pass  # do not fail the response over storage errors

    return {"modality": "text", "input": request.text, "results": results}


# ── /embed/image — Gemini image embedding only ───────────────────────────────
@app.post("/embed/image")
async def image_embedding(file: UploadFile = File(...)):
    """
    Generate an embedding for an uploaded image using Gemini.
    Gemini is currently the only model in this project with image embedding support.
    """
    if not gemini_engine:
        raise HTTPException(
            status_code=400,
            detail="Gemini engine is not available. Check your GEMINI_API_KEY."
        )

    allowed_types = {"image/jpeg", "image/png", "image/webp", "image/gif"}
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{file.content_type}'. Allowed: {', '.join(allowed_types)}"
        )

    MAX_SIZE = 20 * 1024 * 1024  # 20 MB
    contents = await file.read()
    if len(contents) > MAX_SIZE:
        raise HTTPException(status_code=400, detail="Image exceeds 20 MB size limit.")

    try:
        from google.genai import types as genai_types
        image_part = genai_types.Part.from_bytes(data=contents, mime_type=file.content_type)

        t0 = time.perf_counter()
        vector = gemini_engine.get_embedding(image_part)
        latency_ms = round((time.perf_counter() - t0) * 1000, 2)
        vector = list(vector)

        # Persist experiment (store filename, not raw bytes)
        try:
            _db_save(
                modality="image",
                input_ref=file.filename or "uploaded_image",
                models=["gemini"],
                results={"gemini": {
                    "status": "success",
                    "model_used": "gemini",
                    "vector_dimension": len(vector),
                    "latency_ms": latency_ms,
                }}
            )
        except Exception:
            pass

        return {
            "modality": "image",
            "filename": file.filename,
            "content_type": file.content_type,
            "file_size_bytes": len(contents),
            "model_used": "gemini",
            "vector_dimension": len(vector),
            "latency_ms": latency_ms,
            "embedding": vector,
            "note": "Only Gemini currently supports image embeddings in this project."
        }

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ── Experiment History ────────────────────────────────────────────────────────
@app.get("/experiments")
def list_experiments(limit: int = 50, offset: int = 0):
    con = sqlite3.connect(DB_PATH)
    rows = con.execute(
        "SELECT id, created_at, modality, input_ref, models, results FROM experiments "
        "ORDER BY id DESC LIMIT ? OFFSET ?",
        (limit, offset)
    ).fetchall()
    total = con.execute("SELECT COUNT(*) FROM experiments").fetchone()[0]
    con.close()
    return {
        "total": total,
        "experiments": [
            {
                "id": r[0],
                "created_at": r[1],
                "modality": r[2],
                "input_ref": r[3],
                "models": json.loads(r[4]),
                "results": json.loads(r[5]),
            }
            for r in rows
        ]
    }


@app.get("/experiments/{exp_id}")
def get_experiment(exp_id: int):
    con = sqlite3.connect(DB_PATH)
    row = con.execute(
        "SELECT id, created_at, modality, input_ref, models, results FROM experiments WHERE id=?",
        (exp_id,)
    ).fetchone()
    con.close()
    if not row:
        raise HTTPException(status_code=404, detail="Experiment not found.")
    return {
        "id": row[0],
        "created_at": row[1],
        "modality": row[2],
        "input_ref": row[3],
        "models": json.loads(row[4]),
        "results": json.loads(row[5]),
    }


@app.delete("/experiments/{exp_id}")
def delete_experiment(exp_id: int):
    con = sqlite3.connect(DB_PATH)
    affected = con.execute("DELETE FROM experiments WHERE id=?", (exp_id,)).rowcount
    con.commit()
    con.close()
    if affected == 0:
        raise HTTPException(status_code=404, detail="Experiment not found.")
    return {"deleted": exp_id}


@app.delete("/experiments")
def clear_experiments():
    con = sqlite3.connect(DB_PATH)
    con.execute("DELETE FROM experiments")
    con.commit()
    con.close()
    return {"message": "All experiments deleted."}
