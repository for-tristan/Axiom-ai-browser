from llm_client import LLMClient
from prompts import SYSTEM_PROMPT
from context_builder import build_context
from citations import extract_citations

llm = LLMClient()


def _build_messages(question, pages):
    context = build_context(pages)
    return [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": f"Sources:\n{context}\n\nQuestion: {question}"},
    ]


def generate_answer(question, pages):
    """Returns the full answer as one string."""
    messages = _build_messages(question, pages)
    return llm.chat(messages)


def generate_answer_stream(question, pages):
    """Yields the answer piece by piece as the model writes it."""
    messages = _build_messages(question, pages)
    yield from llm.chat_stream(messages)


def answer_with_citations(question, pages):
    """Returns the answer together with the sources it cited."""
    answer = generate_answer(question, pages)
    return {
        "answer": answer,
        "citations": extract_citations(answer, pages),
    }