import tempfile, zipfile, io, json, sys
from pathlib import Path
try:
    from app.analyzers.python_analyzer import parse_python_file
    from app.analyzers.js_analyzer import parse_js_file
    from app.services.analyzer_service import analyze_repository, get_file_content, STORE, build_analysis, is_ignored
except ModuleNotFoundError:
    # when pytest is run from repo root (pythonpath=repo root)
    from backend.app.analyzers.python_analyzer import parse_python_file
    from backend.app.analyzers.js_analyzer import parse_js_file
    from backend.app.services.analyzer_service import analyze_repository, get_file_content, STORE, build_analysis, is_ignored

def test_python_import_detection(tmp_path: Path = Path(tempfile.gettempdir())):
    p = Path(tempfile.mktemp(suffix=".py"))
    p.write_text("import os\nfrom app.services.auth_service import hash_password\nimport fastapi\n")
    imports, classes, funcs, eps = parse_python_file(p, "test.py")
    imported_names = [i["imported"] for i in imports]
    assert "os" in imported_names
    assert any("auth_service" in x for x in imported_names)
    assert "fastapi" in imported_names

def test_python_route_detection():
    p = Path(tempfile.mktemp(suffix=".py"))
    p.write_text("""
from fastapi import APIRouter
router = APIRouter()
@router.get("/users")
def list_users():
    pass
@router.post("/users")
def create_user():
    pass
""")
    _, _, _, eps = parse_python_file(p, "app/api/users.py")
    paths = {(e["method"], e["path"]) for e in eps}
    assert ("GET", "/users") in paths
    assert ("POST", "/users") in paths

def test_js_import_detection():
    p = Path(tempfile.mktemp(suffix=".js"))
    p.write_text("import React from 'react'\nimport { fetchProducts } from '../api/client'\nconst x = require('express')\n")
    imports, _, _, _ = parse_js_file(p, "frontend/src/App.js")
    imported = [i["imported"] for i in imports]
    assert "react" in imported
    assert "../api/client" in imported
    assert "express" in imported

def test_file_discovery_ignores(tmp_path=None):
    # create a temp root with ignored dirs
    root = Path(tempfile.mkdtemp())
    (root / ".git").mkdir()
    (root / ".git" / "config").write_text("git")
    (root / "node_modules").mkdir()
    (root / "node_modules" / "lib.js").write_text("x")
    (root / "app.py").write_text("print('hi')")
    (root / "real").mkdir()
    (root / "real" / "file.py").write_text("import os")
    analysis = build_analysis(root, "testid")
    # should not include .git or node_modules files
    tree_str = json.dumps(analysis["file_tree"])
    assert ".git" not in tree_str
    assert "node_modules" not in tree_str
    assert "app.py" in tree_str

def test_path_traversal_prevention():
    # create zip with traversal
    data = io.BytesIO()
    with zipfile.ZipFile(data, 'w') as z:
        z.writestr("../../evil.txt", "evil")
        z.writestr("app.py", "print('ok')")
    repo_id, _ = analyze_repository(data.getvalue(), "test.zip")
    # attempt traversal read
    content, err = get_file_content(repo_id, "../../evil.txt")
    assert err is not None
    assert "traversal" in err.lower() or "invalid" in err.lower()
    # also ../
    content, err = get_file_content(repo_id, "../app.py")
    assert err is not None

def test_express_route_detection():
    p = Path(tempfile.mktemp(suffix=".js"))
    p.write_text("const router = require('express').Router();\nrouter.get('/products', (req,res)=>{});\nrouter.post('/orders', handler);\n")
    _, _, _, eps = parse_js_file(p, "routes.js")
    assert any(e["path"]=="/products" and e["method"]=="GET" for e in eps)
    assert any(e["path"]=="/orders" and e["method"]=="POST" for e in eps)

# Run if executed directly
if __name__ == "__main__":
    test_python_import_detection()
    test_python_route_detection()
    test_js_import_detection()
    test_file_discovery_ignores()
    test_path_traversal_prevention()
    test_express_route_detection()
    print("all tests passed")
