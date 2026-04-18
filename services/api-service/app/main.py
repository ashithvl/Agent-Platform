from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, FastAPI, HTTPException
from pydantic import BaseModel, Field

from app.auth import realm_roles, require_roles
from app.config import settings
from app.proxy import agent_get, agent_post, execution_post, knowledge_get, knowledge_post

app = FastAPI(title="API Gateway (BFF)", version="0.1.0")
router = APIRouter(prefix="/api/v1")


class AgentCreateBody(BaseModel):
    slug: str = Field(..., min_length=1)
    name: str = Field(..., min_length=1)


class VersionBody(BaseModel):
    config: dict[str, Any]


class PublishBody(BaseModel):
    env: str = "dev"


class ChatBody(BaseModel):
    message: str
    env: str = "dev"


class IngestBody(BaseModel):
    workspace_id: str
    minio_key: str


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/me")
async def me(user: dict[str, Any] = Depends(require_roles("consumer", "builder", "admin", "platform-admin"))) -> dict[str, Any]:
    return {
        "sub": user.get("sub"),
        "preferred_username": user.get("preferred_username"),
        "realm_roles": sorted(realm_roles(user)),
    }


@router.get("/workspaces/default/agents")
async def list_agents(user: dict[str, Any] = Depends(require_roles("consumer", "builder", "admin", "platform-admin"))) -> Any:
    wid = await agent_get("/internal/v1/workspaces/default/id")
    return await agent_get(f"/internal/v1/workspaces/{wid['workspace_id']}/agents")


@router.post("/workspaces/default/agents")
async def create_agent(
    body: AgentCreateBody, user: dict[str, Any] = Depends(require_roles("builder", "admin", "platform-admin"))
) -> Any:
    wid = await agent_get("/internal/v1/workspaces/default/id")
    return await agent_post(f"/internal/v1/workspaces/{wid['workspace_id']}/agents", json=body.model_dump())


@router.post("/agents/{agent_id}/versions")
async def add_version(
    agent_id: UUID, body: VersionBody, user: dict[str, Any] = Depends(require_roles("builder", "admin", "platform-admin"))
) -> Any:
    return await agent_post(f"/internal/v1/agents/{agent_id}/versions", json=body.model_dump())


@router.post("/agents/{agent_id}/publish")
async def publish(
    agent_id: UUID, body: PublishBody, user: dict[str, Any] = Depends(require_roles("builder", "admin", "platform-admin"))
) -> Any:
    sub = user.get("sub")
    return await agent_post(
        f"/internal/v1/agents/{agent_id}/publish",
        json={"env": body.env, "published_by": sub},
    )


@router.post("/agents/{agent_id}/chat")
async def chat(
    agent_id: UUID, body: ChatBody, user: dict[str, Any] = Depends(require_roles("consumer", "builder", "admin", "platform-admin"))
) -> Any:
    try:
        return await execution_post(
            "/internal/v1/chat",
            json={
                "agent_id": str(agent_id),
                "env": body.env,
                "message": body.message,
                "user_sub": user.get("sub"),
            },
        )
    except RuntimeError as e:
        raise HTTPException(502, detail=str(e)) from e


@router.post("/collections/{collection_id}/ingest")
async def ingest(
    collection_id: str,
    body: IngestBody,
    user: dict[str, Any] = Depends(require_roles("builder", "admin", "platform-admin")),
) -> Any:
    try:
        return await knowledge_post(
            f"/internal/v1/collections/{collection_id}/ingest",
            json={"workspace_id": body.workspace_id, "minio_key": body.minio_key},
        )
    except RuntimeError as e:
        raise HTTPException(502, detail=str(e)) from e


@router.get("/ingest-jobs/{job_id}")
async def ingest_job_status(
    job_id: UUID, user: dict[str, Any] = Depends(require_roles("consumer", "builder", "admin", "platform-admin"))
) -> Any:
    return await knowledge_get(f"/internal/v1/ingest-jobs/{job_id}")


@router.get("/admin/summary")
async def admin_summary(user: dict[str, Any] = Depends(require_roles("admin", "platform-admin"))) -> dict[str, Any]:
    wid = await agent_get("/internal/v1/workspaces/default/id")
    agents = await agent_get(f"/internal/v1/workspaces/{wid['workspace_id']}/agents")
    return {"workspace_id": wid["workspace_id"], "agent_count": len(agents)}


app.include_router(router)


@app.get("/health")
async def root_health() -> dict[str, str]:
    return {"status": "ok"}
