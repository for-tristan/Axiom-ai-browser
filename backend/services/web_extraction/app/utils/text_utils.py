"""
Text utility helpers used across the Task 3 pipeline.

Kept deliberately small: each function does one thing and is easy to test.
"""

from __future__ import annotations

import hashlib
import re
import unicodedata


# ── Whitespace normalisation ───────────────────────────────────────────────────

def normalize_whitespace(text: str) -> str:
    """Collapse runs of whitespace into a single space and strip the string."""
    return re.sub(r"[ \t\r\f\v]+", " ", text).strip()


def normalize_newlines(text: str) -> str:
    """
    Reduce 3+ consecutive blank lines to 2.
    Preserve paragraph structure (2 newlines) and single line breaks.
    """
    # Normalize Windows / Mac line endings first
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    # Collapse 3+ blank lines → 2
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def collapse_blank_lines(text: str, max_blank: int = 2) -> str:
    """
    Ensure no run of blank lines longer than *max_blank* appears in *text*.
    """
    pattern = r"\n{" + str(max_blank + 1) + r",}"
    replacement = "\n" * max_blank
    return re.sub(pattern, replacement, text)


# ── Token / word estimation ────────────────────────────────────────────────────

def estimate_tokens(text: str) -> int:
    """
    Rough token count estimate: ~4 characters per token (GPT-style).
    Good enough for chunk-size planning without loading a tokenizer.
    """
    return max(1, len(text) // 4)


def count_words(text: str) -> int:
    """Count whitespace-separated words in *text*."""
    return len(text.split()) if text and text.strip() else 0


# ── Hashing ───────────────────────────────────────────────────────────────────

def content_hash(text: str) -> str:
    """
    Return a stable SHA-256 hex digest of *text* after normalisation.
    Used for near-duplicate detection.
    """
    normalised = re.sub(r"\s+", " ", text.lower()).strip()
    return hashlib.sha256(normalised.encode("utf-8", errors="replace")).hexdigest()


# ── Unicode / encoding ────────────────────────────────────────────────────────

def safe_decode(raw: bytes, declared_encoding: str | None = None) -> str:
    """
    Decode *raw* bytes to str, trying the declared encoding first, then
    UTF-8, then latin-1 as a last resort.
    """
    attempts = []
    if declared_encoding:
        attempts.append(declared_encoding)
    attempts += ["utf-8", "latin-1"]

    for enc in attempts:
        try:
            return raw.decode(enc)
        except (UnicodeDecodeError, LookupError):
            continue
    # Absolute fallback — replace undecodeable bytes
    return raw.decode("utf-8", errors="replace")


def normalize_unicode(text: str) -> str:
    """NFC-normalize Unicode text (compose characters)."""
    return unicodedata.normalize("NFC", text)


# ── Sentence splitting ────────────────────────────────────────────────────────

_SENT_END = re.compile(r"(?<=[.!?])\s+")


def split_sentences(text: str) -> list[str]:
    """
    Very lightweight sentence splitter (no NLTK dependency).
    Splits on whitespace that follows a sentence-ending punctuation mark.
    """
    return [s.strip() for s in _SENT_END.split(text) if s.strip()]


# ── Removal helpers ───────────────────────────────────────────────────────────

_REPEATED_LINE_RE = re.compile(r"^(.+)\n\1$", re.MULTILINE)


def remove_repeated_lines(text: str) -> str:
    """Remove immediately adjacent duplicate lines."""
    lines = text.splitlines()
    result: list[str] = []
    prev = None
    for line in lines:
        if line != prev:
            result.append(line)
        prev = line
    return "\n".join(result)


def clean_extraction_artifacts(text: str) -> str:
    """
    Remove common extraction artifacts:
    - Share / print buttons text
    - Cookie-banner boilerplate
    - Tracking pixel alt text
    """
    patterns = [
        r"\bShare this article\b",
        r"\bPrint this page\b",
        r"\bAccept (all )?[Cc]ookies?\b",
        r"\bWe use cookies\b.*?\.",
        r"\bSubscribe to our newsletter\b",
        r"\bSign up for our newsletter\b",
        r"\bFollow us on\b.*?(?:Twitter|Facebook|Instagram|LinkedIn)",
        r"\bAdvertisement\b",
        r"\[Advertisement\]",
        r"\bSkip to (main )?content\b",
        r"\bRead more:\b",
        r"<!--.*?-->",   # stray HTML comments
    ]
    for pat in patterns:
        text = re.sub(pat, "", text, flags=re.IGNORECASE | re.DOTALL)
    return text
