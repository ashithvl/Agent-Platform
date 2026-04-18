import uuid
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class Workspace(Base):
    __tablename__ = "workspaces"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class WorkspaceMember(Base):
    __tablename__ = "workspace_members"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("workspaces.id"))
    user_sub: Mapped[str] = mapped_column(String(255), index=True)
    role: Mapped[str] = mapped_column(String(64), default="member")


class Agent(Base):
    __tablename__ = "agents"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("workspaces.id"))
    slug: Mapped[str] = mapped_column(String(128))
    name: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    versions: Mapped[list["AgentVersion"]] = relationship(back_populates="agent")


class AgentVersion(Base):
    __tablename__ = "agent_versions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("agents.id"))
    version_number: Mapped[int] = mapped_column(Integer)
    config: Mapped[dict[str, Any]] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    agent: Mapped["Agent"] = relationship(back_populates="versions")


class AgentPublished(Base):
    __tablename__ = "agent_published"

    agent_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("agents.id"), primary_key=True)
    env: Mapped[str] = mapped_column(String(32), primary_key=True)
    version_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("agent_versions.id"))
    published_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    published_by: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)


class IngestJob(Base):
    __tablename__ = "ingest_jobs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("workspaces.id"))
    collection_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    minio_key: Mapped[str] = mapped_column(String(512))
    status: Mapped[str] = mapped_column(String(32), default="pending")
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_type: Mapped[str] = mapped_column(String(128))
    actor_sub: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    payload: Mapped[Optional[dict[str, Any]]] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
