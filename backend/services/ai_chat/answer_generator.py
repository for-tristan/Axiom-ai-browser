from llm_client import LLMClient
from prompts import SYSTEM_PROMPT_SOURCES, SYSTEM_PROMPT_CHAT
from context_builder import build_context
from citations import extract_citations

# Create the LLM client once at module level.
llm = LLMClient()


def _build_messages(question, pages, system_prompt=None):
    """Build the messages list: system prompt + sources + user question."""
    if system_prompt is None:
        system_prompt = SYSTEM_PROMPT_SOURCES
    context = build_context(pages) if pages else ""
    user_content = f"Sources:\n{context}\n\nQuestion: {question}" if context else question
    return [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_content},
    ]


def generate_answer(question, pages, system_prompt=None):
    """Generate the full answer text from the LLM."""
    messages = _build_messages(question, pages, system_prompt)
    result = llm.chat(messages)
    if result is None:
        return "I couldn't generate an answer at this time. Please try again."
    return result


def answer_with_citations(question, pages, system_prompt=None):
    """Generate an answer with extracted citations."""
    answer = generate_answer(question, pages, system_prompt)
    if not answer:
        answer = "I couldn't generate an answer at this time. Please try again."
    return {
        "answer": answer,
        "citations": extract_citations(answer, pages) if pages else [],
    }


def answer_chat(question):
    """AI Chat mode — direct LLM answer, no sources, no citations.

    Like ChatGPT: the LLM uses its own knowledge to answer.
    """
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT_CHAT},
        {"role": "user", "content": question},
    ]
    result = llm.chat(messages)
    if result is None:
        return "I couldn't generate an answer at this time. Please try again."
    return result
