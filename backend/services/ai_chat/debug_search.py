"""Debug: test each step of the search pipeline separately."""
import sys, os, requests

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "web_search"))

# Step 1: Does query intelligence work?
print("=== STEP 1: Query Intelligence ===")
from query_intelligence import is_search_needed, split_query, classify_query
q = "What is the capital of France?"
print(f"  classify: {classify_query(q)}")
print(f"  needs search: {is_search_needed(q)}")
print(f"  split: {split_query(q)}")

# Step 2: Can we reach DuckDuckGo at all?
print("\n=== STEP 2: Raw DuckDuckGo request ===")
ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
try:
    resp = requests.get(
        "https://html.duckduckgo.com/html/",
        params={"q": "capital of France", "kl": "us-en"},
        headers={"User-Agent": ua},
        timeout=15,
    )
    print(f"  HTTP status: {resp.status_code}")
    print(f"  Response length: {len(resp.text)} chars")
    print(f"  Contains 'result__a': {'result__a' in resp.text}")
    print(f"  Contains 'anomaly': {'anomaly' in resp.text.lower()}")
    print(f"  First 300 chars: {resp.text[:300]}")
except Exception as e:
    print(f"  ERROR: {type(e).__name__}: {e}")

# Step 3: Does the DuckDuckGo provider work?
print("\n=== STEP 3: DuckDuckGo Provider ===")
from search_providers import DuckDuckGoProvider
try:
    provider = DuckDuckGoProvider()
    results = provider.search("capital of France", max_results=3)
    print(f"  Results: {len(results)}")
    for r in results:
        print(f"    [{r.rank}] {r.title}")
        print(f"        {r.url}")
        print(f"        snippet: {r.snippet[:80]}...")
except Exception as e:
    print(f"  ERROR: {type(e).__name__}: {e}")

# Step 4: Does the full pipeline work?
print("\n=== STEP 4: Full search_for_pages ===")
from pipeline import search_for_pages
try:
    pages = search_for_pages("What is the capital of France?", max_results=3)
    print(f"  Pages: {len(pages)}")
    for p in pages:
        print(f"    {p['title']} — {p['url']}")
except Exception as e:
    print(f"  ERROR: {type(e).__name__}: {e}")

print("\n=== DONE ===")