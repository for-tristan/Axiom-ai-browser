from llm_client import LLMClient
from prompts import SYSTEM_PROMPT
from context_builder import build_context
from citations import extract_citations

# Create the LLM client once at module level.
llm = LLMClient()


def _build_messages(question, pages):
    """Build the messages list: system prompt + sources + user question."""
    context = build_context(pages)
    return [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": f"Sources:\n{context}\n\nQuestion: {question}"},
    ]


def generate_answer(question, pages):
    """Generate the full answer text from the LLM."""
    messages = _build_messages(question, pages)
    result = llm.chat(messages)
    # Safety: llm.chat might return None if the API call fails
    if result is None:
        return "I couldn't generate an answer at this time. Please try again."
    return result


def answer_with_citations(question, pages):
    """Generate an answer with extracted citations.

    Returns: dict with 'answer' (str) and 'citations' (list of dicts).
    """
    answer = generate_answer(question, pages)
    if not answer:
        answer = "I couldn't generate an answer at this time. Please try again."
    return {
        "answer": answer,
        "citations": extract_citations(answer, pages),
    }
