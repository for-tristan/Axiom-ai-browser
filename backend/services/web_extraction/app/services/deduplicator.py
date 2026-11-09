"""
Source deduplication service.

Detection strategies (applied in order)
-----------------------------------------
1. **Normalised URL comparison** — strip tracking parameters, URL fragments,
   trailing slashes and common campaign parameters (utm_*, ref, fbclid, …).
2. **Canonical URL comparison** — if two sources share the same canonical_url
   they are the same page.
3. **Content hash comparison** — SHA-256 of normalised text; catches pages
   served under multiple paths with identical text.
4. **Partial similarity** — if two texts share > 90% token overlap (Jaccard)
   they are considered near-duplicates.

The first source (by search rank) is kept; later duplicates are marked and
excluded from the ranked output but their URLs are preserved in the response.

We never merge unrelated articles from the same domain.
"""

from __future__ import annotations

import re
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

from app.models.schemas import DuplicateInfo, ProcessedSource, SourceMetadata
from app.utils.text_utils import content_hash

# Query parameters that are purely for tracking — strip them when comparing
_TRACKING_PARAMS = {
    "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
    "utm_id", "fbclid", "gclid", "msclkid", "ref", "referrer",
    "_ga", "source", "campaign", "mc_cid", "mc_eid",
}


# ── URL normalisation ─────────────────────────────────────────────────────────

def normalize_url(url: str) -> str:
    """
    Return a canonical form of *url* for dedup comparison.

    Steps
    -----
    * Lower-case the scheme and host.
    * Remove the URL fragment (#section).
    * Remove known tracking query parameters.
    * Sort remaining query parameters for stable comparison.
    * Remove a trailing slash from the path (but keep "/" if that IS the path).
    """
    if not url:
        return ""
    try:
        parsed = urlparse(url)
    except Exception:
        return url.lower().strip()

    scheme = parsed.scheme.lower()
    netloc = parsed.netloc.lower()
    path   = parsed.path.rstrip("/") or "/"

    # Strip tracking params from query string
    qs = parse_qs(parsed.query, keep_blank_values=False)
    filtered = {k: v for k, v in qs.items() if k.lower() not in _TRACKING_PARAMS}
    # Sorted for deterministic comparison
    clean_query = urlencode(sorted(filtered.items()), doseq=True)

    normalised = urlunparse((scheme, netloc, path, "", clean_query, ""))
    return normalised


# ── Similarity ────────────────────────────────────────────────────────────────

def _jaccard_similarity(a: str, b: str) -> float:
    """Word-level Jaccard similarity between two strings."""
    if not a or not b:
        return 0.0
    set_a = set(a.lower().split())
    set_b = set(b.lower().split())
    if not set_a and not set_b:
        return 1.0
    intersection = len(set_a & set_b)
    union = len(set_a | set_b)
    return intersection / union if union else 0.0


# ── Public API ────────────────────────────────────────────────────────────────

SIMILARITY_THRESHOLD = 0.90   # 90 % Jaccard overlap = near-duplicate


def deduplicate_sources(
    sources: list[ProcessedSource],
) -> tuple[list[ProcessedSource], list[DuplicateInfo]]:
    """
    Remove duplicate sources and return (unique_sources, duplicate_infos).

    Parameters
    ----------
    sources : List of ProcessedSource objects, ordered by preference
              (first occurrence wins).

    Returns
    -------
    unique_sources : De-duplicated list (preserving order of first occurrence).
    duplicates     : List of DuplicateInfo objects describing each removed item.
    """
    seen_urls: dict[str, str]           = {}   # norm_url → canonical source_id
    seen_canonical: dict[str, str]      = {}   # canonical_url → source_id
    seen_hashes: dict[str, str]         = {}   # content_hash → source_id
    unique: list[ProcessedSource]       = []
    duplicates: list[DuplicateInfo]     = []

    # We also keep raw texts for similarity comparison
    unique_texts: list[str]             = []

    for source in sources:
        m = source.metadata
        norm = normalize_url(m.original_url)
        final_norm = normalize_url(m.final_url or m.original_url)
        canonical  = normalize_url(m.canonical_url or "")

        # 1. URL comparison
        if norm in seen_urls or final_norm in seen_urls:
            master_id = seen_urls.get(norm) or seen_urls.get(final_norm) or norm
            duplicates.append(DuplicateInfo(
                duplicate_url = m.original_url,
                canonical_url = master_id,
                reason        = "url_normalized",
            ))
            continue

        # 2. Canonical URL comparison
        if canonical and canonical in seen_canonical:
            duplicates.append(DuplicateInfo(
                duplicate_url = m.original_url,
                canonical_url = canonical,
                reason        = "canonical_url",
            ))
            seen_urls[norm] = canonical        # register so URL check catches it too
            continue

        # 3. Content hash comparison
        text = m.extracted_text or m.snippet or ""
        if text:
            h = content_hash(text)
            if h in seen_hashes:
                duplicates.append(DuplicateInfo(
                    duplicate_url = m.original_url,
                    canonical_url = seen_hashes[h],
                    reason        = "content_hash",
                ))
                seen_urls[norm] = seen_hashes[h]
                continue

        # 4. Similarity check against already-unique sources
        if text:
            for idx, prev_text in enumerate(unique_texts):
                if _jaccard_similarity(text, prev_text) >= SIMILARITY_THRESHOLD:
                    ref_url = unique[idx].metadata.original_url
                    duplicates.append(DuplicateInfo(
                        duplicate_url = m.original_url,
                        canonical_url = ref_url,
                        reason        = "similarity",
                    ))
                    seen_urls[norm] = ref_url
                    break
            else:
                # No duplicate found — add to unique set
                _register(norm, final_norm, canonical, text, m.source_id,
                           seen_urls, seen_canonical, seen_hashes)
                unique.append(source)
                unique_texts.append(text)
            continue

        # No text to compare — keep by URL uniqueness
        _register(norm, final_norm, canonical, "", m.source_id,
                   seen_urls, seen_canonical, seen_hashes)
        unique.append(source)
        unique_texts.append("")

    return unique, duplicates


def _register(
    norm: str,
    final_norm: str,
    canonical: str,
    text: str,
    source_id: str,
    seen_urls: dict,
    seen_canonical: dict,
    seen_hashes: dict,
) -> None:
    seen_urls[norm] = source_id
    if final_norm:
        seen_urls[final_norm] = source_id
    if canonical:
        seen_canonical[canonical] = source_id
    if text:
        seen_hashes[content_hash(text)] = source_id
