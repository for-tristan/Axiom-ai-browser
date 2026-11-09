import base64
import requests
from openai import OpenAI

class NvidiaEmbedding:
    def __init__(self, api_key: str):
        self.client = OpenAI(
            base_url="https://integrate.api.nvidia.com/v1",
            api_key=api_key
        )
        self.model_name = "nvidia/nemotron-3.5-embed-8b"

    def get_embedding(self, text: str):
        response = self.client.embeddings.create(
            input=[text],
            model=self.model_name,
            encoding_format="float",
            extra_body={"modality": ["text_image"], "input_type": "passage", "truncate": "END"}
        )
        return response.data[0].embedding