"""Postgres tables owned by api-service.

Only the rollup tables live here. Agent/workflow tables belong to
agent-service; user tables to auth-service.
"""
from __future__ import annotations

from sqlalchemy import (
    Column,
    Date,
    DateTime,
    Integer,
    Numeric,
    PrimaryKeyConstraint,
    String,
    func,
)
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


class UsageDaily(Base):
    """Cost + request rollups populated by worker-service's Langfuse sync job.

    Composite primary key by (date, user, agent, workflow) so we can MERGE on
    re-runs without duplicates. `workflow_id` / `agent_id` are nullable because
    a raw chat call may have neither.
    """

    __tablename__ = "usage_daily"

    date = Column(Date, nullable=False)
    user_id = Column(String(64), nullable=False, default="")
    agent_id = Column(String(64), nullable=False, default="")
    workflow_id = Column(String(64), nullable=False, default="")
    requests = Column(Integer, nullable=False, default=0)
    input_tokens = Column(Integer, nullable=False, default=0)
    output_tokens = Column(Integer, nullable=False, default=0)
    cost_usd = Column(Numeric(12, 4), nullable=False, default=0)
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (PrimaryKeyConstraint("date", "user_id", "agent_id", "workflow_id"),)


class TracesIndex(Base):
    """Flat projection of recent Langfuse traces so we can list/filter fast."""

    __tablename__ = "traces_index"

    trace_id = Column(String(64), primary_key=True)
    user_id = Column(String(64), nullable=False, default="")
    agent_id = Column(String(64), nullable=False, default="")
    workflow_id = Column(String(64), nullable=False, default="")
    name = Column(String(255), nullable=False, default="")
    input_tokens = Column(Integer, nullable=False, default=0)
    output_tokens = Column(Integer, nullable=False, default=0)
    cost_usd = Column(Numeric(12, 4), nullable=False, default=0)
    latency_ms = Column(Integer, nullable=False, default=0)
    started_at = Column(DateTime(timezone=True), nullable=False)
