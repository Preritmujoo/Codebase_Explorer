"""Groq LLM integration (default model: openai/gpt-oss-20b).

The API key is read ONLY from the GROQ_API_KEY environment variable and is
never logged, returned, or stored. Without it, chat raises a RuntimeError and
the API layer maps that to HTTP 503.
"""
import os

# Auto-load local .env (repo root) so `uvicorn` picks up GROQ_API_KEY without
# an explicit export. Docker Compose also loads it via its own env_file logic.
try:
    from dotenv import load_dotenv, find_dotenv
    load_dotenv(find_dotenv())
except ImportError:
    pass

DEFAULT_MODEL = "openai/gpt-oss-20b"

_client = None


def is_configured() -> bool:
    return bool(os.environ.get("GROQ_API_KEY"))


def get_client():
    global _client
    if _client is not None:
        return _client
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError("GROQ_API_KEY environment variable is not set")
    from groq import Groq
    _client = Groq(api_key=api_key)
    return _client


def reset_client():
    """For tests: drop the cached client so env changes take effect."""
    global _client
    _client = None


def chat(messages: list, model: str = DEFAULT_MODEL, max_tokens: int = 2048,
         temperature: float = 0.7) -> str:
    """Run a chat completion, e.g.:
        client = Groq()
        completion = client.chat.completions.create(
            model="openai/gpt-oss-20b", messages=[...])
    """
    client = get_client()
    completion = client.chat.completions.create(
        model=model or DEFAULT_MODEL,
        messages=messages,
        max_tokens=max_tokens,
        temperature=temperature,
    )
    return completion.choices[0].message.content or ""


# --- Codebase context for repo-aware chat (kept compact for the context window) ---
MAX_FILES = 250
MAX_ITEMS = 60
MAX_FILE_CHARS = 8000


def _walk_files(node: dict, out: list):
    if node.get("type") == "file":
        out.append(node.get("path", ""))
    for ch in node.get("children") or []:
        _walk_files(ch, out)


def build_repo_context(analysis: dict, file_path: str | None = None,
                       file_content: str | None = None) -> str:
    """Summarize an analysis dict into a system prompt so the model can
    answer questions about this specific codebase's structure."""
    parts = ["You are a code assistant. Answer questions about the codebase described below. Be concise and reference file paths."]
    parts.append(f"Repository: {analysis.get('id')} · {analysis.get('file_count')} files · {analysis.get('total_lines')} lines")

    files: list = []
    _walk_files(analysis.get("file_tree") or {}, files)
    shown = files[:MAX_FILES]
    parts.append(f"Files ({len(files)} total{'' if len(files) <= MAX_FILES else f', showing {MAX_FILES}'}):\n" + "\n".join(f"- {p}" for p in shown))

    langs = analysis.get("languages") or []
    if langs:
        parts.append("Languages: " + ", ".join(f"{l.get('language')} ({l.get('files')} files)" for l in langs))

    fw = [f.get("name") for f in (analysis.get("frameworks") or []) if f.get("detected")]
    if fw:
        parts.append("Frameworks: " + ", ".join(fw))

    deps = analysis.get("dependencies") or []
    dep_bits = []
    for d in deps:
        pkgs = [p.get("name") for p in (d.get("packages") or [])[:20]]
        dep_bits.append(f"{d.get('file')} [{d.get('ecosystem')}]: {', '.join(pkgs)}")
    if dep_bits:
        parts.append("Dependencies:\n" + "\n".join(f"- {b}" for b in dep_bits))

    eps = (analysis.get("endpoints") or [])[:MAX_ITEMS]
    if eps:
        parts.append("API endpoints:\n" + "\n".join(
            f"- {e.get('method')} {e.get('path')} ({e.get('file')}:{e.get('line')})" for e in eps))

    cls = (analysis.get("classes") or [])[:MAX_ITEMS]
    if cls:
        parts.append("Classes:\n" + "\n".join(
            f"- {c.get('name')} ({c.get('file')}:{c.get('line')})" for c in cls))

    fns = (analysis.get("functions") or [])[:MAX_ITEMS]
    if fns:
        parts.append("Functions:\n" + "\n".join(
            f"- {f.get('name')}() ({f.get('file')}:{f.get('line')})" for f in fns))

    imps = (analysis.get("imports") or [])[:MAX_ITEMS]
    if imps:
        parts.append("Key imports:\n" + "\n".join(
            f"- {i.get('file')} imports {i.get('imported')}" for i in imps))

    if file_path and file_content is not None:
        parts.append(f"Selected file ({file_path}):\n```\n{file_content[:MAX_FILE_CHARS]}\n```")
    return "\n\n".join(parts)
