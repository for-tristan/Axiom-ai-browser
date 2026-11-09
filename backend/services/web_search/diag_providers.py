"""Diagnostic: test every search provider from YOUR machine.

Run this and paste me the full output so I can fix the right provider:

    cd backend/services/web_search
    python diag_providers.py
"""
import sys, os, requests, time
from bs4 import BeautifulSoup
from urllib.parse import urlparse, parse_qs
import base64

sys.path.insert(0, os.path.dirname(__file__))
from result import SearchResult

ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
h = {"User-Agent": ua, "Accept-Language": "en-US,en;q=0.9"}
q = "capital of France"

def show(label, results):
    print(f"\n  {label}: {len(results)} results")
    for r in results[:3]:
        print(f"    [{r.source}] {r.title[:50]} — {r.url[:60]}")

# ── 1. DDG Lite ──────────────────────────────────────────────────────────
print("=== 1. DDG Lite (POST) ===")
try:
    r = requests.post("https://lite.duckduckgo.com/lite/", data={"q": q, "kl": "us-en"},
                      headers={**h, "Content-Type": "application/x-www-form-urlencoded"}, timeout=15)
    print(f"  HTTP {r.status_code}, {len(r.text)} chars, has result-link: {'result-link' in r.text}")
    soup = BeautifulSoup(r.text, "html.parser")
    results = []
    for link in soup.select("a.result-link"):
        href = link.get("href", "")
        title = link.get_text(strip=True)
        if href and title:
            results.append(SearchResult(title=title, url=href, source="ddg-lite"))
    show("DDG Lite", results)
except Exception as e:
    print(f"  ERROR: {type(e).__name__}: {e}")

# ── 2. DDG HTML ──────────────────────────────────────────────────────────
print("\n=== 2. DDG HTML (GET) ===")
try:
    r = requests.get("https://html.duckduckgo.com/html/", params={"q": q, "kl": "us-en"}, headers=h, timeout=15)
    print(f"  HTTP {r.status_code}, {len(r.text)} chars, has result__a: {'result__a' in r.text}, anomaly: {'anomaly' in r.text.lower()}")
    soup = BeautifulSoup(r.text, "html.parser")
    results = []
    for block in soup.select("div.result"):
        link = block.select_one("a.result__a")
        if link:
            href = link.get("href", "")
            title = link.get_text(strip=True)
            # unwrap DDG redirect
            if "uddg=" in href:
                try:
                    parsed = urlparse("https:" + href if href.startswith("//") else href)
                    qs = parse_qs(parsed.query)
                    href = qs.get("uddg", [href])[0]
                except: pass
            if href and title:
                results.append(SearchResult(title=title, url=href, source="ddg-html"))
    show("DDG HTML", results)
except Exception as e:
    print(f"  ERROR: {type(e).__name__}: {e}")

# ── 3. Bing (with locale) ────────────────────────────────────────────────
print("\n=== 3. Bing (GET, en-US) ===")
try:
    r = requests.get("https://www.bing.com/search", params={"q": q, "count": "5", "setlang": "en-US", "cc": "US"}, headers=h, timeout=15)
    print(f"  HTTP {r.status_code}, {len(r.text)} chars, b_algo: {'b_algo' in r.text}")
    soup = BeautifulSoup(r.text, "html.parser")
    results = []
    for block in soup.select("li.b_algo"):
        h2 = block.select_one("h2")
        link = h2.find("a") if h2 else None
        if not link: continue
        title = h2.get_text(strip=True)
        href = link.get("href", "")
        # unwrap Bing redirect
        if "bing.com/ck/a" in href:
            try:
                parsed = urlparse(href)
                qs = parse_qs(parsed.query)
                u_val = qs.get("u", [""])[0]
                if u_val.startswith("a1"):
                    b64 = u_val[2:]
                    b64 += "=" * (4 - len(b64) % 4) if len(b64) % 4 else ""
                    href = base64.b64decode(b64).decode("utf-8")
            except: pass
        if href and title:
            results.append(SearchResult(title=title, url=href, source="bing"))
    show("Bing", results)
except Exception as e:
    print(f"  ERROR: {type(e).__name__}: {e}")

# ── 4. Google ────────────────────────────────────────────────────────────
print("\n=== 4. Google (GET) ===")
try:
    r = requests.get("https://www.google.com/search", params={"q": q, "num": "5", "hl": "en"}, headers=h, timeout=15)
    print(f"  HTTP {r.status_code}, {len(r.text)} chars, h3 count: {r.text.count('<h3')}")
    soup = BeautifulSoup(r.text, "html.parser")
    results = []
    for h3 in soup.select("h3"):
        link = h3.find_parent("a")
        if not link: continue
        href = link.get("href", "")
        if href.startswith("/url?q="):
            try:
                parsed = urlparse("https://google.com" + href)
                qs = parse_qs(parsed.query)
                href = qs.get("q", [href])[0]
            except: pass
        title = h3.get_text(strip=True)
        if href and title:
            results.append(SearchResult(title=title, url=href, source="google"))
    show("Google", results)
except Exception as e:
    print(f"  ERROR: {type(e).__name__}: {e}")

# ── 5. SearX (public instance) ───────────────────────────────────────────
print("\n=== 5. SearX (GET, searx.be) ===")
try:
    r = requests.get("https://searx.be/search", params={"q": q, "format": "json", "categories": "general"}, headers=h, timeout=15)
    print(f"  HTTP {r.status_code}, content-type: {r.headers.get('content-type','')}")
    if r.headers.get('content-type','').startswith('application/json'):
        data = r.json()
        results = [SearchResult(title=r.get('title',''), url=r.get('url',''), source="searx") for r in data.get('results',[])[:5]]
        show("SearX", results)
    else:
        print(f"  Not JSON. First 200 chars: {r.text[:200]}")
except Exception as e:
    print(f"  ERROR: {type(e).__name__}: {e}")

print("\n=== DONE — paste this output to me ===")
