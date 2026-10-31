MAX_CHARS_PER_PAGE = 4000


def build_context(pages):
    """
    pages: list of dicts, each with 'title', 'url', 'content'
    returns: a single string with numbered sources [1], [2], ...
    """
    parts = []
    for i, page in enumerate(pages, start=1):
        content = page["content"].strip()[:MAX_CHARS_PER_PAGE]
        parts.append(
            f"[{i}] Title: {page['title']}\n"
            f"URL: {page['url']}\n"
            f"Content: {content}"
        )
    return "\n\n".join(parts)