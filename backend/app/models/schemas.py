from pydantic import BaseModel
from typing import List, Optional, Dict, Any

class FileNode(BaseModel):
    name: str
    path: str
    type: str  # file | directory
    size: Optional[int] = None
    lines: Optional[int] = None
    language: Optional[str] = None
    children: Optional[List["FileNode"]] = None

FileNode.model_rebuild()

class LanguageStat(BaseModel):
    language: str
    files: int
    lines: int
    color: str

class FrameworkInfo(BaseModel):
    name: str
    detected: bool
    evidence: List[str]

class DependencyInfo(BaseModel):
    ecosystem: str  # python | node
    file: str
    packages: List[Dict[str, str]]

class EndpointInfo(BaseModel):
    path: str
    method: str
    file: str
    function: str
    framework: str
    line: int

class ClassInfo(BaseModel):
    name: str
    file: str
    line: int
    methods: List[str]
    bases: List[str]

class FunctionInfo(BaseModel):
    name: str
    file: str
    line: int
    args: List[str]
    is_async: bool

class ImportInfo(BaseModel):
    source: str
    imported: str
    file: str
    line: int
    is_local: bool

class GraphNode(BaseModel):
    id: str
    label: str
    type: str  # file | module | api
    file: Optional[str] = None

class GraphEdge(BaseModel):
    id: str
    source: str
    target: str
    label: Optional[str] = None
    type: str = "import"  # import | api

class AnalysisResult(BaseModel):
    id: str
    file_tree: FileNode
    languages: List[LanguageStat]
    frameworks: List[FrameworkInfo]
    dependencies: List[DependencyInfo]
    endpoints: List[EndpointInfo]
    classes: List[ClassInfo]
    functions: List[FunctionInfo]
    imports: List[ImportInfo]
    graph: Dict[str, List[Any]]  # {nodes, edges}
    stats: Dict[str, Any]
    file_count: int
    total_lines: int

class ChatMessage(BaseModel):
    role: str  # system | user | assistant
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    model: Optional[str] = None  # defaults to openai/gpt-oss-20b
    max_tokens: int = 2048  # reasoning models need headroom: tiny budgets get eaten by the reasoning trace
    temperature: float = 0.7

class ChatResponse(BaseModel):
    content: str
    model: str

class RepoChatRequest(BaseModel):
    messages: List[ChatMessage]
    file_path: Optional[str] = None  # include this repo file's content as context
    include_structure: bool = True  # include repo structure summary as context
    model: Optional[str] = None  # defaults to openai/gpt-oss-20b
    max_tokens: int = 2048  # reasoning models need headroom: tiny budgets get eaten by the reasoning trace
    temperature: float = 0.7
