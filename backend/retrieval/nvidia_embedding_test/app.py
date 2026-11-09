
import os
import requests
from flask import Flask, request, render_template_string
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

MODEL = "nvidia/nemotron-3.5-embed-1b"
API_URL = "https://integrate.api.nvidia.com/v1/embeddings"

HTML = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Browser - Embedding Test</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            background: #f3f4f6;
            margin: 0;
            padding: 40px 16px;
            color: #1f2937;
        }
        .container {
            max-width: 750px;
            margin: auto;
            background: white;
            padding: 30px;
            border-radius: 14px;
            box-shadow: 0 4px 18px #00000012;
        }
        h1 { margin-top: 0; }
        label {
            display: block;
            margin: 18px 0 8px;
            font-weight: bold;
        }
        textarea, select {
            box-sizing: border-box;
            width: 100%;
            padding: 12px;
            border: 1px solid #d1d5db;
            border-radius: 8px;
            font-size: 15px;
        }
        textarea {
            min-height: 130px;
            resize: vertical;
        }
        button {
            margin-top: 18px;
            padding: 12px 20px;
            border: 0;
            border-radius: 8px;
            background: #2563eb;
            color: white;
            font-size: 16px;
            cursor: pointer;
        }
        button:hover { background: #1d4ed8; }
        .result {
            margin-top: 24px;
            padding: 16px;
            border-radius: 8px;
            overflow-wrap: anywhere;
        }
        .success {
            background: #ecfdf5;
            border: 1px solid #10b981;
        }
        .error {
            background: #fef2f2;
            border: 1px solid #ef4444;
        }
        code { overflow-wrap: anywhere; }
    </style>
</head>
<body>
    <div class="container">
        <h1>AI Browser</h1>
        <h2>Embedding Model Test</h2>

        <p>Model: <code>{{ model }}</code></p>

        <form method="POST">
            <label for="text">Text to embed</label>
            <textarea id="text" name="text" required>{{ text }}</textarea>

            <label for="input_type">Input type</label>
            <select id="input_type" name="input_type">
                <option value="passage"
                    {% if input_type == "passage" %}selected{% endif %}>
                    Passage
                </option>
                <option value="query"
                    {% if input_type == "query" %}selected{% endif %}>
                    Query
                </option>
            </select>

            <button type="submit">Generate Embedding</button>
        </form>

        {% if vector_length is not none %}
        <div class="result success">
            <h3>Embedding generated successfully!</h3>
            <p><strong>Vector length:</strong> {{ vector_length }}</p>
            <p><strong>First 5 values:</strong></p>
            <code>{{ first_values }}</code>
        </div>
        {% endif %}

        {% if error %}
        <div class="result error">
            <h3>Test failed</h3>
            <p>{{ error }}</p>
        </div>
        {% endif %}
    </div>
</body>
</html>
"""


@app.route("/", methods=["GET", "POST"])
def home():
    text = "AI enables robots to perceive, plan, and act autonomously."
    input_type = "passage"
    vector_length = None
    first_values = None
    error = None

    if request.method == "POST":
        text = request.form.get("text", "").strip()
        input_type = request.form.get("input_type", "passage")

        if not text:
            error = "Please enter some text."

        elif input_type not in ("passage", "query"):
            error = "Invalid input type."

        else:
            api_key = os.getenv("NVIDIA_API_KEY")

            if not api_key:
                error = (
                    "NVIDIA_API_KEY is missing. "
                    "Check that your .env file exists."
                )

            else:
                headers = {
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                }

                # Use the same request format that succeeded
                # in the direct NVIDIA API test.
                payload = {
                    "model": "nvidia/nemotron-3.5-embed-1b",
                    "input": [text],
                    "input_type": input_type,
                    "modality": "text",
                    "encoding_format": "float",
                    "truncate": "END",
                }

                try:
                    print("\n--- NVIDIA API request ---")
                    print("URL:", API_URL)
                    print("Model:", payload["model"])
                    print("Input type:", input_type)

                    response = requests.post(
                        API_URL,
                        headers=headers,
                        json=payload,
                        timeout=60,
                    )

                    print("HTTP status:", response.status_code)
                    print("Response body:", response.text[:1000])

                    if response.ok:
                        result = response.json()
                        embedding = result["data"][0]["embedding"]

                        vector_length = len(embedding)
                        first_values = embedding[:5]

                    else:
                        error = (
                            f"NVIDIA API returned HTTP "
                            f"{response.status_code}: "
                            f"{response.text[:1000]}"
                        )

                except (requests.RequestException, ValueError, KeyError) as e:
                    print("Request error:", type(e).__name__, str(e))
                    error = (
                        "The request could not be completed. "
                        "Check the VS Code Terminal for details."
                    )

    return render_template_string(
        HTML,
        model=MODEL,
        text=text,
        input_type=input_type,
        vector_length=vector_length,
        first_values=first_values,
        error=error,
    )


if __name__ == "__main__":
    app.run(
        debug=False,
        host="127.0.0.1",
        port=5000,
    )
