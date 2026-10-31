import re


def extract_citations(answer, pages):
    """
    answer: the model's answer (string) containing citations like [1], [2]
    pages: the same list of pages that was sent to the model
    returns: list of dicts with 'number', 'title', 'url' for each cited source
    """
    numbers = sorted({int(n) for n in re.findall(r"\[(\d+)\]", answer)})

    citations = []
    for n in numbers:
        if 1 <= n <= len(pages):
            page = pages[n - 1]
            citations.append({
                "number": n,
                "title": page["title"],
                "url": page["url"],
            })
    return citations