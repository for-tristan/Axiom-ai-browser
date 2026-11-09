from llm_client import LLMClient
from prompts import SYSTEM_PROMPT
from context_builder import build_context
from citations import extract_citations

# بنعمل الـ client مرة واحدة بس هنا، مش مع كل سؤال،
# عشان منعيدش قراءة الـ key وإنشاء الاتصال كل مرة
llm = LLMClient()


def _build_messages(question, pages):
    """بتجهز الرسائل اللي هتتبعت للموديل: التعليمات + المصادر + السؤال."""
    # بنحول الصفحات لنص مرقم [1], [2] عشان الموديل يقدر يذكر المصدر
    context = build_context(pages)
    return [
        # الـ system prompt: بيقول للموديل يجاوب من المصادر بس
        {"role": "system", "content": SYSTEM_PROMPT},
        # رسالة المستخدم: المصادر الأول وبعدها السؤال
        {"role": "user", "content": f"Sources:\n{context}\n\nQuestion: {question}"},
    ]


def generate_answer(question, pages):
    """
    بترجع الإجابة كاملة كنص واحد.
    question: سؤال المستخدم
    pages: list من dicts، كل واحد فيه 'title' و 'url' و 'content'
    """
    messages = _build_messages(question, pages)
    return llm.chat(messages)


def answer_with_citations(question, pages):
    """
    بترجع الإجابة ومعاها المصادر اللي الموديل ذكرها.
    دي الـ function الرئيسية اللي الفريق هيناديها.
    returns: dict فيه 'answer' (نص) و 'citations' (list من المصادر)
    """
    answer = generate_answer(question, pages)
    return {
        "answer": answer,
        # بنطلع أرقام [1] [2] من الإجابة ونربطها بالـ title والـ url الحقيقيين
        "citations": extract_citations(answer, pages),
    }