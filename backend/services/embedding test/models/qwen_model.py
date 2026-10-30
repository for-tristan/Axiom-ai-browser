from sentence_transformers import SentenceTransformer

class QwenEmbedding:
    def __init__(self, model_name: str = "Qwen/Qwen3-Embedding-0.6B"):
        self.model = SentenceTransformer(model_name)

    def get_embedding(self, text: str):
        vector = self.model.encode(text)
        return vector.tolist()