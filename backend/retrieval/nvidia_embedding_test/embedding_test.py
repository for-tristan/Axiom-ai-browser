
import os
from openai import OpenAI, APIStatusError

api_key = os.getenv("NVIDIA_API_KEY")

if not api_key:
    print("NVIDIA_API_KEY is missing.")
else:
    client = OpenAI(
        api_key=api_key,
        base_url="https://integrate.api.nvidia.com/v1"
    )

    try:
        response = client.embeddings.create(
            input=["AI enables robots to perceive, plan, and act autonomously."],
            model="nvidia/nemotron-3.5-embed-1b",
            encoding_format="float",
            extra_body={
                "input_type": "passage",
                "modality": ["text"],
                "truncate": "END"
            }
        )

        embedding = response.data[0].embedding
        print("Embedding generated successfully!")
        print("Vector length:", len(embedding))
        print("First 5 values:", embedding[:5])

    except APIStatusError as e:
       print("Status code:", e.status_code)
       print("API error details:", e.response.text)
