import re


def extract_citations(answer, pages):
    """
    بتطلع المصادر اللي الموديل ذكرها في الإجابة، وتربط كل رقم بالصفحة الحقيقية.
    answer: إجابة الموديل، فيها أرقام زي [1] و [2]
    pages: نفس الـ list اللي اتبعتت للموديل (الترتيب لازم يبقى هو هو)
    returns: list من dicts، كل واحد فيه 'number' و 'title' و 'url'
    """
    # re.findall بتدور على أي رقم جوه أقواس مربعة زي [1] وتطلع الرقم بس
    # الـ set {} بتشيل التكرار (لو [1] اتكتب 3 مرات يتحسب مرة)
    # sorted بترتبهم
    numbers = sorted({int(n) for n in re.findall(r"\[(\d+)\]", answer)})

    citations = []
    for n in numbers:
        # حماية: لو الموديل كتب رقم مش موجود (زي [9] وعندنا صفحتين بس) نتجاهله
        if 1 <= n <= len(pages):
            # pages[n - 1] لأن الصفحة رقم 1 مكانها 0 في الـ list
            page = pages[n - 1]
            citations.append({
                "number": n,
                "title": page["title"],
                "url": page["url"],
            })
    return citations