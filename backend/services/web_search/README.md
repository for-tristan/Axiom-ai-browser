# Web Search & Query Intelligence (Task 2)

This module is the "search brain" of the Axiom AI chat. It takes a raw
user message, decides whether it needs a web search at all, cleans it
up, runs the search, and returns source pages that **Task 1** (LLM
Integration & Answer Generation) uses to write a grounded answer.

It is intentionally self-contained: no database, no LLM call (except
the optional `search_for_answer` convenience), no Electron. Just query
intelligence + web search + a minimal content fetcher.

---

## What it does

```
user message
   │
   ▼
┌──────────────────────┐
│  query_intelligence  │  classify (greeting / chitchat / factual /
│                      │  procedural / navigational)
│                      │  refine  (strip filler, quotes, punctuation)
│                      │  split   (compound "X and Y" → [X, Y])
│                      │  extract_url (bare URL → navigational)
└──────────┬───────────┘
           │ if needs search
           ▼
┌──────────────────────┐
│  search_providers    │  DuckDuckGo (default, no key)
│                      │  Brave Search (if BRAVE_API_KEY set)
└──────────┬───────────┘
           │ list[SearchResult]
           ▼
┌──────────────────────┐
│  content_fetcher     │  (bridge) fetch + clean page text until
│                      │  Task 3 ships a real extractor
└──────────┬───────────┘
           │
           ▼
   list[{"title","url","content"}]  ──► Task 1: answer_generator
```

The page dict shape **matches exactly** what `backend/services/ai_chat/
answer_generator.py::answer_with_citations` expects, so Task 2 and
Task 1 compose with zero glue code.

---

## Quick start

```bash
# 1. Install deps (from repo root)
pip install -r backend/services/web_search/requirements.txt

# 2. Run the tests (offline, no network needed)
cd backend/services/web_search
python test_web_search.py
# → 63 passed, 0 failed

# 3. Try a live search (needs network)
python test_web_search.py --live
```

---

## Using it from Python

```python
# Just the search (returns source pages):
from backend.services.web_search import search_for_pages

pages = search_for_pages("What is the capital of France?")
# → [{"title": "Paris - Wikipedia",
#     "url": "https://en.wikipedia.org/wiki/Paris",
#     "content": "..."}, ...]

# Search + Task 1's answer generation in one call:
from backend.services.web_search import search_for_answer

result = search_for_answer("What is the capital of France?")
# → {"answer": "The capital of France is Paris [1].",
#    "citations": [{"number": 1, "title": "...", "url": "..."}],
#    "sources": [...]}
```

---

## Using it over HTTP

The FastAPI router in `backend/api/routes_search.py` exposes three
endpoints:

| Method | Path               | Body                      | Returns                |
|--------|--------------------|---------------------------|------------------------|
| POST   | `/search`          | `{question, max_results}` | source pages           |
| POST   | `/search/answer`   | `{question, max_results}` | answer + citations     |
| POST   | `/search/analyze`  | `{question}`              | intent + refined query |

```bash
# Start the API:
cd backend/api
uvicorn main:app --reload --port 8000

# Classify a query (offline, no network, instant):
curl -X POST http://localhost:8000/search/analyze \
  -H "Content-Type: application/json" \
  -d '{"question":"Can you tell me what is the capital of France?"}'
# → {"intent":"factual","refined":"capital of France",
#    "url":null,"needs_search":true}
```

---

## Search providers

| Provider  | Needs key?      | Quality | Notes                                  |
|-----------|-----------------|---------|----------------------------------------|
| DuckDuckGo| No              | Medium  | Default; scrapes `html.duckduckgo.com` |
| Brave     | `BRAVE_API_KEY` | High    | Use in production; clean rate limits   |

Pick automatically (Brave if key present, else DuckDuckGo):

```python
from backend.services.web_search import get_provider
engine = get_provider()           # auto
engine = get_provider("brave")    # force Brave
engine = get_provider("duckduckgo")  # force DuckDuckGo
```

---

## Design decisions

1. **Rule-based query intelligence, not LLM.** Classify/refine/split run
   in microseconds, cost nothing, and are deterministic. An LLM call to
   "decide whether to search" would add latency and tokens to every
   message, including "hi". The rules cover the cases that matter for
   search routing; an LLM-expand step can be added later behind a flag.

2. **Conservative classification.** When in doubt, classify as `factual`
   and search. Running an unnecessary search is cheap; skipping a search
   the user needed is a broken experience.

3. **Snippet fallback.** If `content_fetcher` fails to get full page
   text (paywall, JS-only site, timeout), the search snippet is used as
   `content`. The answer generator always has *something* to cite, so
   the pipeline degrades gracefully instead of erroring.

4. **`content_fetcher` is a bridge.** It does plain HTTP + BeautifulSoup
   text extraction. When **Task 3** (Web Extraction & Source Processing)
   ships a stronger extractor (trafilatura / readability / PDF), the
   pipeline should call that instead. The contract is just
   `url -> cleaned text string`.

5. **Flat imports inside the folder**, matching the existing `ai_chat/`
   convention, so the module can be run and tested standalone without
   package boilerplate. The FastAPI router handles the path setup.

---

## Files

| File                      | Purpose                                       |
|---------------------------|-----------------------------------------------|
| `query_intelligence.py`   | classify / refine / split / URL detection     |
| `search_providers.py`     | DuckDuckGo + Brave backends, `get_provider()` |
| `content_fetcher.py`      | bridge: fetch URL → cleaned text              |
| `pipeline.py`             | orchestrator: `search_for_pages` / `_answer`  |
| `result.py`               | `SearchResult` dataclass + `to_page()`        |
| `__init__.py`             | public API                                    |
| `test_web_search.py`      | 63 offline tests + optional `--live` demo     |
| `test_fixtures/`          | saved DDG HTML for offline parser tests       |
| `requirements.txt`        | requests, beautifulsoup4, python-dotenv       |

---

## Integration with the rest of Axiom

- **Task 1 (LLM Integration):** consumes the `{"title","url","content"}`
  page dicts this module produces. See `search_for_answer()` for the
  wired-together call.
- **Task 3 (Web Extraction):** should replace `content_fetcher.py` with
  a proper extractor. The `fetch_page_content(url) -> str` contract
  stays the same.
- **Frontend:** can call `POST /search/analyze` on every keystroke to
  show/hide a "searching the web…" indicator, and `POST /search/answer`
  when the user submits their question.
