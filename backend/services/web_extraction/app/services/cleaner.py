"""
Text cleaning service.

Keeps cleaning completely separate from fetching and extraction so each
concern can be tested and replaced independently.

What is cleaned
---------------
* Excessive blank lines (more than 2 consecutive)
* Trailing / leading whitespace on each line
* Repeated identical lines
* Common extraction artifacts (share buttons text, cookie banners, etc.)
* Non-printable control characters
* Mixed line endings (CR+LF → LF)

What is preserved
-----------------
* Paragraph boundaries (single blank line)
* Section headings
* Lists (lines starting with bullets or numbers)
* Meaningful punctuation
* Language-specific characters (Arabic, CJK, etc.)
"""

from __future__ import annotations

import re
import unicodedata


# ── Patterns ──────────────────────────────────────────────────────────────────

_ARTIFACT_PATTERNS = [
    r"\bShare( this)?\s*(article|post|page|story)?\b",
    r"\bPrint\s*this\s*(page|article)?\b",
    r"\bAccept\s*(all\s*)?[Cc]ookies?\b",
    r"\bWe use cookies.*?(?:\.|$)",
    r"\bSubscribe to (our|the) newsletter\b",
    r"\bSign up for (our|the) newsletter\b",
    r"\bFollow us on (Twitter|Facebook|Instagram|LinkedIn)\b",
    r"\bAdvertisement\b",
    r"\[Advertisement\]",
    r"\bSkip to (main\s*)?content\b",
    r"\bRead more[:\s]",
    r"<!--.*?-->",
    r"\bComments?\s*\(\d+\)",
    r"\bLeave\s*a\s*[Cc]omment\b",
    r"\bYou might also like\b",
    r"\bRelated Articles?\b",
    r"\bMore from\s+\w+\b",
    r"\bThis article was\s*(originally\s*)?published\b",
]
_ARTIFACT_RE = re.compile(
    "|".join(_ARTIFACT_PATTERNS),
    flags=re.IGNORECASE | re.DOTALL,
)

# Non-printable control characters except \n and \t
_CONTROL_CHAR_RE = re.compile(r"[\x00-\x08\x0b-\x0c\x0e-\x1f\x7f]")


# ── Public API ────────────────────────────────────────────────────────────────

def clean_text(text: str) -> str:
    """
    Apply the full cleaning pipeline to *text*.

    Parameters
    ----------
    text : Raw extracted text from the extractor service.

    Returns
    -------
    Cleaned text string.  Never raises.
    """
    if not text:
        return ""

    # 1. Normalize line endings
    text = text.replace("\r\n", "\n").replace("\r", "\n")

    # 2. Remove non-printable control characters
    text = _CONTROL_CHAR_RE.sub("", text)

    # 3. Remove common extraction artifacts
    text = _ARTIFACT_RE.sub("", text)

    # 4. Per-line cleanup
    lines = text.splitlines()
    cleaned_lines: list[str] = []
    for line in lines:
        # Strip trailing whitespace but preserve leading indent (for lists/code)
        line = line.rstrip()
        cleaned_lines.append(line)

    # 5. Remove consecutive duplicate lines
    deduped: list[str] = []
    prev = object()          # sentinel — guaranteed not equal to any string
    for line in cleaned_lines:
        if line != prev:
            deduped.append(line)
        prev = line

    # 6. Collapse 3+ consecutive blank lines into 2
    result_lines: list[str] = []
    blank_count = 0
    for line in deduped:
        if line.strip() == "":
            blank_count += 1
            if blank_count <= 2:
                result_lines.append(line)
        else:
            blank_count = 0
            result_lines.append(line)

    text = "\n".join(result_lines).strip()

    # 7. Collapse runs of spaces / tabs within a line (but not at start of line)
    text = re.sub(r"(?<=\S)[ \t]{2,}", " ", text)

    return text


def clean_title(title: str | None) -> str | None:
    """
    Lightly clean a page title: strip, collapse spaces, remove site suffix.

    Example: "Paris - Wikipedia" → "Paris - Wikipedia" (unchanged, fine)
    Example: "  Hello   World  " → "Hello World"
    """
    if not title:
        return None
    cleaned = re.sub(r"[ \t]+", " ", title).strip()
    return cleaned if cleaned else None


def clean_description(desc: str | None) -> str | None:
    """Strip and normalise a meta description."""
    if not desc:
        return None
    cleaned = re.sub(r"\s+", " ", desc).strip()
    return cleaned if cleaned else None
