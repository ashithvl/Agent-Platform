from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class AgentCreate(BaseModel):
    slug: str = Field(..., min_length=1, max_length=128)
    name: str = Field(..., min_length=1, max_length=255)


class AgentOut(BaseModel):
    id: UUID
    workspace_id: UUID
    slug: str
    name: str
    created_at: datetime

    model_config = {"from_attributes": True}


class AgentVersionCreate(BaseModel):
    config: dict[str, Any]


class AgentVersionOut(BaseModel):
    id: UUID
    agent_id: UUID
    version_number: int
    config: dict[str, Any]
    created_at: datetime

    model_config = {"from_attributes": True}


class PublishBody(BaseModel):
    env: str = "dev"
    published_by: Optional[str] = None


class RuntimeConfigOut(BaseModel):
    agent_id: UUID
    env: str
    version_id: UUID
    version_number: int
    config: dict[str, Any]


class IngestJobCreate(BaseModel):
    workspace_id: UUID
    collection_id: Optional[str] = None
    minio_key: str


class IngestJobOut(BaseModel):
    id: UUID
    workspace_id: UUID
    collection_id: Optional[str]
    minio_key: str
    status: str
    error: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class IngestJobStatusUpdate(BaseModel):
    status: str
    error: Optional[str] = None
