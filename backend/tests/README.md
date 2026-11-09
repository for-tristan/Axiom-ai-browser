# Axiom AI Backend — Unified Tests

This directory contains the **unified end-to-end test** for the Axiom AI
pipeline. It exercises all three AI tasks as a single integrated system:

```
user question
    │
    ▼
Task 2: query_intelligence → search_providers → extraction_bridge
    │  (classify, refine, search, fetch+extract via Task 3)
    ▼
[{title, url, content}, ...]   ← the page dict contract
    │
    ▼
Task 1: answer_generator.answer_with_citations
    │  (LLM call mocked — we verify the wiring, not the LLM)
    ▼
{answer, citations, sources}
```

## Running the tests

```bash
# From the backend/ directory:
cd backend
python -m pytest tests/ -v

# Or from the tests/ directory:
cd backend/tests
python -m pytest test_ai_pipeline.py -v
```

All tests run **fully offline** — network calls (search engine, page
fetching) and the LLM are mocked. No API keys are required.

## What's covered

| Test class | What it verifies |
|---|---|
| `TestQueryIntelligence` | Task 2's query classification, refinement, splitting, URL detection |
| `TestSearchToExtraction` | Task 2 → Task 3 wiring: search results flow through Task 3's Trafilatura extractor |
| `TestTask1Contract` | Task 1 accepts the page dicts from Task 2+3; citations are extracted correctly |
| `TestFullPipeline` | End-to-end: question → search → extract → LLM answer with citations |
| `TestTask3Standalone` | Task 3's extractor, cleaner, and SSRF security work independently |

## The integration wiring

Task 2's `pipeline.py` now calls Task 3's extraction pipeline via
`extraction_bridge.py` (which replaced the old `content_fetcher.py`
bridge). The bridge imports Task 3's `fetch_urls` + `extract_content` +
`clean_text` at the Python level — no HTTP call to the Task 3 FastAPI
service needed, so the pipeline works without running a separate server.

```
backend/services/
├── ai_chat/              # Task 1: LLM Integration & Answer Generation
├── web_search/           # Task 2: Web Search & Query Intelligence
│   ├── pipeline.py       # ← wires Task 2 → Task 3 → Task 1
│   └── extraction_bridge.py  # ← delegates to Task 3's extractor
└── web_extraction/       # Task 3: Web Extraction & Source Processing
```
