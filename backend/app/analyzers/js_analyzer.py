import re
from pathlib import Path
from typing import List

IMPORT_RE = re.compile(r"""(?:import\s+(?:.*?\s+from\s+)?['"]([^'"]+)['"]|require\s*\(\s*['"]([^'"]+)['"]\s*\)|import\s*\(\s*['"]([^'"]+)['"]\s*\))""")
EXPORT_RE = re.compile(r"export\s+(?:default\s+)?(?:class|function|const|let|var)?\s*(\w+)?")
FUNC_RE = re.compile(r"(?:function\s+(\w+)|const\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>|class\s+(\w+))")
# Express route detection
EXPRESS_ROUTE_RE = re.compile(r"(?:app|router)\.(get|post|put|delete|patch|use)\s*\(\s*['\"]([^'\"]+)['\"]")
REACT_DETECT = re.compile(r"from\s+['\"]react['\"]|React\.")
AXIOS_RE = re.compile(r"axios\.(get|post|put|delete|patch)\s*\(\s*['\"]([^'\"]+)['\"]")

def parse_js_file(filepath: Path, rel_path: str):
    try:
        text = filepath.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return [], [], [], []
    imports = []
    for m in IMPORT_RE.finditer(text):
        imp = m.group(1) or m.group(2) or m.group(3)
        if imp:
            # estimate line
            line = text[:m.start()].count("\n") + 1
            imports.append({
                "source": rel_path,
                "imported": imp,
                "file": rel_path,
                "line": line,
                "raw": imp,
            })
    classes = []
    functions = []
    for i, line_text in enumerate(text.splitlines(), start=1):
        m = re.search(r"class\s+(\w+)", line_text)
        if m:
            classes.append({"name": m.group(1), "file": rel_path, "line": i, "methods": [], "bases": []})
        m2 = re.search(r"function\s+(\w+)\s*\(", line_text)
        if m2:
            functions.append({"name": m2.group(1), "file": rel_path, "line": i, "args": [], "is_async": "async" in line_text})
        m3 = re.search(r"const\s+(\w+)\s*=\s*(?:async\s*)?\(", line_text)
        if m3 and "=>" in line_text:
            functions.append({"name": m3.group(1), "file": rel_path, "line": i, "args": [], "is_async": "async" in line_text})
        m4 = re.search(r"export\s+(?:default\s+)?function\s+(\w+)", line_text)
        if m4 and m4.group(1) not in [f["name"] for f in functions]:
            functions.append({"name": m4.group(1), "file": rel_path, "line": i, "args": [], "is_async": False})

    endpoints = []
    for m in EXPRESS_ROUTE_RE.finditer(text):
        method = m.group(1).upper()
        path = m.group(2)
        line = text[:m.start()].count("\n") + 1
        # router.use not really endpoint
        if method == "USE":
            continue
        endpoints.append({"path": path, "method": method, "file": rel_path, "function": "", "framework": "Express", "line": line})
    for m in AXIOS_RE.finditer(text):
        # These are client calls, not endpoints definitions, skip or optionally include as client
        pass

    return imports, classes, functions, endpoints
