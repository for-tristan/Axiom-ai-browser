from sentence_transformers import SentenceTransformer

class E5Embedding:
    def __init__(self, model_name: str = "intfloat/multilingual-e5-large"):
        self.model = SentenceTransformer(model_name)

    def get_embedding(self, text: str):
        vector = self.model.encode(text)
        return vector.tolist()