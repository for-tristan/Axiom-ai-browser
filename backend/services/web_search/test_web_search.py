"""Tests for the Web Search & Query Intelligence module (Task 2).

Run from inside the web_search folder:

    cd backend/services/web_search
    python test_web_search.py            # offline tests only (fast, no network)
    python test_web_search.py --live     # also run the live search + answer demo

The offline tests cover the pure-Python query intelligence layer
(classify / refine / split / URL detection). They run in milliseconds,
need no network, and are the part the team's CI should run on every PR.

The --live tests actually hit DuckDuckGo (and the NVIDIA LLM if a key is
set) so you can see the whole pipeline end to end. They need network and
are skipped by default.
"""

from __future__ import annotations

import sys

# Make the sibling modules importable when running this file directly.
from query_intelligence import (
    analyze,
    classify_query,
    extract_url,
    is_search_needed,
    refine_query,
    split_query,
    QueryIntent,
)
from result import SearchResult


# ── Tiny test framework (no pytest dependency for the offline suite) ─────
PASSED = 0
FAILED = 0


def check(got, expected, label: str):
    """Assert got == expected and print a PASS/FAIL line.

    Argument order is (got, expected, label) so test calls read naturally:
        check(classify_query("hi"), "greeting", "greeting is detected")
    """
    global PASSED, FAILED
    if got == expected:
        PASSED += 1
        print(f"  PASS  {label}")
    else:
        FAILED += 1
        print(f"  FAIL  {label}")
        print(f"        expected: {expected!r}")
        print(f"        got:      {got!r}")


def section(title: str):
    print(f"\n=== {title} ===")


# ── Tests: classify_query ───────────────────────────────────────────────
def test_classify():
    section("classify_query")

    check(classify_query(""), "empty", "empty")
    check(classify_query("   "), "empty", "empty")

    check(classify_query("hi"), "greeting", "greeting")
    check(classify_query("Hello"), "greeting", "greeting")
    check(classify_query("salam"), "greeting", "greeting")
    check(classify_query("good morning"), "greeting", "greeting")

    check(classify_query("thanks"), "chitchat", "chitchat")
    check(classify_query("thank you"), "chitchat", "chitchat")
    check(classify_query("ok cool"), "chitchat", "chitchat")
    check(classify_query("bye"), "chitchat", "chitchat")

    check(classify_query("https://en.wikipedia.org/wiki/Egypt"), "navigational", "navigational")
    check(classify_query("en.wikipedia.org/wiki/Egypt"), "navigational", "navigational")
    check(classify_query("github.com"), "navigational", "navigational")

    check(classify_query("what is the capital of France"), "factual", "factual")
    check(classify_query("What is the capital of France?"), "factual", "factual")
    check(classify_query("population of Japan 2024"), "factual", "factual")
    check(classify_query("define photosynthesis"), "factual", "factual")

    check(classify_query("how do I install electron"), "procedural", "procedural")
    check(classify_query("how to bake a cake"), "procedural", "procedural")
    check(classify_query("steps to deploy fastapi"), "procedural", "procedural")

    # Arabic question should be factual.
    check(classify_query("ما هي عاصمة مصر؟"), "factual", "factual")
    check(classify_query("ازاي اطلع حسابي"), "procedural", "procedural")


# ── Tests: extract_url ──────────────────────────────────────────────────
def test_extract_url():
    section("extract_url")

    check(extract_url("https://en.wikipedia.org/wiki/Egypt"),
          "https://en.wikipedia.org/wiki/Egypt", "absolute URL")
    check(extract_url("en.wikipedia.org/wiki/Egypt"),
          "https://en.wikipedia.org/wiki/Egypt", "bare domain gets https://")
    check(extract_url("http://localhost:3000"),
          "http://localhost:3000", "http URL preserved")
    check(extract_url("github.com/for-tristan/Axiom-ai-browser"),
          "https://github.com/for-tristan/Axiom-ai-browser", "URL with path")

    check(extract_url("what is github.com"), None, "URL inside a sentence → None")
    check(extract_url(""), None, "empty → None")
    check(extract_url("hello there"), None, "plain text → None")


# ── Tests: is_search_needed ─────────────────────────────────────────────
def test_is_search_needed():
    section("is_search_needed")

    check(is_search_needed("what is the capital of France"), True, "factual needs search")
    check(is_search_needed("how to install python"), True, "procedural needs search")
    check(is_search_needed("https://example.com"), True, "navigational needs (direct) fetch")

    check(is_search_needed("hi"), False, "greeting → no search")
    check(is_search_needed("thanks"), False, "chitchat → no search")
    check(is_search_needed(""), False, "empty → no search")
    check(is_search_needed("   "), False, "whitespace → no search")


# ── Tests: refine_query ─────────────────────────────────────────────────
def test_refine_query():
    section("refine_query")

    # Strips filler phrases.
    check(refine_query("Can you tell me what is the capital of France?"),
          "capital of France", "filler stripped")
    check(refine_query("What is the capital of France?"),
          "capital of France", "what is the stripped")
    check(refine_query("please define photosynthesis"),
          "photosynthesis", "please + define stripped")
    check(refine_query("Explain the difference between TCP and UDP"),
          "difference between TCP and UDP", "explain the stripped")
    check(refine_query('"Python programming language"'),
          "Python programming language", "quotes stripped")

    # Bare URL returned as-is.
    check(refine_query("en.wikipedia.org/wiki/Egypt"),
          "https://en.wikipedia.org/wiki/Egypt", "URL normalized")

    # Empty / whitespace.
    check(refine_query(""), "", "empty stays empty")
    check(refine_query("   "), "", "whitespace stays empty")


# ── Tests: split_query ──────────────────────────────────────────────────
def test_split_query():
    section("split_query")

    check(split_query("what is the capital of France"),
          ["capital of France"], "single question → single item")

    check(split_query("What is the capital of France and what is its population?"),
          ["capital of France", "its population"], "compound split on 'and'")

    check(split_query("define TCP and also define UDP"),
          ["TCP", "UDP"], "split on 'and also' (define stripped from both)")

    # Not compound (single short clause).
    parts = split_query("hi")
    check(parts, [], "greeting → empty list")

    # Bare URL not split.
    check(split_query("https://example.com"),
          ["https://example.com"], "URL not split")


# ── Tests: analyze (combined) ───────────────────────────────────────────
def test_analyze():
    section("analyze")

    r = analyze("What is the capital of France?")
    check((r.intent, r.refined), ("factual", "capital of France"), "factual analyze")
    check(r.url, None, "no url on factual")

    r = analyze("https://example.com")
    check((r.intent, r.url), ("navigational", "https://example.com"), "navigational analyze")

    r = analyze("hi")
    check(r.intent, "greeting", "greeting analyze")


# ── Tests: SearchResult.to_page ─────────────────────────────────────────
def test_to_page():
    section("SearchResult.to_page")

    sr = SearchResult(title="Egypt - Wikipedia",
                      url="https://en.wikipedia.org/wiki/Egypt",
                      snippet="Egypt is a country...",
                      source="duckduckgo", rank=1)
    page = sr.to_page()
    check(page, {"title": "Egypt - Wikipedia",
                 "url": "https://en.wikipedia.org/wiki/Egypt",
                 "content": "Egypt is a country..."}, "default uses snippet")

    page = sr.to_page(content="FULL TEXT")
    check(page, {"title": "Egypt - Wikipedia",
                 "url": "https://en.wikipedia.org/wiki/Egypt",
                 "content": "FULL TEXT"}, "explicit content overrides snippet")


# ── Tests: DuckDuckGo HTML parser (offline, against a saved fixture) ────
def test_ddg_parser():
    """Parse a saved DDG HTML page and check the parser extracts results.

    This proves the parser works without needing network access. The
    fixture (test_fixtures/ddg_capital_of_france.html) was captured from
    a real DuckDuckGo response for the query "capital of France".
    """
    section("DuckDuckGo HTML parser (offline fixture)")
    import os
    from search_providers import DuckDuckGoProvider

    fixture = os.path.join(os.path.dirname(__file__), "test_fixtures",
                           "ddg_capital_of_france.html")
    if not os.path.exists(fixture):
        check(False, True, "fixture file present")
        return

    html = open(fixture, encoding="utf-8").read()
    results = DuckDuckGoProvider._parse(html, max_results=5)

    check(len(results) > 0, True, "parser returns results")
    if not results:
        return

    check(len(results), 5, "returns exactly 5 results when asked for 5")

    first = results[0]
    check(first.rank, 1, "first result has rank 1")
    check(bool(first.title), True, "first result has a title")
    check(first.url.startswith("http"), True,
          "URL is unwrapped to a real http(s) link")
    check("duckduckgo.com" not in first.url, True,
          "DDG redirect is stripped from URL")
    check(bool(first.snippet), True, "first result has a snippet")
    check(first.source, "duckduckgo", "source is tagged duckduckgo")


# ── Live tests (network) ────────────────────────────────────────────────
def test_live_search():
    """Hit DuckDuckGo for real and print the result. Needs network."""
    section("LIVE: search_for_pages (DuckDuckGo)")
    from pipeline import search_for_pages

    question = "What is the capital of France?"
    print(f"  question: {question}")
    pages = search_for_pages(question, max_results=3, fetch_content=False)
    if not pages:
        print("  (no results — check network / DDG availability)")
        return
    for i, p in enumerate(pages, 1):
        print(f"  [{i}] {p['title']}")
        print(f"      {p['url']}")
        snippet = (p.get('content') or '')[:120].replace('\n', ' ')
        print(f"      snippet: {snippet}...")


def test_live_answer():
    """Full pipeline: search + (optional) LLM answer. Needs network + key."""
    section("LIVE: search_for_answer (DuckDuckGo + ai_chat)")
    from pipeline import search_for_answer

    question = "What is the capital of France?"
    print(f"  question: {question}")
    result = search_for_answer(question, max_results=3, fetch_content=False)
    print(f"  answer: {result.get('answer', '')[:300]}")
    print(f"  citations: {len(result.get('citations', []))}")
    print(f"  sources: {len(result.get('sources', []))}")


# ── Main ────────────────────────────────────────────────────────────────
def main():
    print("Axiom — Web Search & Query Intelligence tests")
    print(f"Python {sys.version.split()[0]}")

    test_classify()
    test_extract_url()
    test_is_search_needed()
    test_refine_query()
    test_split_query()
    test_analyze()
    test_to_page()
    test_ddg_parser()

    if "--live" in sys.argv:
        try:
            test_live_search()
        except Exception as exc:
            print(f"  (live search skipped: {exc})")
        try:
            test_live_answer()
        except Exception as exc:
            print(f"  (live answer skipped: {exc})")

    print(f"\n=== Summary: {PASSED} passed, {FAILED} failed ===")
    sys.exit(1 if FAILED else 0)


if __name__ == "__main__":
    main()
