# Codebase Explorer — MVP

Upload a `.zip` of any source-code repo and get an instant architectural overview: file tree, languages, frameworks, dependencies, API endpoints, classes/functions, import graph, and a Monaco-powered code viewer.

![Stack](https://img.shields.io/badge/Backend-FastAPI-009688) ![Frontend](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-61DAFB) ![Python](https://img.shields.io/badge/Python-3.12-3776AB)

## Architecture

```
┌─────────────────┐      POST /api/analyze (zip)      ┌──────────────────┐
│  React (Vite)   │  ───────────────────────────────>  │  FastAPI + AST   │
│  Tailwind       │  <───────────────────────────────  │  analyzers/      │
│  React Flow     │      JSON analysis                 │  services/       │
│  Monaco Editor  │  ───────────────────────────────>  │  /api/repository │
└─────────────────┘      GET /file?path=...            └──────────────────┘
         ▲                                                    ▲
         │ docker-compose.yml                                 │
         └─────────────── Docker Compose ──────────────────────┘
```

**Backend** (`backend/app/`):
- `api/routes.py` — `POST /api/analyze`, `GET /api/repository/{id}/analysis`, `GET /api/repository/{id}/file`
- `services/analyzer_service.py` — zip extraction (traversal-safe), file discovery, tree building, graph construction, in-memory store
- `analyzers/python_analyzer.py` — `ast` parsing for imports/classes/functions + decorator-based FastAPI/Flask route detection
- `analyzers/js_analyzer.py` — regex-based import/Express route detection for JS/TS
- `analyzers/deps_analyzer.py` — `requirements.txt`, `pyproject.toml`, `package.json` parsing
- `analyzers/framework_detector.py` — evidence-based detection for FastAPI/Flask/Django/Express/React/Vue/Next/SQLAlchemy/Vite

**Frontend** (`frontend/src/`):
- `pages/Explorer.tsx` — upload → 3-column layout (File Tree | Architecture Graph | Insights) + Monaco viewer
- `components/FileTree.tsx`, `ArchitectureGraph.tsx`, `InsightsPanel.tsx`, `CodeViewer.tsx`, `UploadDropzone.tsx`
- `services/api.ts` — axios client

## Tech Stack

| Layer | Tech |
|-------|------|
| Backend | Python 3.12, FastAPI, Pydantic, `ast`, `uvicorn`, `python-multipart` |
| Frontend | React 18, TypeScript, Vite 5, Tailwind 3, React Flow 11, Monaco Editor |
| Storage | Temp filesystem + in-memory dict (`STORE`) — no DB |
| Deploy | Docker + Docker Compose |

## Quick Start

### Docker (recommended)
```bash
docker compose up --build
# frontend → http://localhost:5173
# backend  → http://localhost:8000  (GET /health, POST /api/analyze)
```

### Local dev (without Docker)
```bash
# Backend — from repo root (recommended, works with .venv at repo root):
python -m pip install -r backend/requirements.txt
python -m uvicorn backend.app.main:app --reload --port 8000
# or, if you cd into backend/:
cd backend
uvicorn app.main:app --reload --port 8000
# (do NOT run `uvicorn backend.app.main:app` while inside backend/ — that
#  gives ModuleNotFoundError: No module named 'backend')

# With a venv at repo root (.venv):
source .venv/bin/activate  # Windows: .venv\Scripts\activate
# then either of the above commands
```

# Frontend
cd frontend
npm install
npm run dev
# → http://localhost:5173  (proxies /api to :8000 via vite.config.ts)
```

## Usage

1. Zip a repository (any folder → right-click → Compress / `zip -r repo.zip .`).
2. Open http://localhost:5173, drag-and-drop the `.zip` (or click Browse).
3. Explore the file tree, click a graph node/file to view source in Monaco, inspect Languages/Frameworks/APIs.

**Sample repo** included at `/sample-repo` — a small FastAPI + React e-commerce app (ShopSphere) with:
- `backend/app/api/*` (auth, users, products, orders), `services/*`, `models/*`, `core/*`
- `frontend/src/*` (components, api, store) with `react`, `axios`, `zustand`
- Real cross-imports (`app.services.auth_service` ↔ `app.models.user`, `inventory_service` ↔ `order_service`, React `ProductList` ↔ `api/client` ↔ `ProductCard`) so the architecture graph is dense.

Zip it quickly:
```bash
# Linux/Mac
zip -r sample-repo.zip sample-repo
# Windows PowerShell
Compress-Archive -Path sample-repo\* -DestinationPath sample-repo.zip -Force
```

## API

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/analyze` | multipart `file` (.zip) → `AnalysisResult` |
| `GET` | `/api/repository/{id}/analysis` | fetch cached analysis |
| `GET` | `/api/repository/{id}/file?path=relative/path.py` | raw file content (text only) |
| `GET` | `/health` | `{status: ok}` |
| `GET` | `/api/llm/status` | `{configured, default_model}` — is `GROQ_API_KEY` set? (key never exposed) |
| `POST` | `/api/chat` | `{messages, model?, max_tokens?, temperature?}` → Groq `openai/gpt-oss-20b` reply |
| `POST` | `/api/repository/{id}/chat` | repo-aware chat: `{messages, file_path?, include_structure?}` — model gets file list, languages, frameworks, endpoints, classes/functions + optional selected file |

`AnalysisResult` includes `file_tree`, `languages`, `frameworks`, `dependencies`, `endpoints`, `classes`, `functions`, `imports`, `graph: {nodes, edges}`, `stats`.

## Security & Limitations

- **Path traversal** prevented: zip entries with `..` or absolute paths are skipped; `GET /file` validates `..` and `relative_to(root)`.
- **Ignored**: `.git`, `node_modules`, `.venv`, `venv`, `__pycache__`, `dist`, `build`, `.next`, binary extensions (png, jpg, woff, etc.), `__MACOSX`.
- **In-memory only**: analyses live in `STORE` until process restart; no persistence.
- **50 MB** zip limit; files >2 MB binary-skipped.
- **Parsing**: Python via `ast` (accurate), JS/TS via lightweight regex (no Babel) — may miss dynamic imports.
- **No auth, no DB, no LLM** — as scoped for MVP.

## Testing

```bash
# Backend (Windows example)
python -m pytest backend/tests -v

# Frontend build
cd frontend && npm run build
```

Tests cover: Python import detection, FastAPI route detection, JS import/Express route detection, file-discovery ignore rules, path-traversal blocking, and happy-path `POST /api/analyze` → `GET /file`.

## Project Structure

```
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

## Troubleshooting

- `Invalid zip` → ensure you zipped the folder contents, not a nested archive.
- `File not found` → paths are relative to the zip root (e.g., `backend/app/main.py`, not `/abs/path`).
- CORS → backend allows `*` in MVP; restrict in production.
