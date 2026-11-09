# Axiom – Task 3: Web Page Content Extraction & Source Processing

> **Part of the Axiom AI Browser graduation project.**
> Task 3 is an independently runnable FastAPI microservice that fetches web pages,
> extracts main article content, deduplicates sources, scores them for relevance,
> and produces RAG-ready chunks — all without requiring any API key.

---

## 1. Project Overview

The Axiom AI Browser is a graduation project composed of three modules:

| Module | Responsibility |
|--------|---------------|
| **Task 1** | LLM Integration & Answer Generation |
| **Task 2** | Web Search & Query Intelligence |
| **Task 3 ← (this module)** | Web Page Content Extraction & Source Processing |

Task 3 sits between Task 2 (which finds URLs) and Task 1 (which generates answers).
It takes raw search results, fetches the actual web pages, extracts clean article
text, removes duplicates, scores sources by relevance, and returns structured data
that Task 1 can use directly.

---

## 2. Task 3 Responsibilities

1. **SSRF-safe URL validation** — blocks localhost, private IPs, cloud metadata endpoints
2. **Async web fetching** — concurrent HTTP/HTTPS requests with timeout and size limits
3. **Intelligent content extraction** — Trafilatura (primary) + BeautifulSoup (fallback)
4. **Rich metadata extraction** — title, author, date, language, canonical URL
5. **Text cleaning** — removes artifacts, boilerplate, tracking widgets
6. **Duplicate detection** — URL normalization, canonical URL, content hashing, Jaccard similarity
7. **Relevance scoring** — TF-IDF–inspired scoring (no LLM required)
8. **RAG-ready chunking** — paragraph-aware, overlapping chunks with full source attribution
9. **FastAPI REST API** — `/health`, `/extract`, `/process-sources` with Swagger docs

---

## 3. Architecture

```
POST /process-sources (Task 2 output)
         │
         ▼
┌─────────────────────┐
│  URL Security       │  SSRF protection, scheme validation, DNS check
│  url_security.py    │
└──────────┬──────────┘
           │ safe URLs
           ▼
┌─────────────────────┐
│  Fetcher            │  Async HTTPX, bounded concurrency, redirect validation
│  fetcher.py         │
└──────────┬──────────┘
           │ FetchResult[]
           ▼
┌─────────────────────┐
│  Extractor          │  Trafilatura → BeautifulSoup fallback
│  extractor.py       │
└──────────┬──────────┘
           │ ExtractionResult[]
           ▼
┌─────────────────────┐
│  Cleaner            │  Normalize whitespace, remove artifacts
│  cleaner.py         │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Metadata Builder   │  Assembles SourceMetadata Pydantic models
│  metadata.py        │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Deduplicator       │  URL norm, canonical, content hash, Jaccard sim
│  deduplicator.py    │
└──────────┬──────────┘
           │ unique ProcessedSource[]
           ▼
┌─────────────────────┐
│  Relevance Scorer   │  TF-IDF scoring, quality scoring, final ranking
│  relevance.py       │
└──────────┬──────────┘
           │ ranked ProcessedSource[]
           ▼
┌─────────────────────┐
│  Chunker            │  Paragraph-aware overlapping chunks
│  chunker.py         │
└──────────┬──────────┘
           │ ContentChunk[]
           ▼
  ProcessSourcesResponse
  (includes task1_pages for Task 1)
```

---

## 4. Technologies

| Technology | Version | Purpose |
|-----------|---------|---------|
| Python | 3.11+ | Runtime |
| FastAPI | ≥0.111 | REST API framework |
| Uvicorn | ≥0.29 | ASGI server |
| HTTPX | ≥0.27 | Async HTTP client |
| BeautifulSoup4 | ≥4.12 | HTML parsing |
| lxml | ≥5.2 | Fast HTML/XML parser |
| Trafilatura | ≥1.10 | Main-content extraction |
| Pydantic v2 | ≥2.7 | Data validation |
| pydantic-settings | ≥2.3 | Config management |
| python-dotenv | ≥1.0 | .env support |
| pytest | ≥8.2 | Test framework |
| pytest-asyncio | ≥0.23 | Async test support |

---

## 5. Project Structure

```
Task3-WebExtraction/
│
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI app entry point
│   ├── config.py            # Centralized settings (pydantic-settings)
│   │
│   ├── api/
│   │   ├── __init__.py
│   │   └── routes.py        # /health, /extract, /process-sources
│   │
│   ├── models/
│   │   ├── __init__.py
│   │   └── schemas.py       # All Pydantic models
│   │
│   ├── services/
│   │   ├── __init__.py
│   │   ├── fetcher.py       # Async HTTP fetching engine
│   │   ├── extractor.py     # Content extraction (Trafilatura + BS4)
│   │   ├── cleaner.py       # Text cleaning & normalization
│   │   ├── metadata.py      # SourceMetadata builder
│   │   ├── deduplicator.py  # Duplicate detection & removal
│   │   ├── relevance.py     # TF-IDF relevance scoring & ranking
│   │   ├── validator.py     # Source validity checks
│   │   └── chunker.py       # RAG-ready paragraph chunking
│   │
│   └── utils/
│       ├── __init__.py
│       ├── url_security.py  # SSRF protection
│       └── text_utils.py    # Shared text helpers
│
├── tests/
│   ├── __init__.py
│   ├── conftest.py          # Shared fixtures and HTML samples
│   ├── test_fetcher.py      # Fetching engine tests
│   ├── test_extractor.py    # Content extraction tests
│   ├── test_cleaner.py      # Text cleaning tests
│   ├── test_metadata.py     # Metadata builder tests
│   ├── test_deduplicator.py # Deduplication tests
│   ├── test_relevance.py    # Scoring and ranking tests
│   ├── test_chunker.py      # Chunking tests
│   ├── test_security.py     # SSRF protection tests
│   └── test_api.py          # FastAPI endpoint tests
│
├── .env.example             # Template for environment variables
├── .gitignore
├── pytest.ini
├── requirements.txt
└── README.md
```

---

## 6. Installation

### Prerequisites
- Python 3.11 or higher
- pip

### Steps (Windows PowerShell)

```powershell
# 1. Navigate to the Task 3 directory
cd "Task3-WebExtraction"

# 2. Create a virtual environment
python -m venv .venv

# 3. Activate the virtual environment
.venv\Scripts\Activate.ps1

# 4. Install dependencies
pip install -r requirements.txt

# 5. Copy the example environment file
Copy-Item .env.example .env
```

---

## 7. Configuration

All settings are in `.env` (copy from `.env.example`).

| Variable | Default | Description |
|----------|---------|-------------|
| `ENVIRONMENT` | `development` | Runtime environment |
| `HOST` | `0.0.0.0` | Server bind address |
| `PORT` | `8003` | Server port |
| `REQUEST_TIMEOUT` | `15` | HTTP timeout (seconds) |
| `MAX_RESPONSE_SIZE` | `5242880` | Max response body (bytes, 5 MB) |
| `MAX_CONCURRENT_REQUESTS` | `10` | Max simultaneous connections |
| `MAX_URLS_PER_REQUEST` | `20` | Max URLs per API call |
| `CHUNK_SIZE` | `1000` | RAG chunk size (characters) |
| `CHUNK_OVERLAP` | `200` | Chunk overlap (characters) |
| `LOG_LEVEL` | `INFO` | Logging verbosity |

**No API key is required.** This service works fully offline.

---

## 8. Running the Application

```powershell
# From inside Task3-WebExtraction with .venv activated:
uvicorn app.main:app --host 0.0.0.0 --port 8003 --reload
```

The server starts at: `http://localhost:8003`

---

## 9. API Documentation

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Service health check |
| `/extract` | POST | Extract content from URLs |
| `/process-sources` | POST | Full pipeline: search results → ranked, chunked sources |
| `/docs` | GET | Swagger UI |
| `/redoc` | GET | ReDoc documentation |

---

## 10. Example Requests

### GET /health
```bash
curl http://localhost:8003/health
```

### POST /extract
```bash
curl -X POST http://localhost:8003/extract \
  -H "Content-Type: application/json" \
  -d '{
    "urls": ["https://en.wikipedia.org/wiki/Python_(programming_language)"],
    "query": "Python programming",
    "include_chunks": true
  }'
```

### POST /process-sources (Task 2 → Task 3 integration)
```bash
curl -X POST http://localhost:8003/process-sources \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What is the capital of France?",
    "search_results": [
      {
        "title": "Paris - Wikipedia",
        "url": "https://en.wikipedia.org/wiki/Paris",
        "snippet": "Paris is the capital and most populous city of France.",
        "source": "duckduckgo",
        "rank": 1
      },
      {
        "title": "France - Wikipedia",
        "url": "https://en.wikipedia.org/wiki/France",
        "snippet": "France is a country in Western Europe.",
        "source": "duckduckgo",
        "rank": 2
      }
    ],
    "include_chunks": true
  }'
```

---

## 11. Example Response (POST /process-sources)

```json
{
  "query": "What is the capital of France?",
  "processed_sources": [ ... ],
  "failed_sources": [],
  "duplicates": [],
  "ranked_sources": [
    {
      "metadata": {
        "source_id": "src_a1b2c3d4e5f6",
        "original_url": "https://en.wikipedia.org/wiki/Paris",
        "final_url": "https://en.wikipedia.org/wiki/Paris",
        "title": "Paris - Wikipedia",
        "description": "Paris is the capital and most populous city of France.",
        "domain": "en.wikipedia.org",
        "extracted_text": "Paris is the capital ... [full article text]",
        "word_count": 1823,
        "extraction_method": "trafilatura",
        "extraction_status": "success"
      },
      "scores": {
        "relevance_score": 87.5,
        "content_quality_score": 92.0,
        "final_score": 89.0,
        "ranking_position": 1,
        "relevance_explanation": "Title match: 100% | Description match: 80% | ..."
      }
    }
  ],
  "chunks": [
    {
      "chunk_id": "550e8400-e29b-41d4-a716-446655440000",
      "source_id": "src_a1b2c3d4e5f6",
      "chunk_index": 0,
      "section_title": "Overview",
      "content": "Paris is the capital and most populous city of France ...",
      "start_position": 0,
      "end_position": 998,
      "token_estimate": 249,
      "source_url": "https://en.wikipedia.org/wiki/Paris"
    }
  ],
  "task1_pages": [
    {
      "title": "Paris - Wikipedia",
      "url": "https://en.wikipedia.org/wiki/Paris",
      "content": "Paris is the capital and most populous city of France ..."
    }
  ],
  "stats": {
    "total_requested": 2,
    "successfully_fetched": 2,
    "successfully_extracted": 2,
    "failed": 0,
    "duplicates_removed": 0,
    "total_chunks": 8,
    "processing_time_seconds": 1.234
  }
}
```

---

## 12. Testing

```powershell
# From inside Task3-WebExtraction with .venv activated:

# Run all tests
pytest

# Run with verbose output
pytest -v

# Run a specific test file
pytest tests/test_security.py -v

# Run with coverage (if coverage installed)
pytest --cov=app --cov-report=term-missing
```

---

## 13. Integration with Task 1

Task 1 (`answer_generator.answer_with_citations`) expects:
```python
pages = [{"title": str, "url": str, "content": str}, ...]
```

Task 3 provides this directly in the `task1_pages` field of `POST /process-sources`.

### Integration code (Team Leader):
```python
import requests

# 1. Get search results from Task 2
search_results = task2_pipeline.search_for_pages("What is the capital of France?")

# 2. Convert Task 2 SearchResult objects to the Task 3 input format
task3_input = {
    "query": "What is the capital of France?",
    "search_results": [
        {
            "title": r["title"],
            "url": r["url"],
            "snippet": r.get("content", ""),  # Task 2 uses "content" as the snippet
            "source": "duckduckgo",
            "rank": i + 1
        }
        for i, r in enumerate(search_results)
    ]
}

# 3. Send to Task 3
response = requests.post("http://localhost:8003/process-sources", json=task3_input)
data = response.json()

# 4. Feed ranked pages to Task 1
pages = data["task1_pages"]
result = answer_with_citations(question, pages)
```

---

## 14. Integration with Task 2

Task 2 returns:
```python
[{"title": str, "url": str, "content": str}]  # content = snippet or fetched text
```

Task 3's `SearchResultInput` accepts:
```json
{"title": str, "url": str, "snippet": str, "source": str, "rank": int, "content": str|null}
```

**Field mapping:**

| Task 2 field | Task 3 field | Notes |
|---|---|---|
| `title` | `title` | Direct match |
| `url` | `url` | Direct match |
| `content` | `snippet` **or** `content` | Use `snippet` for search snippets, `content` for pre-fetched full text |
| `source` (from `SearchResult.source`) | `source` | Direct match |
| `rank` (from `SearchResult.rank`) | `rank` | Direct match |

Task 3 will re-fetch and extract the full page content itself, using Task 2's
`content` only as a fallback if extraction fails.

---

## 15. Known Limitations

1. **JavaScript-rendered pages**: Sites that require JavaScript execution (SPAs)
   cannot be fully extracted. These are returned with `extraction_status: "unsupported_dynamic_content"`.
   A future version could integrate Playwright for browser rendering.

2. **Paywalled content**: Pages behind authentication or paywalls return
   limited or no content. The search snippet is used as a fallback.

3. **DNS rebinding**: The current DNS check mitigates but does not fully
   prevent DNS rebinding attacks (a time-of-check/time-of-use gap exists).
   Production deployments should use a network-level SSRF firewall.

4. **PDF and binary files**: Non-HTML content is currently not extracted.
   PDF support can be added via `pdfminer.six` or `pypdf`.

5. **Rate limiting**: Task 3 does not implement per-domain rate limiting.
   Heavy use may trigger HTTP 429 responses from some sites.

6. **Similarity deduplication**: The Jaccard similarity check compares full
   texts, which is O(n²) for large batches. For production scale, use
   MinHash LSH instead.
