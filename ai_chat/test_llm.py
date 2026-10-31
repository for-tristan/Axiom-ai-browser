from answer_generator import answer_with_citations

pages = [
    {
        "title": "Egypt - Wikipedia",
        "url": "https://en.wikipedia.org/wiki/Egypt",
        "content": "Cairo is the capital of Egypt. It has a population of about 10 million people.",
    },
    {
        "title": "Nile River",
        "url": "https://en.wikipedia.org/wiki/Nile",
        "content": "The Nile is the longest river in Africa and flows through Egypt.",
    },
]

question = "ما هي عاصمة مصر وما أطول نهر في أفريقيا؟"

result = answer_with_citations(question, pages)

print("Answer:")
print(result["answer"])
print()
print("Sources:")
for c in result["citations"]:
    print(f"[{c['number']}] {c['title']} - {c['url']}")