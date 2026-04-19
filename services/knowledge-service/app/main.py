"""knowledge-service: CRUD for knowledge hubs and RAG profiles.

LanceDB retrieval lives behind `/hubs/{id}/search` in a later PR; right now
this service only persists the hub + profile metadata the SPA already tracks
in localStorage.
"""
from __future__ import annotations

import time
from typing import Any, Iterable

from fastapi import Depends, FastAPI, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import Column, DateTime, String, func, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Session

from eai_common.auth import TokenClaims, claims_from_request
from eai_common.db import make_engine, make_session_factory
from eai_common.settings import Settings


class Base(DeclarativeBase):
    pass


class KnowledgeHub(Base):
    __tablename__ = "knowledge_hubs"
    id = Column(String(64), primary_key=True)
    owner = Column(String(64), nullable=False, default="system", index=True)
    data = Column(JSONB, nullable=False)
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class RagProfile(Base):
    __tablename__ = "rag_profiles"
    id = Column(String(64), primary_key=True)
    owner = Column(String(64), nullable=False, default="system", index=True)
    data = Column(JSONB, nullable=False)
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


settings = Settings(service_name="knowledge-service")  # type: ignore[call-arg]
engine = make_engine(settings)
SessionFactory = make_session_factory(settings)

app = FastAPI(title=settings.service_name, version="0.1.0")


def _seed_hubs(db: Session) -> None:
    if db.scalar(select(func.count()).select_from(KnowledgeHub)) != 0:
        return
    now = int(time.time() * 1000)
    seeds = [
        {
            "id": "kh_seed_platform",
            "title": "Platform runbooks",
            "description": "Shared operational context for builders.",
            "ownerUsername": "admin",
            "audiences": ["developer", "admin"],
            "complianceNotes": ["Incident template v1", "SLO definitions", "Rollback checklist"],
            "createdAt": now,
            "updatedAt": now,
            "sources": [],
            "ocrEnabled": False,
            "extractionLibrary": "auto",
            "indexingMode": "chunked_semantic",
            "metadataRequired": False,
            "metadataPairs": [{"key": "domain", "value": "platform"}],
        },
        {
            "id": "kh_seed_user",
            "title": "End-user help center",
            "description": "Customer-facing snippets and safe answers.",
            "ownerUsername": "admin",
            "audiences": ["end_user"],
            "complianceNotes": ["Brand voice 2025", "Refund policy summary"],
            "createdAt": now,
            "updatedAt": now,
            "sources": [],
            "ocrEnabled": False,
            "extractionLibrary": "plain_text",
            "indexingMode": "chunked_semantic",
            "metadataRequired": False,
            "metadataPairs": [{"key": "domain", "value": "support"}],
        },
    ]
    for row in seeds:
        db.add(KnowledgeHub(id=row["id"], owner="system", data=dict(row)))
    db.commit()


@app.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(engine)
    db = SessionFactory()
    try:
        _seed_hubs(db)
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


def _list(model, db: Session) -> list[dict[str, Any]]:
    rows = db.scalars(select(model).order_by(model.updated_at.desc())).all()
    return [r.data for r in rows]


def _upsert(model, db: Session, body: Payload, claims: TokenClaims) -> dict[str, Any]:
    row = db.scalar(select(model).where(model.id == body.id))
    payload = {**body.data, "id": body.id, "updatedAt": int(time.time() * 1000)}
    if row is None:
        db.add(model(id=body.id, owner=claims.sub, data=payload))
    else:
        if not _is_admin(claims) and row.owner != claims.sub and row.owner != "system":
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Not owner")
        row.data = payload
    db.commit()
    return payload


def _delete(model, db: Session, item_id: str, claims: TokenClaims) -> None:
    row = db.scalar(select(model).where(model.id == item_id))
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    if row.owner == "system":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "System records cannot be deleted")
    if not _is_admin(claims) and row.owner != claims.sub:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not owner")
    db.delete(row)
    db.commit()


@app.get("/hubs")
def list_hubs(_: TokenClaims = Depends(get_claims), db: Session = Depends(get_db)):
    return _list(KnowledgeHub, db)


@app.put("/hubs")
def upsert_hub(
    body: Payload, claims: TokenClaims = Depends(get_claims), db: Session = Depends(get_db)
):
    return _upsert(KnowledgeHub, db, body, claims)


@app.delete("/hubs/{hub_id}")
def delete_hub(hub_id: str, claims: TokenClaims = Depends(get_claims), db: Session = Depends(get_db)):
    _delete(KnowledgeHub, db, hub_id, claims)
    return {"deleted": hub_id}


@app.get("/rag-profiles")
def list_profiles(_: TokenClaims = Depends(get_claims), db: Session = Depends(get_db)):
    return _list(RagProfile, db)


@app.put("/rag-profiles")
def upsert_profile(
    body: Payload, claims: TokenClaims = Depends(get_claims), db: Session = Depends(get_db)
):
    return _upsert(RagProfile, db, body, claims)


@app.delete("/rag-profiles/{profile_id}")
def delete_profile(
    profile_id: str, claims: TokenClaims = Depends(get_claims), db: Session = Depends(get_db)
):
    _delete(RagProfile, db, profile_id, claims)
    return {"deleted": profile_id}
