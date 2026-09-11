from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
try:
    from app.api.routes import router  # when running as `uvicorn app.main:app` inside backend/
except ImportError:
    from backend.app.api.routes import router  # when running as `uvicorn backend.app.main:app` from repo root

app = FastAPI(title="Codebase Explorer API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/")
def root():
    return {"name": "Codebase Explorer API", "health": "/health", "analyze": "POST /api/analyze"}
