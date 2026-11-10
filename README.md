# Axiom AI Browser

24-week timeline (approximately six months) and a baseline stack of Electron, React, TypeScript, FastAPI, PostgreSQL, Redis, ChromaDB, BGE-M3, and LLMs such as Gemini.


### Desktop Browser and Electron

**Responsibilities**
- Build the desktop application, browser window, tab strip, address bar, navigation controls, and downloads.
- Manage tab lifecycle and browsing sessions.
- Capture permitted page metadata and expose page content to the AI layer safely.

**Must know before starting**
- JavaScript/TypeScript and Node.js.
- Electron architecture: main process, renderer process, preload scripts, IPC.
- Chromium, browser navigation, web security, and content isolation.
- Electron `WebContentsView` or another appropriate supported browser-view approach.

**Deliverable:** A working desktop browser with multiple tabs, persistent bookmarks, and history.

### Frontend and User Experience

**Responsibilities**
- Build the browser interface and side panels.
- Create AI chat, notes, bookmarks, workspace screens, semantic history, and report views.
- Integrate the frontend with backend APIs and manage loading, errors, and streaming responses.

**Must know before starting**
- React, TypeScript, hooks, and component architecture.
- Tailwind CSS and desktop UI design.

**Deliverable:** A consistent interface for browsing, chatting, organizing research, and viewing reports.

### Backend and Database

**Responsibilities**
- Develop the FastAPI backend and API contracts.
- Design users, workspaces, documents, notes, bookmarks, browsing history, conversations, reports, and access permissions.
- Handle data persistence, migrations, caching, and service integration.

**Must know before starting**
- Python, FastAPI, Pydantic, and REST API design.
- SQL, database relationships, and migrations.
- Redis for caching .
- Authentication, authorization, validation, and database transactions.

**Deliverable:** Reliable backend APIs and a database that the other engineers can use.

### AI and LLM Integration

**Responsibilities**
- Implement webpage chat, summaries, explanations, translation, and AI note generation.
- Integrate hosted LLMs and optionally local models through Ollama.
- Design prompts, structured outputs, model selection, token limits, and source-grounded responses.

**Must know before starting**
- Python and LLM API integration.
- Prompt engineering, context windows, token usage, and structured outputs.
- Streaming responses, error handling, retries, and rate limits.
- Hallucination evaluation, citation grounding, and prompt-injection risks.

**Deliverable:** An AI assistant that answers questions using actual webpage or document content.

### RAG, Semantic Search, and Knowledge

**Responsibilities**
- Extract and clean webpage text and PDF content.
- Split text into passages, generate embeddings, and store vectors.
- Implement semantic history, smart bookmarks, hybrid retrieval, and retrieval-augmented generation (RAG).
- Connect notes and sources to workspaces and research reports.

**Must know before starting**
- NLP, embeddings, vector similarity, and information retrieval.
- BGE-M3, ChromaDB, and indexing.
- Keyword search such as BM25 and hybrid retrieval.
- RAG evaluation, ranking.
- PDF extraction with PyMuPDF.

**Deliverable:** Search and AI answers that find relevant information across previously visited pages and documents.

### QA, Integration, and Security

**Responsibilities**
- Build end-to-end test plans and validate integration across all modules.
- Test browser stability, retrieval quality, citation correctness, performance, and privacy.
- Check Electron security, unsafe page content, prompt injection, and accidental data exposure.
- Maintain release builds, bug reports, and regression tests.

**Must know before starting**
- Unit, API, integration, and end-to-end testing.
- Playwright, Pytest, and CI/CD basics.
- Electron security and threat modeling.
- Logging, debugging, performance measurement, and test automation.

**Deliverable:** A stable, installable application that passes agreed acceptance tests.

**Integration rule:** The browser engineer must agree with the AI engineer on page extraction; the frontend engineer must agree with the backend engineer on API schemas; and the RAG engineer must agree with both on source identifiers and storage formats before implementation begins.

## 2. Recommended technology stack

The first column reflects the proposal's baseline. Other tools are implementation recommendations to help the components work together.

| Component | Recommended technology | Purpose |
|---|---|---|
| Desktop browser | Electron + Chromium + TypeScript | Browser shell, tabs, navigation, downloads, IPC |
| Frontend | React + TypeScript + Tailwind CSS | Browser UI, side panels, chat, notes, workspaces, reports |
| Backend | Python + FastAPI | APIs, AI orchestration, validation, service integration |
| Structured data | PostgreSQL | Workspaces, notes, conversations, bookmarks, history |
| Cache and task coordination | Redis | Optional caching and background-job coordination |
| Vector database | ChromaDB | Store and search embeddings |
| Embeddings | BGE-M3 | Semantic representation of passages and queries |
| Language models | Start with one provider: Gemini API or a suitable Qwen/DeepSeek option | Chat, summarization, explanation, report synthesis |
| Local inference | Ollama, if needed | Run supported local models |
| PDF processing | PyMuPDF | Extract PDF text and page metadata |
| Frontend state | Zustand or React Context | Manage UI state |
| API documentation | FastAPI OpenAPI / Swagger UI | Explore and test endpoints |
| Packaging | Electron Forge or Electron Builder | Create desktop installers |

### Architecture

Keep the browser UI and AI/backend services separate:
- **Electron** handles browsing and desktop capabilities.
- **React** renders the interface.
- **FastAPI** manages AI and research services.
- **PostgreSQL** stores structured records.
- **ChromaDB** indexes searchable content.
- **LLM provider** generates responses from supplied context.

Do not give arbitrary webpages direct access to privileged Electron APIs. Use isolated browser content, a narrowly scoped preload bridge, validated IPC, and explicit permissions. Decide early which content stays local and which is sent to an external AI provider.

## 3. Tools and apps to install

### Needed by everyone

- **Visual Studio Code** — editor, extensions, debugging, and terminal: https://code.visualstudio.com/
- **Git and GitHub** — version control, pull requests, issues, and code review: https://git-scm.com/ and https://github.com/
- **Docker Desktop** — reproducible environments for PostgreSQL, Redis, ChromaDB, and backend services where appropriate: https://www.docker.com/products/docker-desktop/
- **Postman or FastAPI Swagger UI** — test endpoints and request/response behavior: https://www.postman.com/
- **Figma** — design screens and agree on UI behavior before implementation: https://www.figma.com/
- **Discord or Slack** — team communication.
- **GitHub Projects, Trello, or Jira** — tasks, owners, milestones, and blockers.

### Role-specific tools

| Engineer | Additional tools |
|---|---|
| Browser | Node.js LTS, npm, Electron tooling, Chromium DevTools |
| Frontend | React Developer Tools, browser DevTools, Figma |
| Backend | Python, `venv` or `uv`, PostgreSQL, DBeaver or another database GUI |
| AI/LLM | Provider API account, API keys in environment variables, Ollama if using local models |
| RAG/search | ChromaDB, embedding model runtime, PyMuPDF, retrieval evaluation datasets |
| QA/security | Playwright, Pytest, Vitest, GitHub Actions, dependency and vulnerability scanning |

Do not install every AI model locally. Hosted model APIs are simpler for an initial prototype. Local inference depends on model size, available RAM, and hardware acceleration.

## 4. Project milestones — 24 weeks

The proposal's plan is seven phases over 24 weeks. The deliverables and acceptance criteria below turn that plan into engineering work.

| Weeks | Milestone | Main owners | Deliverables and acceptance criteria |
|---|---|---|---|
| 1–3 | Requirements and architecture | All engineers | Define MVP, draw architecture and data-flow diagrams, design database and API contracts, create repository and conventions, draft UI wireframes and test criteria. **Accept when:** every engineer knows their module, dependencies, interfaces, and first deliverable. |
| 4–7 | Browser foundation | Engineers 1, 2, 3 | Electron shell, tabs, navigation, URL/search address bar, persistent bookmarks/history, FastAPI and PostgreSQL integration, safe page-text extraction. **Accept when:** a user can browse, open multiple tabs, restart the app, and retrieve saved history. |
| 8–12 | AI integration | Engineers 2, 3, 4 | Integrate one LLM provider; implement webpage chat, summaries, explanations, translation, AI notes, streaming, and error states. **Accept when:** a user can ask a question about a page and get an answer grounded in its readable content. |
| 13–16 | RAG and semantic retrieval | Engineers 3, 4, 5 | Extract, clean, and chunk web/PDF text; generate BGE-M3 embeddings; index in ChromaDB; implement semantic history, smart bookmark retrieval, PDF chat, and source references. **Accept when:** users can find information by meaning and inspect the retrieved source. |
| 17–19 | Workspaces and reports | Engineers 2, 3, 4, 5 | Project workspaces, pages/notes/bookmarks/documents organization, cross-source comparison, citation-grounded reports, report export. **Accept when:** a user can research across multiple sources and generate a report with verifiable references. |
| 20–22 | Testing and security | Engineer 6 + all module owners | Integration, persistence, crash/recovery, retrieval quality, answer faithfulness, malicious webpage instruction, data-leak, latency, memory-use, and stability tests. **Accept when:** critical bugs are fixed and security/performance results are documented. |
| 23–24 | Release and documentation | All engineers | Desktop installer, setup guide, API docs, architecture and database docs, test results, limitations, and graduation demo. **Accept when:** another developer can install, run, test, and understand the MVP from the documentation. |

**Schedule note:** This is the proposal's schedule, not a guarantee. Start frontend wireframes, backend contracts, and AI experiments in parallel early on, but keep browser foundations and API agreements as explicit dependencies.

## 5.  must know before coding

Use the first two weeks to agree on these shared decisions.

| Decision | What to agree on |
|---|---|
| MVP scope | Which features are essential for the final demo? |
| Browser architecture | How are tabs, page views, and navigation managed in Electron? |
| Page extraction | What content is captured, when, and under what permissions? |
| Data ownership | Which service owns bookmarks, history, notes, and workspaces? |
| API contracts | Which endpoints, payloads, and error formats do modules use? |
| Source identifiers | How does an answer link back to a page, PDF, or passage? |
| AI provider | Which model does the MVP use, and how are provider calls configured? |
| Privacy | What is stored locally, and what data is sent to external services? |
| Git workflow | How are branches, reviews, commits, and releases managed? |
| Definition of done | What tests and documentation are required before a feature is complete? |

### Shared content model

Every captured passage should retain enough metadata to identify its source, such as:
- URL or document ID.
- Page title.
- Capture time.
- Passage ID or PDF page reference.
- Workspace association where applicable.

Without shared source metadata, citations, semantic history, and cross-source reports will be difficult to implement consistently.

## 6. Recommended MVP scope

### Build first — core MVP

- [x] Chromium-based browsing, tabs, and navigation.
- [ ] Persistent bookmarks and browsing history.
- [x] AI chat and webpage summaries.
- [ ] PDF text extraction and PDF chat.
- [ ] AI notes with source links.
- [ ] Semantic history and search.
- [ ] Research workspaces.
- [ ] Citation-grounded research report export.

### Add later if time permits

- Multiple interchangeable LLM providers.
- Fully autonomous web agents.
- Advanced knowledge graphs.
- Sophisticated cross-session personal memory.
- Cloud synchronization and collaboration.
- Advanced visualization and automated research planning.

Persistent research memory is part of the project vision, but a safe memory system needs privacy and security controls. Start with explicitly saved research context and add automatic memory only after the core pipeline works.

## 7. Suggested repository structure

A monorepo is a practical choice for a student team because it keeps API contracts, shared types, and integration changes together.

```text
axiom/
├── apps/
│   ├── desktop/          # Electron main/preload
│   └── frontend/         # React + TypeScript
├── backend/
│   ├── api/              # FastAPI endpoints
│   ├── services/         # AI and business logic
│   ├── retrieval/        # RAG, embeddings, search
│   └── tests/
├── shared/
│   └── contracts/        # Shared API schemas/types
├── database/
│   ├── migrations/
│   └── schema/
├── docs/
├── docker-compose.yml
└── README.md
```

This is a proposed structure, not a requirement from the project documents. Adjust it to the team's experience and chosen package manager.

### Task board workflow

Use GitHub Projects or another task tracker with these columns:

**Backlog → Ready → In Progress → Review → Testing → Done**

Each task should have one owner, a testable acceptance criterion, and agreed dependencies.


## 8. Evaluation

Measure actual results rather than relying only on successful demos.

| Area | Suggested metric |
|---|---|
| Browser | Page-load time, tab-switch latency, memory use |
| Semantic search | Recall@k, MRR, NDCG, query latency |
| AI chat and notes | Faithfulness and citation precision |
| PDF chat | Correct answers linked to the right pages |
| Research reports | Source accuracy and task completion |
| Security | Prompt-injection resistance and data-leak tests |
| Overall UX | Time to complete representative research tasks |

Choose representative test questions and source documents before tuning retrieval. Compare keyword-only, semantic-only, and hybrid search on the same dataset, and record the results.

