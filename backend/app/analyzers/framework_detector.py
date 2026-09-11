from pathlib import Path
import re

PATTERNS = {
    "FastAPI": [r"from fastapi", r"import fastapi", r"FastAPI\("],
    "Flask": [r"from flask", r"import Flask"],
    "Django": [r"from django", r"import django", r"manage\.py"],
    "Express": [r"from 'express'", r'require\(.*express', r"express\(\)"],
    "React": [r"from 'react'", r"from \"react\"", r"React\."],
    "Vue": [r"from 'vue'", r"import Vue"],
    "Next.js": [r"next/", r"from 'next"],
    "SQLAlchemy": [r"from sqlalchemy", r"import sqlalchemy"],
    "Vite": [r"vite\.config"],
}

def detect_frameworks(files_text_map: dict, package_json_deps: list, requirements: list) -> list:
    results=[]
    combined = "\n".join(files_text_map.values())[:200000]  # limit
    dep_names = {d["name"].lower() for d in package_json_deps + requirements}
    # also need to check filenames
    filenames = list(files_text_map.keys())
    for fw, patterns in PATTERNS.items():
        evidence=[]
        for pat in patterns:
            if re.search(pat, combined):
                evidence.append(pat)
        # check dep name
        fw_lower=fw.lower()
        # mapping
        dep_map={"fastapi":"fastapi","flask":"flask","django":"django","express":"express","react":"react","vue":"vue","next.js":"next","sqlalchemy":"sqlalchemy","vite":"vite"}
        dep_key=dep_map.get(fw_lower, fw_lower)
        if dep_key in dep_names:
            evidence.append(f"dependency:{dep_key}")
        # filename check
        for fn in filenames:
            if "vite.config" in fn and fw=="Vite":
                evidence.append(fn)
        detected = len(evidence)>0
        results.append({"name": fw, "detected": detected, "evidence": evidence})
    # only return detected? spec says return all? we return all but frontend will filter
    return results
