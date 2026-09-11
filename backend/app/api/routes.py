from fastapi import APIRouter, UploadFile, File, HTTPException, Query
from fastapi.responses import JSONResponse
try:
    from app.services.analyzer_service import analyze_repository, get_analysis, get_file_content
    from app.services import llm_service
    from app.models.schemas import ChatRequest, ChatResponse, RepoChatRequest
except ImportError:
    from backend.app.services.analyzer_service import analyze_repository, get_analysis, get_file_content
    from backend.app.services import llm_service
    from backend.app.models.schemas import ChatRequest, ChatResponse, RepoChatRequest

router = APIRouter()

@router.post("/analyze")
async def analyze(file: UploadFile = File(...)):
    if not file.filename or not file.filename.endswith(".zip"):
        raise HTTPException(status_code=400, detail="Please upload a .zip file")
    data = await file.read()
    if len(data) == 0:
        raise HTTPException(status_code=400, detail="Empty file")
    if len(data) > 50 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 50MB)")
    # Validate zip
    import io, zipfile
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            if len(z.infolist()) == 0:
                raise HTTPException(status_code=400, detail="Empty zip")
    except zipfile.BadZipFile:
        raise HTTPException(status_code=400, detail="Invalid zip file")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid zip: {e}")
    repo_id, analysis = analyze_repository(data, file.filename)
    return analysis

@router.get("/repository/{repo_id}/analysis")
async def get_repo_analysis(repo_id: str):
    analysis = get_analysis(repo_id)
    if not analysis:
        raise HTTPException(status_code=404, detail="Repository not found")
    return analysis

@router.get("/repository/{repo_id}/file")
async def get_repo_file(repo_id: str, path: str = Query(..., description="relative file path")):
    content, err = get_file_content(repo_id, path)
    if err:
        # Distinguish not found vs traversal
        if "traversal" in err.lower() or "invalid path" in err.lower():
            raise HTTPException(status_code=400, detail=err)
        if "not found" in err.lower():
            raise HTTPException(status_code=404, detail=err)
        raise HTTPException(status_code=400, detail=err)
    return {"path": path, "content": content}

@router.get("/llm/status")
async def llm_status():
    return {"configured": llm_service.is_configured(), "default_model": llm_service.DEFAULT_MODEL}

@router.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    _validate_chat_messages(req.messages)
    model = req.model or llm_service.DEFAULT_MODEL
    try:
        content = llm_service.chat(
            [m.model_dump() for m in req.messages],
            model=model,
            max_tokens=req.max_tokens,
            temperature=req.temperature,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM request failed: {e}")
    return ChatResponse(content=content, model=model)

@router.post("/repository/{repo_id}/chat", response_model=ChatResponse)
async def repo_chat(repo_id: str, req: RepoChatRequest):
    """Chat about a specific analyzed codebase: the model gets a structure
    summary (files, languages, frameworks, endpoints, classes/functions) plus
    optionally the content of one selected file."""
    _validate_chat_messages(req.messages)
    analysis = get_analysis(repo_id)
    if not analysis:
        raise HTTPException(status_code=404, detail="Repository not found")
    file_content = None
    if req.file_path:
        file_content, err = get_file_content(repo_id, req.file_path)
        if err:
            if "traversal" in err.lower() or "invalid path" in err.lower():
                raise HTTPException(status_code=400, detail=err)
            raise HTTPException(status_code=404, detail=err)
    model = req.model or llm_service.DEFAULT_MODEL
    context = llm_service.build_repo_context(
        analysis,
        file_path=req.file_path if file_content is not None else None,
        file_content=file_content,
    ) if req.include_structure or file_content is not None else ""
    messages = ([{"role": "system", "content": context}] if context else []) + [m.model_dump() for m in req.messages]
    try:
        content = llm_service.chat(
            messages,
            model=model,
            max_tokens=req.max_tokens,
            temperature=req.temperature,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM request failed: {e}")
    return ChatResponse(content=content, model=model)

def _validate_chat_messages(messages):
    if not messages:
        raise HTTPException(status_code=400, detail="messages must not be empty")
    for m in messages:
        if m.role not in ("system", "user", "assistant"):
            raise HTTPException(status_code=400, detail=f"Invalid role: {m.role}")
