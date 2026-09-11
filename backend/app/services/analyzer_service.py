import tempfile
import zipfile
import uuid
import os
import json
import re
from pathlib import Path
from collections import Counter, defaultdict

try:
    from app.analyzers.python_analyzer import parse_python_file
    from app.analyzers.js_analyzer import parse_js_file
    from app.analyzers.deps_analyzer import parse_requirements, parse_pyproject, parse_package_json
    from app.analyzers.framework_detector import detect_frameworks
except ImportError:
    from backend.app.analyzers.python_analyzer import parse_python_file
    from backend.app.analyzers.js_analyzer import parse_js_file
    from backend.app.analyzers.deps_analyzer import parse_requirements, parse_pyproject, parse_package_json
    from backend.app.analyzers.framework_detector import detect_frameworks

IGNORE_DIRS = {".git", "node_modules", ".venv", "venv", "__pycache__", "dist", "build", ".next", ".idea", ".vscode"}
IGNORE_FILES = {".DS_Store"}
BINARY_EXTS = {".png",".jpg",".jpeg",".gif",".ico",".pdf",".zip",".tar",".gz",".exe",".dll",".so",".woff",".woff2",".ttf",".eot",".mp4",".mp3",".avi",".mov",".bin"}
LANGUAGE_MAP = {
    ".py": "Python",
    ".js": "JavaScript",
    ".jsx": "JavaScript",
    ".ts": "TypeScript",
    ".tsx": "TypeScript",
    ".json": "JSON",
    ".css": "CSS",
    ".html": "HTML",
    ".md": "Markdown",
    ".yaml": "YAML",
    ".yml": "YAML",
    ".toml": "TOML",
    ".sql": "SQL",
}
COLOR_MAP = {
    "Python": "#3776AB",
    "JavaScript": "#f7df1e",
    "TypeScript": "#3178c6",
    "JSON": "#292929",
    "CSS": "#563d7c",
    "HTML": "#e34c26",
    "Markdown": "#083fa1",
    "YAML": "#41454A",
    "TOML": "#9ca3af",
    "SQL": "#e38c00",
    "Other": "#6b7280",
}

# In-memory store
STORE = {}  # id -> {tmpdir: Path, analysis: dict}

def is_ignored(path: Path, rel_parts):
    for part in rel_parts:
        if part in IGNORE_DIRS:
            return True
    if path.suffix.lower() in BINARY_EXTS:
        return True
    if path.name in IGNORE_FILES:
        return True
    return False

def safe_extract(zip_path: Path, dest: Path):
    with zipfile.ZipFile(zip_path, 'r') as z:
        for member in z.infolist():
            # Prevent path traversal via .. or absolute paths
            member_path = Path(member.filename)
            # Reject absolute paths
            if member_path.is_absolute():
                continue
            # Resolve and ensure within dest
            # Use parts to check traversal
            parts = member_path.parts
            if ".." in parts:
                continue
            # also skip directories starting with __MACOSX
            if parts and parts[0] == "__MACOSX":
                continue
            target = dest / member_path
            # Double check traversal after joining
            try:
                target.resolve().relative_to(dest.resolve())
            except ValueError:
                continue
            if member.is_dir():
                target.mkdir(parents=True, exist_ok=True)
            else:
                target.parent.mkdir(parents=True, exist_ok=True)
                with z.open(member) as src, open(target, 'wb') as dst:
                    dst.write(src.read())

def analyze_repository(zip_bytes: bytes, original_filename: str):
    repo_id = uuid.uuid4().hex[:12]
    tmpdir = Path(tempfile.mkdtemp(prefix=f"repo_{repo_id}_"))
    zip_path = tmpdir / "upload.zip"
    zip_path.write_bytes(zip_bytes)
    extract_dir = tmpdir / "src"
    extract_dir.mkdir()
    safe_extract(zip_path, extract_dir)
    # If zip contains single top-level directory, use it
    # flatten one level if only one dir and no files at root
    entries = list(extract_dir.iterdir())
    if len(entries) == 1 and entries[0].is_dir():
        # Check if root has files? if single dir, use it as root
        root = entries[0]
    else:
        root = extract_dir

    analysis = build_analysis(root, repo_id)
    STORE[repo_id] = {"tmpdir": tmpdir, "root": root, "analysis": analysis}
    return repo_id, analysis

def build_analysis(root: Path, repo_id: str):
    all_files = []
    for p in root.rglob("*"):
        if p.is_file():
            rel = p.relative_to(root).as_posix()
            parts = Path(rel).parts
            if is_ignored(p, parts):
                continue
            # size limit 1MB for text? still count
            try:
                size = p.stat().st_size
            except:
                size = 0
            # skip large binary heuristics
            if size > 2*1024*1024 and p.suffix.lower() in BINARY_EXTS:
                continue
            all_files.append((p, rel))

    # Build file tree
    file_tree = build_file_tree(all_files, root)

    languages_counter = Counter()
    lines_counter = Counter()
    file_sizes = {}
    files_text_map = {}
    imports_all = []
    classes_all = []
    functions_all = []
    endpoints_all = []
    dependencies = []
    total_lines = 0

    for p, rel in all_files:
        ext = p.suffix.lower()
        lang = LANGUAGE_MAP.get(ext, "Other" if ext else "Other")
        # For known text files, count lines
        lines = 0
        text = None
        if lang in ("Python","JavaScript","TypeScript","JSON","CSS","HTML","Markdown","YAML","TOML","SQL","Other"):
            try:
                # try reading as text, skip binary
                raw = p.read_bytes()
                # binary check: null byte
                if b"\x00" in raw[:1024]:
                    continue
                text = raw.decode("utf-8", errors="ignore")
                lines = text.count("\n") + (1 if text and not text.endswith("\n") else 0) if text.strip() else 0
                # for files without newline at end etc
                if text.strip() == "":
                    lines = 0
                files_text_map[rel] = text[:5000]  # store snippet for framework detection
            except:
                text = None
                lines = 0
        languages_counter[lang] += 1
        lines_counter[lang] += lines
        total_lines += lines
        file_sizes[rel] = {"size": p.stat().st_size if p.exists() else 0, "lines": lines}

        if ext == ".py":
            imps, cls, funcs, eps = parse_python_file(p, rel)
            imports_all.extend(imps)
            classes_all.extend(cls)
            functions_all.extend(funcs)
            endpoints_all.extend(eps)
        elif ext in (".js",".jsx",".ts",".tsx"):
            imps, cls, funcs, eps = parse_js_file(p, rel)
            imports_all.extend(imps)
            classes_all.extend(cls)
            functions_all.extend(funcs)
            endpoints_all.extend(eps)

        # deps files
        if p.name == "requirements.txt":
            deps = parse_requirements(p)
            dependencies.append({"ecosystem": "python", "file": rel, "packages": deps})
        elif p.name == "pyproject.toml":
            deps = parse_pyproject(p)
            if deps:
                dependencies.append({"ecosystem": "python", "file": rel, "packages": deps})
        elif p.name == "package.json":
            deps = parse_package_json(p)
            if deps:
                dependencies.append({"ecosystem": "node", "file": rel, "packages": deps})

    # Languages stats
    languages = []
    for lang, count in languages_counter.most_common():
        languages.append({
            "language": lang,
            "files": count,
            "lines": lines_counter[lang],
            "color": COLOR_MAP.get(lang, "#6b7280")
        })

    # Frameworks
    # collect requirements deps flattened
    req_deps = []
    pkg_deps = []
    for d in dependencies:
        if d["ecosystem"] == "python":
            req_deps.extend(d["packages"])
        else:
            pkg_deps.extend(d["packages"])
    frameworks = detect_frameworks(files_text_map, pkg_deps, req_deps)

    # Import/dependency relationships - resolve local modules
    # Determine is_local: if imported path starts with . or matches local file
    local_files_set = {Path(rel).stem for _, rel in all_files}
    # also map rel without ext
    local_modules = set()
    for _, rel in all_files:
        # e.g. app/services/auth_service.py -> app.services.auth_service and auth_service
        p = Path(rel)
        no_ext = str(p.with_suffix("")).replace("/", ".")
        local_modules.add(no_ext)
        local_modules.add(p.stem)
        # also path without ext with slashes
        local_modules.add(str(p.with_suffix("")))
    for imp in imports_all:
        raw = imp.get("raw") or imp.get("imported") or ""
        # normalize
        base = raw.split(".")[0].split("/")[0]
        imp["is_local"] = False
        if raw.startswith("."):
            imp["is_local"] = True
        elif base in local_files_set:
            imp["is_local"] = True
        elif raw in local_modules or raw.replace("/", ".") in local_modules:
            imp["is_local"] = True
        # also check if imported contains app.
        if raw.startswith("app."):
            imp["is_local"] = True

    # Graph
    nodes = []
    edges = []
    # Nodes: files that are py/js
    file_nodes_ids = {}
    for _, rel in all_files:
        ext = Path(rel).suffix.lower()
        if ext in (".py",".js",".jsx",".ts",".tsx"):
            nid = rel
            file_nodes_ids[rel] = nid
            nodes.append({"id": nid, "label": Path(rel).name, "type": "file", "file": rel})
    # API nodes
    for ep in endpoints_all:
        nid = f"api:{ep['method']}:{ep['path']}"
        if not any(n["id"]==nid for n in nodes):
            nodes.append({"id": nid, "label": f"{ep['method']} {ep['path']}", "type": "api", "file": ep["file"]})
        # edge from file to api
        edges.append({"id": f"{ep['file']}->{nid}", "source": ep["file"], "target": nid, "label": ep["method"], "type": "api"})
    # Import edges (only local)
    edge_id_set=set()
    for imp in imports_all:
        if not imp.get("is_local"):
            continue
        src = imp["file"]
        target_raw = imp["imported"]
        # try to resolve target file
        target_file = resolve_import_target(target_raw, all_files, root)
        if target_file and target_file in file_nodes_ids:
            eid = f"{src}->{target_file}"
            if eid not in edge_id_set:
                edges.append({"id": eid, "source": src, "target": target_file, "label": "imports", "type": "import"})
                edge_id_set.add(eid)

    stats = {
        "total_files": len(all_files),
        "total_lines": total_lines,
        "languages": len(languages_counter),
        "endpoints": len(endpoints_all),
        "classes": len(classes_all),
        "functions": len(functions_all),
    }

    analysis = {
        "id": repo_id,
        "file_tree": file_tree,
        "languages": languages,
        "frameworks": frameworks,
        "dependencies": dependencies,
        "endpoints": endpoints_all,
        "classes": classes_all,
        "functions": functions_all,
        "imports": imports_all,
        "graph": {"nodes": nodes, "edges": edges},
        "stats": stats,
        "file_count": len(all_files),
        "total_lines": total_lines,
    }
    return analysis

def resolve_import_target(import_str: str, all_files, root: Path):
    # import_str like app.services.auth_service, ./components/ProductCard, etc.
    # try to find file matching
    candidates = []
    # clean: remove leading . and /
    clean = import_str.strip().lstrip(".").lstrip("/")
    # Replace . with /
    path_candidate = clean.replace(".", "/")
    for p, rel in all_files:
        # check if rel without ext equals path_candidate or ends with it
        rel_no_ext = str(Path(rel).with_suffix(""))
        if rel_no_ext == path_candidate or rel_no_ext.endswith("/" + path_candidate) or Path(rel).stem == Path(path_candidate).name:
            # Prefer exact match
            if rel_no_ext == path_candidate:
                return rel
            candidates.append(rel)
    if candidates:
        # shortest path that matches?
        return sorted(candidates, key=len)[0]
    return None

def build_file_tree(all_files, root: Path):
    # Build nested dict
    tree = {"name": "root", "path": "", "type": "directory", "children": []}
    # Use dict for lookup
    nodes = {"": tree}
    for p, rel in sorted(all_files, key=lambda x: x[1]):
        parts = Path(rel).parts
        for i in range(len(parts)):
            cur_path = "/".join(parts[:i+1])
            parent_path = "/".join(parts[:i]) if i>0 else ""
            if cur_path not in nodes:
                is_file = (i == len(parts)-1)
                name = parts[i]
                full_p = root / cur_path if is_file else None
                size = None
                lines = None
                if is_file:
                    try:
                        size = (root / cur_path).stat().st_size
                        # count lines via map? approximate
                        try:
                            txt = (root / cur_path).read_text(encoding="utf-8", errors="ignore")
                            if "\x00" not in txt[:1000]:
                                lines = txt.count("\n") + (1 if txt.strip() else 0)
                            else:
                                lines = 0
                        except:
                            lines = 0
                    except:
                        size=0
                        lines=0
                    ext = Path(cur_path).suffix.lower()
                    lang = LANGUAGE_MAP.get(ext)
                else:
                    lang = None
                node = {"name": name, "path": cur_path, "type": "file" if is_file else "directory", "children": [] if not is_file else None}
                if is_file:
                    node["size"]=size
                    node["lines"]=lines
                    node["language"]=LANGUAGE_MAP.get(Path(cur_path).suffix.lower(), "Other")
                else:
                    node["children"]=[]
                nodes[cur_path]=node
                # append to parent
                parent = nodes[parent_path]
                if parent["children"] is None:
                    parent["children"]=[]
                parent["children"].append(node)
            # else exists, continue
    # Sort children: directories first, then files alphabetically
    def sort_tree(node):
        if node.get("children"):
            node["children"] = sorted(node["children"], key=lambda x: (0 if x["type"]=="directory" else 1, x["name"].lower()))
            for c in node["children"]:
                sort_tree(c)
    sort_tree(tree)
    # If single top-level dir, return its children as root? Keep root
    # Decide to return root or single dir collapsed
    # For cleaner UI, if root has single directory child, use it
    if len(tree["children"])==1 and tree["children"][0]["type"]=="directory":
        # Keep as is but frontend can handle
        pass
    return tree

def get_analysis(repo_id: str):
    entry = STORE.get(repo_id)
    if not entry:
        return None
    return entry["analysis"]

def get_file_content(repo_id: str, file_path: str):
    entry = STORE.get(repo_id)
    if not entry:
        return None, "Repository not found"
    root = entry["root"]
    # Prevent path traversal: normalize and check within root
    # reject absolute or traversal
    if file_path.startswith("/") or ".." in Path(file_path).parts:
        return None, "Invalid path"
    target = (root / file_path).resolve()
    try:
        target.relative_to(root.resolve())
    except ValueError:
        return None, "Path traversal detected"
    if not target.exists() or not target.is_file():
        return None, "File not found"
    # binary check
    try:
        raw = target.read_bytes()
        if b"\x00" in raw[:1024]:
            return None, "Binary file not displayable"
        if len(raw) > 2*1024*1024:
            return None, "File too large"
        text = raw.decode("utf-8", errors="ignore")
        return text, None
    except Exception as e:
        return None, str(e)
