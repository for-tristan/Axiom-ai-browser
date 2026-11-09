"""Live test: real search → real extraction → real LLM answer."""
import sys, os

# Add the three task folders to the path
sys.path.insert(0, "backend/services/web_search")
sys.path.insert(0, "backend/services/ai_chat")
sys.path.insert(0, "backend/services/web_extraction")

# This import triggers LLMClient() which needs the API key
from pipeline import search_for_answer

question = "What is the capital of France?"
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