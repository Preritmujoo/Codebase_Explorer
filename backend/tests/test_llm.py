from fastapi.testclient import TestClient
import io, zipfile

try:
    from app.main import app
    from app.services import llm_service
except ModuleNotFoundError:
    from backend.app.main import app
    from backend.app.services import llm_service

client = TestClient(app)


def make_repo():
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w') as z:
        z.writestr("app/main.py", "from fastapi import FastAPI\napp = FastAPI()\n@app.get('/hi')\ndef hi(): return 'hi'\n")
        z.writestr("requirements.txt", "fastapi==0.110.0\n")
    buf.seek(0)
    resp = client.post("/api/analyze", files={"file": ("repo.zip", buf.getvalue(), "application/zip")})
    assert resp.status_code == 200, resp.text
    return resp.json()["id"]


def test_llm_status_shape(monkeypatch):
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    llm_service.reset_client()
    r = client.get("/api/llm/status")
    assert r.status_code == 200
    body = r.json()
    assert body["configured"] is False
    assert body["default_model"] == "openai/gpt-oss-20b"


def test_chat_validation():
    r = client.post("/api/chat", json={"messages": []})
    assert r.status_code == 400
    r = client.post("/api/chat", json={"messages": [{"role": "bogus", "content": "x"}]})
    assert r.status_code == 400


def test_repo_chat_unknown_repo():
    r = client.post("/api/repository/nope123/chat", json={"messages": [{"role": "user", "content": "hi"}]})
    assert r.status_code == 404


def test_repo_chat_context_and_file(monkeypatch):
    repo_id = make_repo()
    captured = {}

    def fake_chat(messages, model=None, max_tokens=2048, temperature=0.7):
        captured["messages"] = messages
        captured["model"] = model
        return "canned answer"

    monkeypatch.setattr(llm_service, "chat", fake_chat)
    r = client.post(f"/api/repository/{repo_id}/chat", json={
        "messages": [{"role": "user", "content": "what endpoints exist?"}],
        "file_path": "app/main.py",
    })
    assert r.status_code == 200, r.text
    assert r.json()["content"] == "canned answer"
    system = captured["messages"][0]
    assert system["role"] == "system"
    assert "app/main.py" in system["content"]      # file list
    assert "/hi" in system["content"]              # endpoint
    assert "def hi" in system["content"]           # selected file content


def test_repo_chat_bad_file():
    repo_id = make_repo()
    r = client.post(f"/api/repository/{repo_id}/chat", json={
        "messages": [{"role": "user", "content": "hi"}],
        "file_path": "../evil.py",
    })
    assert r.status_code == 400
    r = client.post(f"/api/repository/{repo_id}/chat", json={
        "messages": [{"role": "user", "content": "hi"}],
        "file_path": "missing.py",
    })
    assert r.status_code == 404
