import logging
import uuid
from typing import Any

import httpx
from fastapi import Depends, FastAPI
from pydantic import BaseModel, Field

from app.config import settings
from app.deps import verify_internal_token
from app.guardrails import validate_output
from app.langfuse_emit import emit_trace_async

logger = logging.getLogger(__name__)
app = FastAPI(title="Execution Service", version="0.1.0")


class ChatRequest(BaseModel):
    agent_id: str = Field(..., description="Agent UUID string")
    env: str = "dev"
    message: str
    user_sub: str | None = None


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/internal/v1/chat", dependencies=[Depends(verify_internal_token)])
async def chat(body: ChatRequest) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=60.0) as client:
        r = await client.get(
            f"{settings.agent_service_url}/internal/v1/agents/{body.agent_id}/runtime-config",
            headers={"X-Internal-Token": settings.internal_service_token},
            params={"env": body.env},
        )
        r.raise_for_status()
        runtime = r.json()

    cfg = runtime.get("config") or {}
    system_prompt = cfg.get("system_prompt") or "You are a helpful assistant."
    model = cfg.get("model") or "gpt-4o-mini"
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": body.message},
    ]

    # LangGraph-style stub: single LLM node (extend with state graph later).
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            lr = await client.post(
                f"{settings.litellm_url.rstrip('/')}/v1/chat/completions",
                headers={"Authorization": f"Bearer {settings.litellm_api_key}"},
                json={"model": model, "messages": messages},
            )
            if lr.status_code >= 400:
                err = lr.text
                logger.error("litellm error %s: %s", lr.status_code, err)
                return {
                    "run_id": str(uuid.uuid4()),
                    "error": "litellm_request_failed",
                    "detail": err[:2000],
                    "model": model,
                }
            data = lr.json()
    except Exception as e:  # noqa: BLE001
        logger.exception("litellm call failed")
        return {"run_id": str(uuid.uuid4()), "error": "litellm_unreachable", "detail": str(e)}

    try:
        choice = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError):
        choice = str(data)

    out = validate_output(choice)
    run_id = str(uuid.uuid4())

    emit_trace_async(
        name="chat",
        user_sub=body.user_sub,
        agent_id=body.agent_id,
        input_text=body.message,
        output_text=out,
        metadata={"env": body.env, "model": model, "run_id": run_id},
    )

    return {"run_id": run_id, "reply": out, "model": model}
