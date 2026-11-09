"""Query intelligence for the AI chat.

This module decides what to do with a user's message BEFORE we spend a
web search on it:

  1. classify_query()  — what kind of message is this?
  2. is_search_needed() — should we hit the web at all?
  3. refine_query()    — clean it up so the search engine gets the best
                         possible string.
  4. split_query()     — if the user asked two things at once ("X and Y"),
                         split into separate searches.
  5. extract_url()     — if the user pasted a bare URL, treat it as
                         navigation, not a search.

Everything here is rule-based and runs locally — no LLM call, no network.
That keeps it fast (microseconds) and free, and it means the search step
only fires for messages that genuinely need fresh information from the web.

A future iteration can optionally use the LLM (Task 1) to expand or
rephrase ambiguous queries, but the rule-based layer is the default
because it is deterministic and easy to test.
"""

from __future__ import annotations

import re
from dataclasses import dataclass


# ── Intent types ────────────────────────────────────────────────────────
# These are the only things we need to distinguish for search routing.
GREETING = "greeting"        # "hi", "hello", "good morning"
CHITCHAT = "chitchat"        # "thanks", "how are you", "bye"
FACTUAL = "factual"          # "what is the capital of France"
PROCEDURAL = "procedural"    # "how do I ...", "steps to ..."
NAVIGATIONAL = "navigational"  # user pasted a URL
EMPTY = "empty"


@dataclass
class QueryIntent:
    """The result of classifying a user message."""

    intent: str
    """One of the constants above."""

    refined: str
    """The cleaned-up query string ready to send to a search engine."""

    url: str | None = None
    """If the message was navigational, the detected URL."""


# ── Keyword sets (lowercase, no punctuation) ────────────────────────────
_GREETING_WORDS = {
    "hi", "hello", "hey", "yo", "salam", "salaam", "ahlan", "marhaba",
    "good morning", "good evening", "good afternoon", "good night",
}
_CHITCHAT_WORDS = {
    "thanks", "thank you", "thx", "ty", "please", "ok", "okay", "cool",
    "nice", "great", "bye", "goodbye", "see you", "how are you",
    "whats up", "what's up",
}
# Question words / cues that strongly suggest the user wants information.
_QUESTION_CUES = (
    "what", "who", "when", "where", "which", "why", "how",
    "is ", "are ", "was ", "were ", "do ", "does ", "did ",
    "can ", "could ", "should ", "would ",
    "define", "explain", "describe", "tell me about", "tell me",
    "difference between", "compare", "vs ", "versus",
    "capital of", "population of", "meaning of", "synonym",
    "weather", "price of", "cost of",
    "ايه", "ايه", "مين", "امتى", "فين", "ليه", "ازاي", "كام",
    "اي", "هل", "متى", "أين", "ما هو", "ما هي", "عرف", "اشرح",
    "مقارنة بين", "فرق بين", "عاصمة", "سكان",
)
_PROCEDURAL_CUES = ("how do", "how to", "how can", "steps to", "guide to",
                    "tutorial", "ازاي", "كيف", "خطوات", "طريقة")


# ── Regexes ─────────────────────────────────────────────────────────────
# A URL the user pasted directly. Allows http(s)://anything, or bare
# domains with at least one dot (so "github.com" works but "hello" does
# not get mistaken for a URL). The http(s):// branch is loose on purpose
# so host:port (localhost:3000) and IP addresses work.
_URL_RE = re.compile(
    r"^("
    r"https?://[^\s]+"                       # http(s)://anything
    r"|"
    r"(www\.)?[\w-]+(\.[\w-]+)+([/?#]\S*)?"  # bare domain, ≥1 dot
    r")$",
    re.IGNORECASE,
)
# Filler phrases to strip when refining a query.
_FILLER_RE = re.compile(
    r"\b(can you|could you|would you|please|tell me about|tell me|"
    r"i want to know|i want to|what is the|what is a|what is|"
    r"whats the|what's the|whats a|what's a|"
    r"who is the|who is a|who is|where is the|where is|"
    r"define the|define|explain the|explain|describe the|describe|"
    r"show me|give me|list of|details about|information on|"
    r"how to|how do i|how do you|how can i|how can you|"
    r"steps to|guide to|tutorial for|tutorial on|tutorial|"
    r"install|download|setup|configure|"
    r"the|a|an|"
    r"ممكن|لو سمحت|ازيك|عايز اعرف|عايزة اعرف|ممكن تعرفني|"
    r"ايه هو|ايه هي|ايه ال|مين هو|مين هي)\b",
    re.IGNORECASE,
)
# Compound separators: "X and Y", "X and also Y", "X plus Y", "X ، Y"
_COMPOUND_RE = re.compile(
    r"\s+(?:and also|and then|and|plus|also|،|؛)\s+",
    re.IGNORECASE,
)


# ── Public functions ────────────────────────────────────────────────────
def extract_url(text: str) -> str | None:
    """If the whole message is just a URL, return it (normalized to https://).

    Returns None if the message is not a bare URL. We only treat a message
    as navigational when the URL is essentially the entire message; a URL
    buried inside a longer question is left for the search engine.
    """
    value = text.strip()
    if not value or " " in value:
        return None
    if _URL_RE.match(value):
        if value.lower().startswith("http://") or value.lower().startswith("https://"):
            return value
        return f"https://{value}"
    return None


def _normalize(text: str) -> str:
    """Lowercase, collapse whitespace, strip leading/trailing space."""
    return re.sub(r"\s+", " ", text).strip()


def classify_query(text: str) -> str:
    """Return the intent label for a user message.

    The classification is intentionally simple and conservative: when in
    doubt we call it FACTUAL, because running a search that turns out to
    be unnecessary is cheap, while skipping a search the user needed is
    a bad experience.
    """
    normalized = _normalize(text)
    if not normalized:
        return EMPTY

    # Bare URL → navigation.
    if extract_url(normalized):
        return NAVIGATIONAL

    lower = normalized.lower()

    # Greeting: the whole message is a greeting word/phrase.
    if lower in _GREETING_WORDS:
        return GREETING

    # Chitchat: short message made only of chitchat words.
    # Tokenize on whitespace so "ok cool" → {"ok","cool"}, not one token.
    tokens = {t for t in lower.split() if t}
    if lower in _CHITCHAT_WORDS:
        return CHITCHAT
    if len(tokens) <= 3 and tokens and tokens.issubset(
        {w for phrase in _CHITCHAT_WORDS for w in phrase.split()}
    ):
        return CHITCHAT

    # Procedural: "how do I / how to / steps ..."
    if any(lower.startswith(c) or f" {c}" in lower for c in _PROCEDURAL_CUES):
        return PROCEDURAL

    # Otherwise treat as factual (the catch-all that triggers a search).
    return FACTUAL


def is_search_needed(text: str) -> bool:
    """True if the message should trigger a web search."""
    intent = classify_query(text)
    return intent in (FACTUAL, PROCEDURAL, NAVIGATIONAL)


def refine_query(text: str) -> str:
    """Clean a user message into the best string for a search engine.

    - Strips filler phrases ("can you tell me what is the ...").
    - Removes surrounding quotes and question marks.
    - Collapses whitespace.
    - If the message was a bare URL, returns the URL (so the search
      provider can treat it as navigational).

    We do NOT translate or synonym-expand here — the search engine is
    good at matching the user's own words, and rewriting risks losing
    their intent.
    """
    normalized = _normalize(text)
    if not normalized:
        return ""

    url = extract_url(normalized)
    if url:
        return url

    # Strip surrounding quotes.
    if (normalized.startswith('"') and normalized.endswith('"')) or (
        normalized.startswith("'") and normalized.endswith("'")
    ):
        normalized = normalized[1:-1].strip()

    # Remove filler phrases (loop because regex removes one match at a time
    # and stripping may expose another).
    previous = None
    while previous != normalized:
        previous = normalized
        normalized = _FILLER_RE.sub(" ", normalized).strip()

    # Trim trailing question marks / punctuation.
    normalized = normalized.rstrip("?!:؛،")

    # Collapse whitespace again after stripping.
    return _normalize(normalized)


def split_query(text: str) -> list[str]:
    """Split a compound question into sub-queries.

    "What is the capital of France and what is its population?"
      → ["capital of France", "its population"]

    Returns a list with a single refined query if the question is not
    compound. Empty list for empty/non-search messages.

    The splitting is deliberately conservative: we only split on clear
    coordinating conjunctions ("and", "also", "،") and only when both
    halves look substantial. Over-splitting would waste searches;
    under-splitting just means one broader search, which is fine.
    """
    # Non-search messages (greetings, chitchat) have nothing to split.
    if not is_search_needed(text):
        return []

    refined = refine_query(text)
    if not refined:
        return []

    # Bare URL: nothing to split.
    if extract_url(refined):
        return [refined]

    parts = _COMPOUND_RE.split(refined)
    parts = [_normalize(p) for p in parts if _normalize(p)]

    # Only treat as compound if we got 2+ meaningful parts (each >= 2 chars).
    if len(parts) >= 2 and all(len(p) >= 2 for p in parts):
        return parts
    return [refined]


def analyze(text: str) -> QueryIntent:
    """One-shot convenience: classify + refine a message.

    Returns a QueryIntent with the intent label, the refined query, and
    the detected URL (if navigational).
    """
    intent = classify_query(text)
    refined = refine_query(text)
    url = extract_url(text) if intent == NAVIGATIONAL else None
    return QueryIntent(intent=intent, refined=refined, url=url)
