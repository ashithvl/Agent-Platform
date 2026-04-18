"""agent-service: CRUD for agents, workflows, guardrails.

The SPA's Phase-5 adapters (`VITE_STORAGE_AGENTS=1`, etc.) swap from
localStorage to these endpoints. Payloads are kept SPA-shaped in JSONB so
the migration is a copy, not a re-model.
"""
from __future__ import annotations

import time
from typing import Any, Iterable

from fastapi import Depends, FastAPI, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from eai_common.auth import TokenClaims, claims_from_request
from eai_common.db import make_engine, make_session_factory
from eai_common.settings import Settings

from .models import Agent, Base, Guardrail, Workflow

settings = Settings(service_name="agent-service")  # type: ignore[call-arg]
engine = make_engine(settings)
SessionFactory = make_session_factory(settings)

app = FastAPI(title=settings.service_name, version="0.1.0")


@app.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(engine)


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
# Generic CRUD factory - three tables share the same shape.
# ---------------------------------------------------------------------------

Model = type[Agent] | type[Workflow] | type[Guardrail]


def _list(model: Model, db: Session) -> list[dict[str, Any]]:
    rows = db.scalars(select(model).order_by(model.updated_at.desc())).all()
    return [r.data for r in rows]


def _upsert(
    model: Model, db: Session, body: Payload, claims: TokenClaims
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


def _delete(model: Model, db: Session, item_id: str, claims: TokenClaims) -> None:
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
# Workflows
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
# Guardrails
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
