"""execution-service: LangGraph runner + LiteLLM + Langfuse tracing.

The full LangGraph wiring lives further down in the rollout. Right now this
service ships:
  - /healthz so compose comes up green
  - /execute  minimal pass-through that calls LiteLLM /v1/chat/completions
    and emits a Langfuse trace with the (user, agent_id, workflow_id)
    metadata that worker-service's rollup job looks for.
"""
from __future__ import annotations

from typing import Any

import httpx
from fastapi import FastAPI, HTTPException
from langfuse import Langfuse
from pydantic import BaseModel, Field

from eai_common.settings import Settings

settings = Settings(service_name="execution-service")  # type: ignore[call-arg]
app = FastAPI(title=settings.service_name, version="0.1.0")

_langfuse: Langfuse | None = None
if settings.langfuse_public_key and settings.langfuse_secret_key:
    _langfuse = Langfuse(
        public_key=settings.langfuse_public_key,
        secret_key=settings.langfuse_secret_key,
        host=settings.langfuse_host,
    )


class ExecuteRequest(BaseModel):
    user: str = Field(description="Caller's username (from JWT sub)")
    agent_id: str = ""
    workflow_id: str = ""
    workspace_id: str = ""
    model: str
    messages: list[dict[str, Any]]


class ExecuteResponse(BaseModel):
    content: str
    trace_id: str | None = None
    raw: dict[str, Any]


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok", "service": settings.service_name}


@app.post("/execute", response_model=ExecuteResponse)
async def execute(body: ExecuteRequest) -> ExecuteResponse:
    trace = None
    trace_id: str | None = None
    if _langfuse is not None:
        trace = _langfuse.trace(
            name=f"exec:{body.workflow_id or body.agent_id or 'chat'}",
            user_id=body.user,
            metadata={
                "user": body.user,
                "agent_id": body.agent_id,
                "workflow_id": body.workflow_id,
                "workspace_id": body.workspace_id,
            },
        )
        trace_id = trace.id
        trace.update(input={"messages": body.messages, "model": body.model})

    headers = {
        "Authorization": f"Bearer {settings.litellm_master_key}",
        "Content-Type": "application/json",
    }
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            f"{settings.litellm_base_url.rstrip('/')}/v1/chat/completions",
            headers=headers,
            json={"model": body.model, "messages": body.messages},
        )
    if resp.status_code >= 400:
        if trace is not None:
            trace.update(output={"error": resp.text}, level="ERROR")
        raise HTTPException(resp.status_code, resp.text)

    payload = resp.json()
    content = ""
    try:
        content = payload["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError):
        content = ""

    if trace is not None:
        trace.update(output={"content": content})
        _langfuse.flush()  # type: ignore[union-attr]

    return ExecuteResponse(content=content, trace_id=trace_id, raw=payload)
