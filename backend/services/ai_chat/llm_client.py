import os
import time
from dotenv import load_dotenv
import openai
from openai import OpenAI

# بيقرا ملف .env ويحمّل NVIDIA_API_KEY، عشان الـ key ما يتكتبش جوه الكود
load_dotenv()

MODEL_NAME = "nvidia/nemotron-3-ultra-550b-a55b"

# إعدادات الموديل ثابتة هنا في مكان واحد بدل ما تبقى parameters،
# لأن كل الفريق هيستخدم نفس القيم ومفيش داعي حد يغيرها من برة.
TEMPERATURE = 0.6  # قيمة قليلة = إجابات ثابتة ودقيقة، مناسبة لإجابات مبنية على مصادر
TOP_P = 0.95
MAX_TOKENS = 1024  # أقصى طول للإجابة

# إعدادات الـ retry: لو السيرفر مشغول نعيد المحاولة بدل ما البرنامج يقع
MAX_RETRIES = 3
RETRY_DELAY_SECONDS = 2


class LLMServiceError(Exception):
    """Error بنعمله احنا، بيتطلع لما الموديل يفشل بعد كل المحاولات،
    عشان الـ UI يمسكه ويعرض رسالة واضحة للمستخدم."""


def _is_retryable(error):
    """بيحدد هل الـ error ده مؤقت وينفع نعيد معاه الطلب ولا لأ."""
    # مشاكل مؤقتة: ضغط على السيرفر، مشكلة في السيرفر، أو النت قطع
    if isinstance(
        error,
        (openai.RateLimitError, openai.InternalServerError, openai.APIConnectionError),
    ):
        return True
    # رسالة "Service temporarily overloaded" بتيجي كـ APIError عادي،
    # عشان كده بنقارن النوع بالظبط (الأنواع التانية زي الـ key الغلط مش هتتحل بالإعادة)
    return type(error) is openai.APIError


class LLMClient:
    def __init__(self):
        api_key = os.getenv("NVIDIA_API_KEY")
        # لو الـ key مش موجود نوقف بـ error واضح بدل error غامض بعدين
        if not api_key:
            raise ValueError("NVIDIA_API_KEY is missing. Check your .env file.")

        # NVIDIA متوافقة مع مكتبة openai، فبنغير الـ base_url بس
        self.client = OpenAI(
            base_url="https://integrate.api.nvidia.com/v1",
            api_key=api_key,
        )

    def chat(self, messages):
        """بيبعت الـ messages للموديل ويرجع نص الإجابة كاملة."""
        last_error = None

        # الـ retry loop: بنحاول لحد MAX_RETRIES مرات
        # attempt هو رقم المحاولة الحالية (1 ثم 2 ثم 3)
        for attempt in range(1, MAX_RETRIES + 1):
            try:
                completion = self.client.chat.completions.create(
                    model=MODEL_NAME,
                    messages=messages,
                    temperature=TEMPERATURE,
                    top_p=TOP_P,
                    max_tokens=MAX_TOKENS,
                    # قفلنا الـ thinking عشان الرد يبقى أسرع
                    extra_body={"chat_template_kwargs": {"enable_thinking": False}},
                )
                return completion.choices[0].message.content
            except openai.APIError as e:
                # لو المشكلة مش مؤقتة (زي key غلط) نوقف فوراً من غير إعادة
                if not _is_retryable(e):
                    raise LLMServiceError(f"Request failed: {e}") from e
                last_error = e
                # نستنى قبل المحاولة الجاية: 2 ثانية ثم 4، عشان منضغطش على السيرفر
                if attempt < MAX_RETRIES:
                    time.sleep(RETRY_DELAY_SECONDS * attempt)

        # لو وصلنا هنا يبقى كل المحاولات فشلت
        raise LLMServiceError(
            "The model service is busy. Please try again in a moment."
        ) from last_error