from fastapi.testclient import TestClient
import io, zipfile, json, pathlib, tempfile

try:
    from app.main import app
except ModuleNotFoundError:
    from backend.app.main import app

client = TestClient(app)

def make_zip(files: dict):
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w') as z:
        for name, content in files.items():
            z.writestr(name, content)
    buf.seek(0)
    return buf.getvalue()

def test_analyze_and_fetch():
    zip_bytes = make_zip({
        "app/main.py": "from fastapi import FastAPI\napp=FastAPI()\n@app.get('/hi')\ndef hi(): pass",
        "requirements.txt": "fastapi==0.110.0\n",
        "frontend/package.json": json.dumps({"dependencies": {"react": "^18.0.0"}})
    })
    resp = client.post("/api/analyze", files={"file": ("repo.zip", zip_bytes, "application/zip")})
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "file_tree" in data
    assert data["id"]
    repo_id = data["id"]
    # fetch analysis
    r2 = client.get(f"/api/repository/{repo_id}/analysis")
    assert r2.status_code == 200
    # fetch file
    r3 = client.get(f"/api/repository/{repo_id}/file", params={"path": "app/main.py"})
    assert r3.status_code == 200
    assert "FastAPI" in r3.json()["content"]
    # traversal blocked
    r4 = client.get(f"/api/repository/{repo_id}/file", params={"path": "../app/main.py"})
    assert r4.status_code in (400, 404)

def test_invalid_zip():
    resp = client.post("/api/analyze", files={"file": ("bad.zip", b"not a zip", "application/zip")})
    assert resp.status_code == 400

def test_non_zip_rejected():
    resp = client.post("/api/analyze", files={"file": ("file.txt", b"hello", "text/plain")})
    assert resp.status_code == 400
