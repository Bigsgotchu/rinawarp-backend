import asyncio
import os
import json
import logging
import uuid
import base64
from pathlib import Path
from typing import Any, Dict, Optional, List
from fastapi import FastAPI, WebSocket, Depends, HTTPException, status, Header, Request
from fastapi.responses import StreamingResponse, JSONResponse, PlainTextResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import uvicorn
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from prometheus_fastapi_instrumentator import Instrumentator
import httpx
from rina_litellm_config import rina_ollama_stream, rina_ollama_json, vision_chat
from rina_provider_router import get_model
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            
# Logging setup
logger = logging.getLogger("rina")
logging.basicConfig(level=logging.INFO)

# Configuration
ADMIN_API_KEY = os.getenv("ADMIN_API_KEY")
REQUIRE_VALID_LICENSE = os.getenv("REQUIRE_VALID_LICENSE", "false").lower() == "true"
LICENSE_PUBLIC_KEY_PATH = os.getenv("LICENSE_PUBLIC_KEY_PATH")
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()]

# HTTP client for connection pooling
http_client = httpx.AsyncClient(timeout=30.0)

# Authentication functions
async def require_admin(x_rina_key: str = Header(None)):
   if not ADMIN_API_KEY:
       return  # auth disabled if no key configured
   if x_rina_key != ADMIN_API_KEY:
       raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid admin key")

def verify_license(license_token: str) -> bool:
   if not REQUIRE_VALID_LICENSE:
       return True
   if not license_token:
       return False
   try:
       payload = json.loads(base64.b64decode(license_token.split(".")[1] + "=="))
       # TODO: verify signature using LICENSE_PUBLIC_KEY_PATH
       return payload.get("exp", 0) > int(asyncio.get_event_loop().time())
   except Exception:
       return False

async def require_license(x_rina_license: str = Header(None)):
   if REQUIRE_VALID_LICENSE and not verify_license(x_rina_license or ""):
       raise HTTPException(status_code=402, detail="Payment Required / Invalid License")
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            
# Pydantic models
class ChatMessage(BaseModel):
   role: str
   content: Any

class ChatBody(BaseModel):
   provider: str = "local"
   content: Optional[str] = None
   messages: Optional[List[ChatMessage]] = None

class VisionBody(BaseModel):
   image: str
   prompt: str = "What do you see?"
   model: Optional[str] = None
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            
# FastAPI app
app = FastAPI(title="RinaWarp Ollama Bridge")

# Rate limiting
limiter = Limiter(key_func=get_remote_address)

@app.exception_handler(RateLimitExceeded)
def _rate_limit_handler(request, exc):
   return PlainTextResponse("Too Many Requests", status_code=429)

# CORS middleware
app.add_middleware(
   CORSMiddleware,
   allow_origins=CORS_ORIGINS or ["http://localhost:5173"],
   allow_credentials=True,
   allow_methods=["GET", "POST"],
   allow_headers=["Content-Type", "X-RINA-KEY", "X-RINA-LICENSE", "X-Request-ID"],
)
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            
# Prometheus metrics
@app.on_event("startup")
async def _startup():
   Instrumentator().instrument(app).expose(app, include_in_schema=False, endpoint="/metrics")

# Request ID middleware
@app.middleware("http")
async def add_request_id(request: Request, call_next):
   rid = request.headers.get("x-request-id", str(uuid.uuid4()))
   response = await call_next(request)
   response.headers["x-request-id"] = rid
   logger.info({
       "event": "request",
       "rid": rid,
       "path": request.url.path,
       "method": request.method,
       "status_code": response.status_code
   })
   return response

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "rina-ollama-bridge"}

@app.get("/admin/health")
async def admin_health_check(_=Depends(require_admin)):
    return {
        "status": "healthy",
        "service": "rina-ollama-bridge",
        "ollama_status": "running",  # TODO: check actual ollama status
        "version": "1.0.0"
    }

@app.post("/chat")
async def chat_endpoint(payload: Dict[str, Any], x_rina_license: str = Header(None)):
    # Validate request
    if not payload:
        raise HTTPException(status_code=400, detail="Request body required")

    provider = payload.get("provider", "local")
    content = payload.get("content", "")
    messages = payload.get("messages", [{"role": "user", "content": content}])

    if not content and not messages:
        raise HTTPException(status_code=400, detail="Either content or messages required")

    # License check
    if REQUIRE_VALID_LICENSE and not verify_license(x_rina_license or ""):
        raise HTTPException(status_code=402, detail="Payment Required / Invalid License")

    model = get_model(provider)
    response = await asyncio.get_event_loop().run_in_executor(
        None, lambda: asyncio.run(rina_ollama_json(content, model))
    )

    # Convert ModelResponse to dict for JSON serialization
    return JSONResponse({
        "id": response.id,
        "object": "chat.completion",
        "created": response.created,
        "model": response.model,
        "choices": [{
            "index": choice.index,
            "message": {
                "role": choice.message.role,
                "content": choice.message.content
            },
            "finish_reason": choice.finish_reason
        } for choice in response.choices],
        "usage": {
            "prompt_tokens": response.usage.prompt_tokens,
            "completion_tokens": response.usage.completion_tokens,
            "total_tokens": response.usage.total_tokens
        }
    })

@app.get("/sse")
async def sse_endpoint(content: str, provider: str = "local", x_rina_license: str = Header(None)):
    # Validate request
    if not content:
        raise HTTPException(status_code=400, detail="Content parameter required")

    # License check
    if REQUIRE_VALID_LICENSE and not verify_license(x_rina_license or ""):
        raise HTTPException(status_code=402, detail="Payment Required / Invalid License")

    model = get_model(provider)

    async def generate():
        async for token in rina_ollama_stream(content, model):
            yield f"data: {token}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )

@app.websocket("/ws/ai")
async def websocket_endpoint(websocket: WebSocket, x_rina_license: str = Header(None)):
    await websocket.accept()

    try:
        while True:
            data = await websocket.receive_text()
            payload = json.loads(data)

            # Validate request
            content = payload.get("content", "")
            if not content:
                await websocket.send_text(json.dumps({"error": "Content required"}))
                continue

            # License check
            if REQUIRE_VALID_LICENSE and not verify_license(x_rina_license or ""):
                await websocket.send_text(json.dumps({"error": "Payment Required / Invalid License"}))
                continue

            provider = payload.get("provider", "local")
            model = get_model(provider)

            async for token in rina_ollama_stream(content, model):
                await websocket.send_text(token)

    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        await websocket.send_text(json.dumps({"error": "Internal server error"}))

@app.post("/vision")
async def vision_endpoint(payload: Dict[str, Any], x_rina_license: str = Header(None)):
    # Validate request
    image = payload.get("image")
    if not image:
        raise HTTPException(status_code=400, detail="Image data required")

    prompt = payload.get("prompt", "What do you see?")
    provider = payload.get("provider", "local")

    # License check
    if REQUIRE_VALID_LICENSE and not verify_license(x_rina_license or ""):
        raise HTTPException(status_code=402, detail="Payment Required / Invalid License")

    model = get_model(provider).replace("llama", "llava")  # Use vision model

    result = await vision_chat(image, prompt, model)

    # Convert ModelResponse to dict for JSON serialization
    return JSONResponse({
        "id": result.id,
        "object": "chat.completion",
        "created": result.created,
        "model": result.model,
        "choices": [{
            "index": choice.index,
            "message": {
                "role": choice.message.role,
                "content": choice.message.content
            },
            "finish_reason": choice.finish_reason
        } for choice in result.choices],
        "usage": {
            "prompt_tokens": result.usage.prompt_tokens,
            "completion_tokens": result.usage.completion_tokens,
            "total_tokens": result.usage.total_tokens
        }
    })

if __name__ == "__main__":
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "7071"))
    uvicorn.run(app, host=host, port=port)