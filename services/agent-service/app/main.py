"""agent-service: CRUD for agents, workflows, guardrails, tools, pipelines, policies.

The SPA uses api-service `/api/v1/*` proxies. Payloads stay SPA-shaped in JSONB.
"""
from __future__ import annotations

import time
from typing import Any, Iterable

from fastapi import Depends, FastAPI, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from eai_common.auth import TokenClaims, claims_from_request
from eai_common.db import make_engine, make_session_factory
from eai_common.settings import Settings

from .models import Agent, Base, Guardrail, Pipeline, Tool, Workflow, WorkspacePolicy

settings = Settings(service_name="agent-service")  # type: ignore[call-arg]
engine = make_engine(settings)
SessionFactory = make_session_factory(settings)

app = FastAPI(title=settings.service_name, version="0.1.0")

_AGENT_SEEDS: list[dict[str, Any]] = [
    {
        "id": "ag-gpt",
        "name": "General Assistant",
        "model": "gpt-4o-mini",
        "systemPrompt": "You are a helpful assistant for the enterprise workspace.",
        "contextVariableNames": [],
        "toolIds": [],
        "status": "active",
        "createdBy": "system",
        "createdAt": 1,
        "updatedAt": 1,
    },
    {
        "id": "ag-doc",
        "name": "Document RAG",
        "model": "gpt-4o-mini",
        "systemPrompt": "You answer using retrieved context when provided.",
        "contextVariableNames": ["rag_context", "user_query"],
        "toolIds": [],
        "status": "active",
        "createdBy": "system",
        "createdAt": 1,
        "updatedAt": 1,
    },
    {
        "id": "ag-guard",
        "name": "Policy Sentinel",
        "model": "gpt-4o-mini",
        "systemPrompt": "You validate outputs against policy snippets.",
        "contextVariableNames": [],
        "toolIds": [],
        "status": "paused",
        "createdBy": "system",
        "createdAt": 1,
        "updatedAt": 1,
    },
]

_WORKSPACE_POLICY_SEEDS: list[dict[str, Any]] = [
    {
        "id": "pii",
        "name": "Block PII export",
        "description": "Prevent obvious SSN, card numbers, and national IDs in outputs.",
        "enabled": True,
    },
    {
        "id": "secrets",
        "name": "No secrets in responses",
        "description": "Strip API keys and PEM blocks from assistant text.",
        "enabled": True,
    },
    {
        "id": "toxicity",
        "name": "Toxicity filter (input)",
        "description": "Reject abusive user turns before they reach the model.",
        "enabled": True,
    },
    {
        "id": "urls",
        "name": "Allowlist outbound URLs",
        "description": "Only link to approved corporate domains in answers.",
        "enabled": False,
    },
]


def _seed_initial_data(db: Session) -> None:
    if db.scalar(select(func.count()).select_from(Agent)) == 0:
        for row in _AGENT_SEEDS:
            db.add(Agent(id=row["id"], owner="system", data=dict(row)))
    if db.scalar(select(func.count()).select_from(WorkspacePolicy)) == 0:
        for row in _WORKSPACE_POLICY_SEEDS:
            db.add(WorkspacePolicy(id=row["id"], owner="system", data=dict(row)))
    db.commit()


@app.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(engine)
    db = SessionFactory()
    try:
        _seed_initial_data(db)
    finally:
        db.close()


def get_db() -> Iterable[Session]:
    db = SessionFactory()
    try:
        yield db
    finally:
        db.close()


def get_claims(request: Request) -> TokenClaims:
    return claims_from_request(settings, request)


def _is_admin(claims: TokenClaims) -> bool:
    return "admin" in claims.roles or "platform-admin" in claims.roles


class Payload(BaseModel):
    id: str
    data: dict[str, Any]


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok", "service": settings.service_name}


# ---------------------------------------------------------------------------
# Generic CRUD — JSONB entity tables share the same shape.
# ---------------------------------------------------------------------------

EntityModel = (
    type[Agent]
    | type[Workflow]
    | type[Guardrail]
    | type[Tool]
    | type[Pipeline]
    | type[WorkspacePolicy]
)


def _list(model: EntityModel, db: Session) -> list[dict[str, Any]]:
    rows = db.scalars(select(model).order_by(model.updated_at.desc())).all()
    return [r.data for r in rows]


def _upsert(
    model: EntityModel, db: Session, body: Payload, claims: TokenClaims
) -> dict[str, Any]:
    row = db.scalar(select(model).where(model.id == body.id))
    now_ms = int(time.time() * 1000)
    payload = {**body.data, "id": body.id, "updatedAt": now_ms}
    if row is None:
        db.add(model(id=body.id, owner=claims.sub, data=payload))
    else:
        if not _is_admin(claims) and row.owner != claims.sub and row.owner != "system":
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Not owner")
        row.data = payload
    db.commit()
    return payload


def _delete(model: EntityModel, db: Session, item_id: str, claims: TokenClaims) -> None:
    row = db.scalar(select(model).where(model.id == item_id))
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    if row.owner == "system":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "System records cannot be deleted")
    if not _is_admin(claims) and row.owner != claims.sub:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not owner")
    db.delete(row)
    db.commit()


# ---------------------------------------------------------------------------
# Agents
# ---------------------------------------------------------------------------


@app.get("/agents")
def list_agents(_: TokenClaims = Depends(get_claims), db: Session = Depends(get_db)):
    return _list(Agent, db)


@app.put("/agents")
def upsert_agent(
    body: Payload, claims: TokenClaims = Depends(get_claims), db: Session = Depends(get_db)
):
    return _upsert(Agent, db, body, claims)


@app.delete("/agents/{agent_id}")
def delete_agent(
    agent_id: str, claims: TokenClaims = Depends(get_claims), db: Session = Depends(get_db)
):
    _delete(Agent, db, agent_id, claims)
    return {"deleted": agent_id}


# ---------------------------------------------------------------------------
# Workflows (canvas definitions)
# ---------------------------------------------------------------------------


@app.get("/workflows")
def list_workflows(_: TokenClaims = Depends(get_claims), db: Session = Depends(get_db)):
    return _list(Workflow, db)


@app.put("/workflows")
def upsert_workflow(
    body: Payload, claims: TokenClaims = Depends(get_claims), db: Session = Depends(get_db)
):
    return _upsert(Workflow, db, body, claims)


@app.delete("/workflows/{workflow_id}")
def delete_workflow(
    workflow_id: str, claims: TokenClaims = Depends(get_claims), db: Session = Depends(get_db)
):
    _delete(Workflow, db, workflow_id, claims)
    return {"deleted": workflow_id}


# ---------------------------------------------------------------------------
# Guardrails (NeMo / card-rail configs)
# ---------------------------------------------------------------------------


@app.get("/guardrails")
def list_guardrails(_: TokenClaims = Depends(get_claims), db: Session = Depends(get_db)):
    return _list(Guardrail, db)


@app.put("/guardrails")
def upsert_guardrail(
    body: Payload, claims: TokenClaims = Depends(get_claims), db: Session = Depends(get_db)
):
    return _upsert(Guardrail, db, body, claims)


@app.delete("/guardrails/{guardrail_id}")
def delete_guardrail(
    guardrail_id: str, claims: TokenClaims = Depends(get_claims), db: Session = Depends(get_db)
):
    _delete(Guardrail, db, guardrail_id, claims)
    return {"deleted": guardrail_id}


# ---------------------------------------------------------------------------
# Tools (MCP)
# ---------------------------------------------------------------------------


@app.get("/tools")
def list_tools(_: TokenClaims = Depends(get_claims), db: Session = Depends(get_db)):
    return _list(Tool, db)


@app.put("/tools")
def upsert_tool(
    body: Payload, claims: TokenClaims = Depends(get_claims), db: Session = Depends(get_db)
):
    return _upsert(Tool, db, body, claims)


@app.delete("/tools/{tool_id}")
def delete_tool(
    tool_id: str, claims: TokenClaims = Depends(get_claims), db: Session = Depends(get_db)
):
    _delete(Tool, db, tool_id, claims)
    return {"deleted": tool_id}


# ---------------------------------------------------------------------------
# Pipelines (workflow graph / multi-step definitions)
# ---------------------------------------------------------------------------


@app.get("/pipelines")
def list_pipelines(_: TokenClaims = Depends(get_claims), db: Session = Depends(get_db)):
    return _list(Pipeline, db)


@app.put("/pipelines")
def upsert_pipeline(
    body: Payload, claims: TokenClaims = Depends(get_claims), db: Session = Depends(get_db)
):
    return _upsert(Pipeline, db, body, claims)


@app.delete("/pipelines/{pipeline_id}")
def delete_pipeline(
    pipeline_id: str, claims: TokenClaims = Depends(get_claims), db: Session = Depends(get_db)
):
    _delete(Pipeline, db, pipeline_id, claims)
    return {"deleted": pipeline_id}


# ---------------------------------------------------------------------------
# Workspace policies (built-in toggles)
# ---------------------------------------------------------------------------


@app.get("/workspace-policies")
def list_workspace_policies(_: TokenClaims = Depends(get_claims), db: Session = Depends(get_db)):
    rows = db.scalars(select(WorkspacePolicy).order_by(WorkspacePolicy.id.asc())).all()
    return [r.data for r in rows]


@app.put("/workspace-policies")
def upsert_workspace_policy(
    body: Payload, claims: TokenClaims = Depends(get_claims), db: Session = Depends(get_db)
):
    return _upsert(WorkspacePolicy, db, body, claims)


@app.delete("/workspace-policies/{policy_id}")
def delete_workspace_policy(
    policy_id: str, claims: TokenClaims = Depends(get_claims), db: Session = Depends(get_db)
):
    _delete(WorkspacePolicy, db, policy_id, claims)
    return {"deleted": policy_id}
