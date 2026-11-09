"""Live test: real search → real extraction → real LLM answer.

Run from ANYWHERE:
    python backend/services/ai_chat/test_live.py

Or from inside the ai_chat folder:
    python test_live.py
"""
import sys, os

# Build absolute paths to the three task folders, relative to THIS file.
# This avoids the "cannot import name 'search_for_answer' from 'pipeline'"
# error that happens when a different 'pipeline' package in site-packages
# shadows the Axiom one.
_HERE = os.path.dirname(os.path.abspath(__file__))
_SERVICES = os.path.join(_HERE, "..")

for _folder in ("web_search", "ai_chat", "web_extraction"):
    _path = os.path.normpath(os.path.join(_SERVICES, _folder))
    if _path not in sys.path:
        sys.path.insert(0, _path)

# Load the .env that contains NVIDIA_API_KEY
from dotenv import load_dotenv
load_dotenv(os.path.join(_HERE, ".env"))

# Now import — the Axiom pipeline will be found first because we put
# web_search/ at the front of sys.path.
from pipeline import search_for_answer

question = "What is the capital of egypt?"
print(f"Question: {question}")
print("Searching Wikipedia + extracting pages + generating answer...")
print()

result = search_for_answer(question, max_results=3)

print("=" * 60)
print("ANSWER:")
print(result["answer"])
print()
print("CITATIONS:")
for c in result["citations"]:
    print(f"  [{c['number']}] {c['title']}")
    print(f"      {c['url']}")
print()
print(f"Sources used: {len(result['sources'])}")
for s in result["sources"]:
    print(f"  - {s['title']} ({s['url']})")
    print(f"    content preview: {s['content'][:100]}...")
