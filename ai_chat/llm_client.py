import os
import time
from dotenv import load_dotenv
import openai
from openai import OpenAI

load_dotenv()

MODEL_NAME = "nvidia/nemotron-3-ultra-550b-a55b"
MAX_RETRIES = 3
RETRY_DELAY_SECONDS = 2


class LLMServiceError(Exception):
    """Raised when the model service fails after all retries."""


def _is_retryable(error):
    """Temporary problems are worth retrying. Wrong key or bad request are not."""
    if isinstance(
        error,
        (openai.RateLimitError, openai.InternalServerError, openai.APIConnectionError),
    ):
        return True
    return type(error) is openai.APIError


class LLMClient:
    def __init__(self):
        api_key = os.getenv("NVIDIA_API_KEY")
        if not api_key:
            raise ValueError("NVIDIA_API_KEY is missing. Check your .env file.")

        self.client = OpenAI(
            base_url="https://integrate.api.nvidia.com/v1",
            api_key=api_key,
        )

    def chat(self, messages, temperature=0.6, max_tokens=1024):
        last_error = None
        for attempt in range(1, MAX_RETRIES + 1):
            try:
                completion = self.client.chat.completions.create(
                    model=MODEL_NAME,
                    messages=messages,
                    temperature=temperature,
                    top_p=0.95,
                    max_tokens=max_tokens,
                    extra_body={"chat_template_kwargs": {"enable_thinking": False}},
                )
                return completion.choices[0].message.content
            except openai.APIError as e:
                if not _is_retryable(e):
                    raise LLMServiceError(f"Request failed: {e}") from e
                last_error = e
                if attempt < MAX_RETRIES:
                    time.sleep(RETRY_DELAY_SECONDS * attempt)

        raise LLMServiceError(
            "The model service is busy. Please try again in a moment."
        ) from last_error

    def chat_stream(self, messages, temperature=0.6, max_tokens=1024):
        last_error = None
        for attempt in range(1, MAX_RETRIES + 1):
            started = False
            try:
                stream = self.client.chat.completions.create(
                    model=MODEL_NAME,
                    messages=messages,
                    temperature=temperature,
                    top_p=0.95,
                    max_tokens=max_tokens,
                    extra_body={"chat_template_kwargs": {"enable_thinking": False}},
                    stream=True,
                )
                for chunk in stream:
                    if not chunk.choices:
                        continue
                    text = chunk.choices[0].delta.content
                    if text:
                        started = True
                        yield text
                return
            except openai.APIError as e:
                # If text was already sent to the user, retrying would repeat it
                if started or not _is_retryable(e):
                    raise LLMServiceError(f"Request failed: {e}")