import json
import re
from pathlib import Path

def parse_requirements(path: Path):
    deps = []
    try:
        for line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
            line=line.strip()
            if not line or line.startswith("#"):
                continue
            # handle extras
            m=re.match(r"([a-zA-Z0-9_\-\[\]]+)(.*)",line)
            if m:
                name=m.group(1)
                ver=m.group(2).strip()
                deps.append({"name": name, "version": ver})
    except Exception:
        pass
    return deps

def parse_pyproject(path: Path):
    deps=[]
    try:
        text=path.read_text(encoding="utf-8", errors="ignore")
        # lightweight toml parse for dependencies
        # try tomllib if available
        try:
            import tomllib
            data=tomllib.loads(text)
            # poetry or pep621
            if "tool" in data and "poetry" in data["tool"] and "dependencies" in data["tool"]["poetry"]:
                for k,v in data["tool"]["poetry"]["dependencies"].items():
                    if k=="python": continue
                    deps.append({"name":k,"version":str(v)})
            if "project" in data and "dependencies" in data["project"]:
                for dep in data["project"]["dependencies"]:
                    m=re.match(r"([a-zA-Z0-9_\-]+)",dep)
                    if m:
                        deps.append({"name":m.group(1),"version":dep})
        except Exception:
            # fallback regex
            for m in re.finditer(r'"([a-zA-Z0-9_\-]+)"\s*=\s*"([^"]+)"', text):
                deps.append({"name": m.group(1), "version": m.group(2)})
    except Exception:
        pass
    return deps

def parse_package_json(path: Path):
    deps=[]
    try:
        data=json.loads(path.read_text(encoding="utf-8", errors="ignore"))
        for key in ("dependencies","devDependencies","peerDependencies"):
            if key in data:
                for k,v in data[key].items():
                    deps.append({"name":k,"version":v})
    except Exception:
        pass
    return deps
