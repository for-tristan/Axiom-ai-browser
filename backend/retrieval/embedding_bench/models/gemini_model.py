from google import genai
from google.genai import types

class GeminiEmbedding:
    def __init__(self, api_key: str):
        self.client = genai.Client(api_key=api_key)
        self.model_name = "gemini-embedding-2"

    def get_embedding(self, text_or_image_content):
        response = self.client.models.embed_content(
            model=self.model_name,
            contents=text_or_image_content,
        )
        return response.embeddings[0].values