"""Schemas for agent / workflow / guardrail CRUD.

Each row stores the full SPA-shaped payload in a JSONB `data` column plus a
minimal set of indexed columns for queries (owner, updated_at). This matches
the localStorage shapes in the SPA so migration is a 1:1 copy.
"""
from __future__ import annotations

from sqlalchemy import Column, DateTime, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


class Agent(Base):
    __tablename__ = "agents"
    id = Column(String(64), primary_key=True)
    owner = Column(String(64), nullable=False, default="system", index=True)
    data = Column(JSONB, nullable=False)
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class Workflow(Base):
    __tablename__ = "workflows"
    id = Column(String(64), primary_key=True)
    owner = Column(String(64), nullable=False, default="system", index=True)
    data = Column(JSONB, nullable=False)
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class Guardrail(Base):
    __tablename__ = "guardrails"
    id = Column(String(64), primary_key=True)
    owner = Column(String(64), nullable=False, default="system", index=True)
    data = Column(JSONB, nullable=False)
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class Tool(Base):
    __tablename__ = "tools"
    id = Column(String(64), primary_key=True)
    owner = Column(String(64), nullable=False, default="system", index=True)
    data = Column(JSONB, nullable=False)
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class Pipeline(Base):
    """Linear / graph pipeline definitions (distinct from canvas `workflows`)."""
    __tablename__ = "pipelines"
    id = Column(String(64), primary_key=True)
    owner = Column(String(64), nullable=False, default="system", index=True)
    data = Column(JSONB, nullable=False)
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class WorkspacePolicy(Base):
    """Built-in toggles: PII, secrets, toxicity, URL allowlist."""
    __tablename__ = "workspace_policies"
    id = Column(String(64), primary_key=True)
    owner = Column(String(64), nullable=False, default="system", index=True)
    data = Column(JSONB, nullable=False)
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
