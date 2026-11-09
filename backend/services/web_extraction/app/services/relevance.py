"""
Relevance scoring and source ranking.

Algorithm
---------
We use a lightweight TF-IDF–inspired approach that works *locally* with no
external service calls or ML models:

1. **Query term extraction** — tokenise and de-stop-word the user query.
2. **Title score** — fraction of query terms appearing in the title.
3. **Snippet / description score** — same, for the short description.
4. **Content score** — TF-IDF–like score of query terms in full text.
5. **Coverage score** — fraction of query terms that appear anywhere in the
   source (title + description + content).
6. **Quality score** — word-count completeness, extraction method quality,
   HTTP status.
7. **Final score** — weighted sum of all sub-scores, normalised to 0–100.

No randomness, no LLM calls, no confidence fabrication.

The scoring is transparent: every ProcessedSource receives a
``relevance_explanation`` string explaining which factors contributed.
"""

from __future__ import annotations

import math
import re
from collections import Counter
from typing import List

from app.models.schemas import ProcessedSource, RelevanceScore, ExtractionMethod


# ── Tokenisation ──────────────────────────────────────────────────────────────

_STOPWORDS = {
    "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "shall", "can", "to", "of", "in", "for",
    "on", "with", "at", "by", "from", "as", "or", "and", "but", "not",
    "it", "its", "this", "that", "these", "those", "what", "which", "who",
    "how", "when", "where", "why", "i", "you", "he", "she", "we", "they",
    "my", "your", "his", "her", "our", "their", "about", "into", "than",
    "then", "so", "if", "up", "out", "just", "because", "while",
}


def _tokenize(text: str) -> list[str]:
    """Lowercase, remove punctuation, split on whitespace, drop stop-words."""
    tokens = re.findall(r"\b[a-z]{2,}\b", text.lower())
    return [t for t in tokens if t not in _STOPWORDS]


def _query_terms(query: str) -> list[str]:
    """Return meaningful terms from the user query (de-duplicated, ordered)."""
    seen: dict[str, None] = {}
    for t in _tokenize(query):
        seen[t] = None
    return list(seen.keys())


# ── Sub-scores ────────────────────────────────────────────────────────────────

def _term_coverage(terms: list[str], text: str) -> float:
    """Fraction of *terms* present in *text* (0.0–1.0)."""
    if not terms or not text:
        return 0.0
    text_tokens = set(_tokenize(text))
    return sum(1 for t in terms if t in text_tokens) / len(terms)


def _tf_idf_score(terms: list[str], text: str) -> float:
    """
    Simplified TF score (IDF is approximated because we have one document).
    Returns 0.0–1.0.
    """
    if not terms or not text:
        return 0.0
    tokens = _tokenize(text)
    if not tokens:
        return 0.0
    counter = Counter(tokens)
    total   = len(tokens)
    # Average term frequency over query terms (terms not in doc contribute 0)
    tf_sum = sum(counter.get(t, 0) / total for t in terms)
    raw = tf_sum / len(terms)
    # Squash: score of 0.05 avg TF → ≈ 1.0 (saturates quickly for dense text)
    return min(1.0, raw / 0.05)


def _quality_score(source: ProcessedSource) -> float:
    """
    Heuristic quality score based on extraction completeness.
    Returns 0.0–1.0.
    """
    m = source.metadata
    score = 0.0

    # Word count: 500+ words is a "complete" article
    wc = m.word_count or 0
    score += min(wc / 500, 1.0) * 0.4

    # Extraction method quality
    method_weight = {
        ExtractionMethod.TRAFILATURA:   0.4,
        ExtractionMethod.BEAUTIFULSOUP: 0.3,
        ExtractionMethod.FALLBACK:      0.2,
        ExtractionMethod.NONE:          0.0,
    }
    score += method_weight.get(m.extraction_method, 0.0)

    # HTTP status 200 → bonus
    if m.http_status == 200:
        score += 0.2

    return min(score, 1.0)


# ── Scoring weights ───────────────────────────────────────────────────────────

_W_TITLE    = 0.25
_W_DESC     = 0.15
_W_CONTENT  = 0.35
_W_COVERAGE = 0.25


# ── Public API ────────────────────────────────────────────────────────────────

def score_source(source: ProcessedSource, query: str) -> RelevanceScore:
    """
    Compute a RelevanceScore for a single source against *query*.
    """
    terms = _query_terms(query)
    m     = source.metadata

    if not terms:
        # Can't score without query — return neutral scores
        return RelevanceScore(
            relevance_score        = 50.0,
            content_quality_score  = _quality_score(source) * 100,
            final_score            = 50.0,
            relevance_explanation  = "No query terms available for scoring.",
        )

    # Sub-scores (0.0–1.0)
    title_sc   = _term_coverage(terms, m.title or "")
    desc_sc    = _term_coverage(terms, m.description or m.snippet or "")
    content_sc = _tf_idf_score(terms, m.extracted_text or m.snippet or "")
    coverage_sc = _term_coverage(terms, " ".join(filter(None, [
        m.title, m.description, m.snippet, m.extracted_text
    ])))
    quality_sc = _quality_score(source)

    # Weighted relevance (0.0–1.0)
    relevance_raw = (
        title_sc   * _W_TITLE   +
        desc_sc    * _W_DESC    +
        content_sc * _W_CONTENT +
        coverage_sc * _W_COVERAGE
    )

    relevance_score = round(relevance_raw * 100, 2)
    quality_score   = round(quality_sc    * 100, 2)

    # Final: 70% relevance + 30% quality
    final_score = round(0.70 * relevance_score + 0.30 * quality_score, 2)

    explanation_parts = [
        f"Title match: {title_sc * 100:.0f}%",
        f"Description match: {desc_sc * 100:.0f}%",
        f"Content TF score: {content_sc * 100:.0f}%",
        f"Term coverage: {coverage_sc * 100:.0f}%",
        f"Content quality: {quality_sc * 100:.0f}%",
    ]

    return RelevanceScore(
        relevance_score       = relevance_score,
        content_quality_score = quality_score,
        final_score           = final_score,
        relevance_explanation = " | ".join(explanation_parts),
    )


def rank_sources(
    sources: List[ProcessedSource],
    query: str,
) -> List[ProcessedSource]:
    """
    Score and rank a list of ProcessedSource objects.

    Returns the same list (mutated in-place with scores attached) sorted
    by final_score descending.  Also sets ranking_position on each score.
    """
    if not sources:
        return []

    scored: list[tuple[float, ProcessedSource]] = []
    for source in sources:
        score = score_source(source, query)
        source.scores = score
        scored.append((score.final_score, source))

    scored.sort(key=lambda x: x[0], reverse=True)

    for position, (_, source) in enumerate(scored, start=1):
        if source.scores:
            source.scores.ranking_position = position

    return [src for _, src in scored]
