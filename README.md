# Codebase Explorer — MVP

Upload a `.zip` of any source-code repository and get an instant architectural overview, including:

- File tree
- Languages
- Frameworks
- Dependencies
- API endpoints
- Classes and functions
- Import graph
- Monaco-powered code viewer

![Stack](https://img.shields.io/badge/Backend-FastAPI-009688)
![Frontend](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-61DAFB)
![Python](https://img.shields.io/badge/Python-3.12-3776AB)

---

## Architecture

```text
┌─────────────────┐      POST /api/analyze (zip)      ┌──────────────────┐
│  React (Vite)   │  ───────────────────────────────> │  FastAPI + AST   │
│  Tailwind       │  <─────────────────────────────── │  analyzers/      │
│  React Flow     │      JSON analysis                │  services/       │
│  Monaco Editor  │  ───────────────────────────────> │  /api/repository │
└─────────────────┘      GET /file?path=...           └──────────────────┘
         ▲                                                    ▲
         │ docker-compose.yml                                 │
         └────────────── Docker Compose ──────────────────────┘
```

### Backend (`backend/app/`)

- `api/routes.py` — `POST /api/analyze`, `GET /api/repository/{id}/analysis`, `GET /api/repository/{id}/file`
- `services/analyzer_service.py` — ZIP extraction (traversal-safe), file discovery, tree building, graph construction, in-memory store
- `analyzers/python_analyzer.py` — `ast` parsing for imports/classes/functions and decorator-based FastAPI/Flask route detection
- `analyzers/js_analyzer.py` — Regex-based import and Express route detection for JS/TS
- `analyzers/deps_analyzer.py` — `requirements.txt`, `pyproject.toml`, and `package.json` parsing
- `analyzers/framework_detector.py` — Evidence-based detection for FastAPI, Flask, Django, Express, React, Vue, Next, SQLAlchemy, and Vite

### Frontend (`frontend/src/`)

- `pages/Explorer.tsx` — Upload → three-column layout (File Tree | Architecture Graph | Insights) with Monaco viewer
- `components/FileTree.tsx`, `ArchitectureGraph.tsx`, `InsightsPanel.tsx`, `CodeViewer.tsx`, `UploadDropzone.tsx`
- `services/api.ts` — Axios client

---

## Tech Stack

| Layer | Technology |
|---------|------------|
| Backend | Python 3.12, FastAPI, Pydantic, `ast`, `uvicorn`, `python-multipart` |
| Frontend | React 18, TypeScript, Vite 5, Tailwind 3, React Flow 11, Monaco Editor |
| Storage | Temporary filesystem + in-memory dictionary (`STORE`) |
| Deployment | Docker + Docker Compose |

---

## Quick Start

### Docker (Recommended)

```bash
docker compose up --build

# Frontend
http://localhost:5173

# Backend
http://localhost:8000
```

### Local Development

#### Backend

```bash
# From repository root
python -m pip install -r backend/requirements.txt
python -m uvicorn backend.app.main:app --reload --port 8000

# Or from backend/
cd backend
uvicorn app.main:app --reload --port 8000
```

> Do not run `uvicorn backend.app.main:app` while inside `backend/` or you will get `ModuleNotFoundError: No module named 'backend'`.

If using a virtual environment at the repository root:

```bash
source .venv/bin/activate

# Windows
.venv\Scripts\activate
```

#### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at:

```text
http://localhost:5173
```

---

## Usage

1. Zip a repository (`zip -r repo.zip .`).
2. Open `http://localhost:5173`.
3. Drag and drop the `.zip` file (or click **Browse**).
4. Explore the file tree, architecture graph, and source code.

### Sample Repository

A sample repository is included at `/sample-repo`, containing a small FastAPI + React e-commerce application ("ShopSphere") with:

- `backend/app/api/*` (auth, users, products, orders)
- `services/*`, `models/*`, `core/*`
- `frontend/src/*` (components, API, store)
- Dependencies including `react`, `axios`, and `zustand`
- Cross-import relationships for architecture graph visualization

Create a ZIP archive:

```bash
# Linux / macOS
zip -r sample-repo.zip sample-repo

# Windows PowerShell
Compress-Archive -Path sample-repo\* -DestinationPath sample-repo.zip -Force
```

---

## API

| Method | Endpoint | Description |
|----------|----------|-------------|
| `POST` | `/api/analyze` | Upload a ZIP and receive an `AnalysisResult` |
| `GET` | `/api/repository/{id}/analysis` | Retrieve cached analysis |
| `GET` | `/api/repository/{id}/file?path=relative/path.py` | Retrieve raw text file content |
| `GET` | `/health` | Health check endpoint |
| `GET` | `/api/llm/status` | Returns model configuration status |
| `POST` | `/api/chat` | Chat endpoint using Groq `openai/gpt-oss-20b` |
| `POST` | `/api/repository/{id}/chat` | Repository-aware chat endpoint |

### AnalysisResult

`AnalysisResult` includes:

- `file_tree`
- `languages`
- `frameworks`
- `dependencies`
- `endpoints`
- `classes`
- `functions`
- `imports`
- `graph { nodes, edges }`
- `stats`

---

## Security & Limitations

- Path traversal protection prevents extraction of entries containing `..` or absolute paths.
- `GET /file` validates paths using `relative_to(root)`.
- Ignored directories:
  - `.git`
  - `node_modules`
  - `.venv`
  - `venv`
  - `__pycache__`
  - `dist`
  - `build`
  - `.next`
  - `__MACOSX`
- Binary assets such as images and fonts are skipped.
- Analyses are stored in memory only and are lost after restart.
- Maximum ZIP size: **50 MB**.
- Files larger than **2 MB** are skipped when detected as binary.
- Python parsing uses `ast`; JS/TS parsing uses lightweight regex matching.
- No authentication, database, or persistent storage (MVP scope).

---

## Testing

```bash
# Backend
python -m pytest backend/tests -v

# Frontend
cd frontend
npm run build
```

Tests cover:

- Python import detection
- FastAPI route detection
- JS import and Express route detection
- Ignore-rule validation
- Path traversal protection
- `POST /api/analyze` → `GET /file` flow

---

## Project Structure

```text
.
├── backend/app/
│   ├── api/routes.py
│   ├── analyzers/{python,js,deps,framework}_*.py
│   ├── models/schemas.py
│   └── services/analyzer_service.py
├── frontend/src/{components,pages,services,types}/
├── sample-repo/{backend,frontend}/
├── docker-compose.yml
├── backend/Dockerfile
└── frontend/Dockerfile
```

---

## Troubleshooting

- **Invalid zip** → Ensure the repository contents were zipped correctly.
- **File not found** → Use paths relative to the ZIP root (for example, `backend/app/main.py`).
- **CORS issues** → Backend allows `*` in MVP mode; restrict origins in production.
