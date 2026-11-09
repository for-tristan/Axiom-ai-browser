"""
Centralized configuration for Task 3 – Web Extraction & Source Processing.

All settings are read from environment variables (or a .env file at the
Task3-WebExtraction root).  Sensible defaults are provided so the service
works without any configuration at all.
"""

from __future__ import annotations

import os
from functools import lru_cache

from dotenv import load_dotenv
from pydantic import field_validator
from pydantic_settings import BaseSettings

# Load .env relative to this file's parent directory
_ENV_FILE = os.path.join(os.path.dirname(__file__), "..", ".env")
load_dotenv(_ENV_FILE)


class Settings(BaseSettings):
    # ── Application ───────────────────────────────────────────────────────
    app_name: str = "Axiom Task 3 – Web Extraction & Source Processing"
    environment: str = "development"
    host: str = "0.0.0.0"
    port: int = 8003

    # ── HTTP fetching ─────────────────────────────────────────────────────
    # Seconds before a single HTTP request is aborted.
    request_timeout: int = 15
    # Maximum response body size in bytes (default 5 MB).
    max_response_size: int = 5 * 1024 * 1024
    # Maximum simultaneous outgoing HTTP connections.
    max_concurrent_requests: int = 10
    # Maximum URLs accepted in a single API call.
    max_urls_per_request: int = 20

    # ── Chunking ──────────────────────────────────────────────────────────
    # Target number of *characters* per chunk (not tokens).
    chunk_size: int = 1000
    # Overlap between consecutive chunks, in characters.
    chunk_overlap: int = 200

    # ── HTTP identity ─────────────────────────────────────────────────────
    user_agent: str = (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/126.0.0.0 Safari/537.36 AxiomBrowser/3.0"
    )

    # ── Logging ───────────────────────────────────────────────────────────
    log_level: str = "INFO"

    @field_validator("environment")
    @classmethod
    def validate_env(cls, v: str) -> str:
        allowed = {"development", "staging", "production", "test"}
        if v not in allowed:
            raise ValueError(f"environment must be one of {allowed}")
        return v

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return a cached Settings singleton.  Call this everywhere."""
    return Settings()
