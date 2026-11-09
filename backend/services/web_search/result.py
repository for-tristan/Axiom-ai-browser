"""Search result data model.

A SearchResult is what a search provider returns: a title, a url, and a
short snippet (the few lines the search engine shows under the link).

The AI chat (Task 1) expects "pages" — dicts with 'title', 'url', and
'content'. to_page() converts a SearchResult into that shape. When full
page extraction (Task 3) is available, 'content' should come from there;
until then we fall back to the snippet so the pipeline works end to end.
"""

from dataclasses import dataclass, field


@dataclass
class SearchResult:
    """One hit from a web search."""

    title: str
    url: str
    snippet: str = ""
    # Which provider produced this result (e.g. "duckduckgo", "brave").
    source: str = ""
    # Order in which the provider returned it (1-based). Useful for ranking.
    rank: int = 0

    def to_page(self, content: str | None = None) -> dict:
        """Convert to the page dict that Task 1 (answer_generator) expects.

        Args:
            content: Full page text if Task 3 already extracted it.
                     If None, the search snippet is used as a fallback so
                     the answer generator always has something to cite.
        """
        return {
            "title": self.title,
            "url": self.url,
            "content": content if content is not None else self.snippet,
        }
