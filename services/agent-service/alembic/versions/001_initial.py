"""initial schema

Revision ID: 001
Revises:
Create Date: 2025-01-01

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "workspaces",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_table(
        "workspace_members",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("workspace_id", sa.Uuid(), sa.ForeignKey("workspaces.id"), nullable=False),
        sa.Column("user_sub", sa.String(255), nullable=False),
        sa.Column("role", sa.String(64), nullable=False, server_default="member"),
    )
    op.create_index("ix_workspace_members_sub", "workspace_members", ["user_sub"])

    op.create_table(
        "agents",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("workspace_id", sa.Uuid(), sa.ForeignKey("workspaces.id"), nullable=False),
        sa.Column("slug", sa.String(128), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_agents_workspace_slug", "agents", ["workspace_id", "slug"], unique=True)

    op.create_table(
        "agent_versions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("agent_id", sa.Uuid(), sa.ForeignKey("agents.id"), nullable=False),
        sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column("config", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_agent_versions_agent", "agent_versions", ["agent_id", "version_number"], unique=True)

    op.create_table(
        "agent_published",
        sa.Column("agent_id", sa.Uuid(), sa.ForeignKey("agents.id"), primary_key=True),
        sa.Column("env", sa.String(32), primary_key=True),
        sa.Column("version_id", sa.Uuid(), sa.ForeignKey("agent_versions.id"), nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("published_by", sa.String(255), nullable=True),
    )

    op.create_table(
        "ingest_jobs",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("workspace_id", sa.Uuid(), sa.ForeignKey("workspaces.id"), nullable=False),
        sa.Column("collection_id", sa.String(128), nullable=True),
        sa.Column("minio_key", sa.String(512), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="pending"),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    op.create_table(
        "audit_events",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("event_type", sa.String(128), nullable=False),
        sa.Column("actor_sub", sa.String(255), nullable=True),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )


def downgrade() -> None:
    op.drop_table("audit_events")
    op.drop_table("ingest_jobs")
    op.drop_table("agent_published")
    op.drop_table("agent_versions")
    op.drop_table("agents")
    op.drop_table("workspace_members")
    op.drop_table("workspaces")
