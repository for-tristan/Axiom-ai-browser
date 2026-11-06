# EmbedBench — Multi-Model Embedding Benchmarking Platform

A professional web application for **testing, analyzing, and comparing four embedding models** integrated into a FastAPI backend.

| Model | Type | Modality | Backend |
|---|---|---|---|
| **Gemini** (`gemini-embedding-2`) | Remote API | Text + Image | Google GenAI SDK |
| **NVIDIA Nemotron** (`nemotron-3.5-embed-8b`) | Remote API | Text | NVIDIA OpenAI-compat API |
| **E5** (`multilingual-e5-large`) | Local | Text | HuggingFace SentenceTransformers |
| **Qwen** (`Qwen3-Embedding-0.6B`) | Local | Text | HuggingFace SentenceTransformers |

---

## Project Structure

```
Task01 Prompet Engineering/
│
├── main.py                  ← FastAPI backend (enhanced, models untouched)
├── requirements.txt         ← All Python dependencies
├── .env.example             ← Template for API keys
├── .env                     ← Your actual keys (create from .env.example)
├── experiments.db           ← SQLite experiment history (auto-created)
│
├── run.bat                  ← Windows CMD launcher
├── run.ps1                  ← PowerShell launcher
│
├── models/                  ← Original model implementations (unchanged)
│   ├── __init__.py
│   ├── gemini_model.py      ← GeminiEmbedding
│   ├── e5_model.py          ← E5Embedding
│   ├── qwen_model.py        ← QwenEmbedding
│   └── nvidia_model.py      ← NvidiaEmbedding
│
└── frontend/
    └── index.html           ← Complete single-file frontend app
```

---

## Setup Instructions

### 1. Prerequisites

- Python 3.10 or newer
- pip
- A modern web browser (Chrome, Firefox, Edge)

### 2. Configure API Keys

Copy `.env.example` to `.env` and fill in your keys:

```bash
copy .env.example .env
```

Edit `.env`:

```
GEMINI_API_KEY=your_actual_gemini_key
NVIDIA_API_KEY=your_actual_nvidia_key
```

> **Note:** E5 and Qwen are local models — they require no API keys but will download model weights (~1–2 GB) from HuggingFace on first run.

### 3. Install Dependencies

With your virtual environment active:

```bash
pip install -r requirements.txt
```

Or use the provided launchers (they install automatically).

### 4. Run the Backend

**Option A — Double-click:**
```
run.bat
```

**Option B — PowerShell:**
```powershell
.\run.ps1
```

**Option C — Manual:**
```bash
# Activate venv first
venv\Scripts\activate

# Start the server
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

The backend will start at **http://localhost:8000**

### 5. Open the Frontend

Open `frontend/index.html` directly in your browser:

```
# From Windows Explorer: double-click frontend/index.html
# Or from CMD:
start frontend\index.html
```

> The frontend connects to `http://localhost:8000` by default. You can change the API Base URL in the **Settings** page of the app.

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Engine and database status |
| `GET` | `/models` | Capability manifest for all 4 models |
| `POST` | `/embed` | Single-model text embedding (original endpoint) |
| `POST` | `/embed/batch` | Multi-model text embedding in one call |
| `POST` | `/embed/image` | Image embedding (Gemini only) |
| `GET` | `/experiments` | List experiment history (paginated) |
| `GET` | `/experiments/{id}` | Get one experiment by ID |
| `DELETE` | `/experiments/{id}` | Delete one experiment |
| `DELETE` | `/experiments` | Clear all experiments |

Interactive API docs: **http://localhost:8000/docs**

---

## Frontend Features

### Testing Page
- **Text mode** — send any text to one or all 4 models
- **Image mode** — upload an image (JPEG/PNG/WebP/GIF, max 20 MB) for Gemini embedding
- Drag-and-drop image upload with preview
- Model selector with chips — select individual or all models
- Run / Stop / Clear controls with live progress indicator

### Result Cards
Each result shows:
- ✓/✗ Execution status
- Measured latency (backend-measured for batch, frontend-measured for single)
- Embedding dimensions
- Output vector length
- Input modality
- Expandable raw embedding viewer (first 100 values shown, full vector on expand)
- **Copy full vector** to clipboard
- **Download embedding** as JSON

### Comparison Page
- Side-by-side metrics table across all selected models
- ⚡ Fastest model highlighted automatically
- **Cosine Similarity matrix** computed client-side on raw vectors
- Export to **CSV** or **JSON**

### Experiments Page
- Full paginated history of all runs stored in SQLite
- View detailed results per experiment
- Delete individual records or clear all
- Auto-recorded on every batch / image run

### Model Info Page
- Live status of all 4 engines
- Model ID, type (Local/API), text/image support
- Error messages for unavailable models

### Settings Page
- Configurable **API Base URL** (stored in `localStorage`)
- Configurable **request timeout**
- Live **health check** button

### UX
- Light Mode / Dark Mode toggle (persisted across sessions)
- Responsive layout — works on desktop, tablet, and mobile
- Real-time backend connection indicator in the topbar

---

## Image Embedding — Important Notes

Only **Gemini** supports image embeddings in this project.

- E5 and Qwen are `SentenceTransformer` text-only models
- NVIDIA Nemotron's API accepts text in this implementation
- Gemini's `get_embedding()` accepts both text strings and `genai.types.Part` image objects

When you switch to **Image** mode in the frontend, E5/Qwen/NVIDIA chips are automatically disabled and a notice is displayed explaining why.

---

## Known Limitations

| Limitation | Detail |
|---|---|
| Gemini & NVIDIA require valid API keys | Both engines are `None` if keys are missing; a clear error is shown |
| E5 + Qwen download weights on first run | ~300 MB (Qwen) and ~1.1 GB (E5) from HuggingFace |
| Quality metrics (Precision@K, MRR, NDCG) | Not implemented — no labelled evaluation dataset is provided |
| Cosine similarity is geometric, not qualitative | Two models with high cosine similarity are not necessarily "better" |
| Image support is Gemini-only | No multi-model image comparison is available |
| No authentication on the API | Intended for local use only |

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `GEMINI_API_KEY` | For Gemini | *(hardcoded placeholder)* | Google GenAI API key |
| `NVIDIA_API_KEY` | For NVIDIA | *(hardcoded placeholder)* | NVIDIA NIM API key |
| `API_HOST` | No | `0.0.0.0` | Uvicorn bind host |
| `API_PORT` | No | `8000` | Uvicorn bind port |

---

## Modifying API Keys After Setup

Edit `.env` and restart the server. No frontend changes needed.

---

## Running in Production / GitHub Deployment

1. Set environment variables on the server instead of using `.env`
2. Change the **API Base URL** in the frontend Settings page to your deployed backend URL
3. Consider adding an authentication layer before exposing the API publicly
4. For CORS in production, replace `allow_origins=["*"]` with your exact frontend origin in `main.py`
