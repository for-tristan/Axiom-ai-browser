# أقصى عدد حروف ناخده من كل صفحة، لأن الصفحات ممكن تبقى طويلة جداً
# وتزود حجم الطلب للموديل من غير فايدة
MAX_CHARS_PER_PAGE = 4000


def build_context(pages):
    """
    بتحول الصفحات لنص واحد مرقم [1], [2], ... عشان الموديل يفهمه.
    pages: list من dicts، كل واحد فيه 'title' و 'url' و 'content'
    returns: نص واحد فيه كل المصادر
    """
    parts = []
    # start=1 عشان الترقيم يبدأ من 1 مش من 0، ويطابق [1] في الـ System Prompt
    for i, page in enumerate(pages, start=1):
        # strip() بتشيل المسافات الزيادة، والـ [:MAX] بتقص الصفحة الطويلة
        content = page["content"].strip()[:MAX_CHARS_PER_PAGE]
        # بنحط الـ title والـ url مع المحتوى عشان نعرضهم في الـ citations بعدين
        parts.append(
            f"[{i}] Title: {page['title']}\n"
            f"URL: {page['url']}\n"
            f"Content: {content}"
        )
    # سطر فاضي بين كل مصدر والتاني عشان الموديل يفرق بينهم
    return "\n\n".join(parts)