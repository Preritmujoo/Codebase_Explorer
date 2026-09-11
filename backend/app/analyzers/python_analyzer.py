import ast
import re
from pathlib import Path
from typing import List, Tuple

# Detect frameworks by import names
FRAMEWORK_IMPORTS = {
    "fastapi": "FastAPI",
    "flask": "Flask",
    "django": "Django",
    "sqlalchemy": "SQLAlchemy",
}

def parse_python_file(filepath: Path, rel_path: str):
    try:
        source = filepath.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return [], [], [], []
    try:
        tree = ast.parse(source)
    except SyntaxError:
        return [], [], [], []

    imports = []
    classes = []
    functions = []
    endpoints = []

    # Collect router variable names that are APIRouter() or Flask etc
    router_vars = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Assign):
            # router = APIRouter() or app = FastAPI()
            if isinstance(node.value, ast.Call):
                func_name = _get_call_name(node.value)
                if func_name in ("APIRouter", "FastAPI", "Flask", "Blueprint"):
                    for target in node.targets:
                        if isinstance(target, ast.Name):
                            router_vars.add(target.id)

    for node in tree.body:
        # imports at top-level plus walk deeper
        pass

    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                imports.append({
                    "source": rel_path,
                    "imported": alias.name,
                    "file": rel_path,
                    "line": node.lineno,
                    "raw": alias.name,
                })
        elif isinstance(node, ast.ImportFrom):
            module = node.module or ""
            for alias in node.names:
                imported = f"{module}.{alias.name}" if module else alias.name
                imports.append({
                    "source": rel_path,
                    "imported": imported,
                    "module": module,
                    "file": rel_path,
                    "line": node.lineno,
                    "raw": module,
                })
        elif isinstance(node, ast.ClassDef):
            methods = [n.name for n in node.body if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))]
            bases = [_get_name(b) for b in node.bases]
            classes.append({
                "name": node.name,
                "file": rel_path,
                "line": node.lineno,
                "methods": methods,
                "bases": bases,
            })
        elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            # only top-level or class methods? we collect all
            args = [a.arg for a in node.args.args]
            functions.append({
                "name": node.name,
                "file": rel_path,
                "line": node.lineno,
                "args": args,
                "is_async": isinstance(node, ast.AsyncFunctionDef),
                "decorators": [_get_decorator_name(d) for d in node.decorator_list],
                "node": node,
            })

    # endpoint detection
    for func in functions:
        node = func["node"]
        for dec in node.decorator_list:
            path, method, framework = _parse_endpoint_decorator(dec, router_vars)
            if path:
                endpoints.append({
                    "path": path,
                    "method": method,
                    "file": rel_path,
                    "function": func["name"],
                    "framework": framework,
                    "line": func["line"],
                })
        # Also remove node reference
        func.pop("node", None)
        func.pop("decorators", None)

    return imports, classes, functions, endpoints

def _get_name(node):
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        return _get_name(node.value) + "." + node.attr
    return ""

def _get_call_name(call: ast.Call):
    if isinstance(call.func, ast.Name):
        return call.func.id
    if isinstance(call.func, ast.Attribute):
        return call.func.attr
    return ""

def _get_decorator_name(dec):
    if isinstance(dec, ast.Call):
        if isinstance(dec.func, ast.Attribute):
            return dec.func.attr
        if isinstance(dec.func, ast.Name):
            return dec.func.id
    if isinstance(dec, ast.Attribute):
        return dec.attr
    if isinstance(dec, ast.Name):
        return dec.id
    return ""

def _parse_endpoint_decorator(dec, router_vars):
    # Handles @app.get("/path"), @router.post("/path"), @app.route(...)
    method = None
    path = None
    framework = "FastAPI"
    func = None
    args = []
    if isinstance(dec, ast.Call):
        func = dec.func
        if dec.args and isinstance(dec.args[0], ast.Constant) and isinstance(dec.args[0].value, str):
            path = dec.args[0].value
        # also check keywords?
        if isinstance(func, ast.Attribute):
            method = func.attr.upper()
            # owner like app, router
            owner = func.value.id if isinstance(func.value, ast.Name) else ""
            if owner in router_vars:
                # guess framework - default fastapi; if flask-style methods like route treat specially
                if method == "ROUTE":
                    method = "GET"
                    framework = "Flask"
                    # try to get methods kwarg
                    for kw in dec.keywords:
                        if kw.arg == "methods" and isinstance(kw.value, ast.List):
                            # take first
                            if kw.value.elts and isinstance(kw.value.elts[0], ast.Constant):
                                method = str(kw.value.elts[0].value).upper()
                else:
                    framework = "FastAPI"
            else:
                # Unknown decorator, check if method is http verb
                if method not in ("GET","POST","PUT","DELETE","PATCH","OPTIONS","HEAD"):
                    return None, None, None
        elif isinstance(func, ast.Name):
            # e.g. @get("/path") unlikely
            return None, None, None
        # validate path looks like route
        if path and not path.startswith("/"):
            # Could be non-route decorator with string arg
            if method not in ("GET","POST","PUT","DELETE","PATCH"):
                return None, None, None
        if method and path:
            return path, method, framework
    return None, None, None
