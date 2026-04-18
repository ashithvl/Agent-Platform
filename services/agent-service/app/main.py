import uuid
from uuid import UUID

from fastapi import Depends, FastAPI, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import SessionLocal, get_session
from app.deps import verify_internal_token
from app.models import Agent, AgentPublished, AgentVersion, AuditEvent, IngestJob, Workspace
from app.schemas import (
    AgentCreate,
    AgentOut,
    AgentVersionCreate,
    AgentVersionOut,
    IngestJobCreate,
    IngestJobOut,
    IngestJobStatusUpdate,
    PublishBody,
    RuntimeConfigOut,
)

app = FastAPI(title="Agent Service", version="0.1.0")


@app.on_event("startup")
async def startup() -> None:
    async with SessionLocal() as session:
        res = await session.execute(select(Workspace).where(Workspace.name == "default"))
        if res.scalar_one_or_none() is None:
            wid = uuid.uuid4()
            session.add(Workspace(id=wid, name="default"))
            await session.commit()


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


async def _default_workspace_id(session: AsyncSession) -> UUID:
    res = await session.execute(select(Workspace).where(Workspace.name == "default"))
    ws = res.scalar_one_or_none()
    if not ws:
        raise HTTPException(500, "default workspace missing")
    return ws.id


@app.get("/internal/v1/workspaces/default/id", dependencies=[Depends(verify_internal_token)])
async def default_workspace_id(session: AsyncSession = Depends(get_session)) -> dict[str, str]:
    wid = await _default_workspace_id(session)
    return {"workspace_id": str(wid)}


@app.get("/internal/v1/workspaces/{workspace_id}/agents", dependencies=[Depends(verify_internal_token)])
async def list_agents(workspace_id: UUID, session: AsyncSession = Depends(get_session)) -> list[AgentOut]:
    res = await session.execute(select(Agent).where(Agent.workspace_id == workspace_id).order_by(Agent.created_at))
    return [AgentOut.model_validate(a) for a in res.scalars().all()]


@app.post("/internal/v1/workspaces/{workspace_id}/agents", dependencies=[Depends(verify_internal_token)])
async def create_agent(workspace_id: UUID, body: AgentCreate, session: AsyncSession = Depends(get_session)) -> AgentOut:
    existing = await session.execute(
        select(Agent).where(Agent.workspace_id == workspace_id, Agent.slug == body.slug)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(409, "slug already exists")
    agent = Agent(id=uuid.uuid4(), workspace_id=workspace_id, slug=body.slug, name=body.name)
    session.add(agent)
    await session.commit()
    await session.refresh(agent)
    return AgentOut.model_validate(agent)


@app.post("/internal/v1/agents/{agent_id}/versions", dependencies=[Depends(verify_internal_token)])
async def create_version(
    agent_id: UUID, body: AgentVersionCreate, session: AsyncSession = Depends(get_session)
) -> AgentVersionOut:
    agent = await session.get(Agent, agent_id)
    if not agent:
        raise HTTPException(404, "agent not found")
    res = await session.execute(select(AgentVersion).where(AgentVersion.agent_id == agent_id))
    versions = res.scalars().all()
    next_v = max((v.version_number for v in versions), default=0) + 1
    ver = AgentVersion(id=uuid.uuid4(), agent_id=agent_id, version_number=next_v, config=body.config)
    session.add(ver)
    await session.commit()
    await session.refresh(ver)
    return AgentVersionOut.model_validate(ver)


@app.post("/internal/v1/agents/{agent_id}/publish", dependencies=[Depends(verify_internal_token)])
async def publish(agent_id: UUID, body: PublishBody, session: AsyncSession = Depends(get_session)) -> dict[str, str]:
    agent = await session.get(Agent, agent_id)
    if not agent:
        raise HTTPException(404, "agent not found")
    res = await session.execute(
        select(AgentVersion).where(AgentVersion.agent_id == agent_id).order_by(AgentVersion.version_number.desc())
    )
    latest = res.scalars().first()
    if not latest:
        raise HTTPException(400, "no versions to publish")
    res_pub = await session.execute(
        select(AgentPublished).where(AgentPublished.agent_id == agent_id, AgentPublished.env == body.env)
    )
    pub = res_pub.scalar_one_or_none()
    if pub:
        pub.version_id = latest.id
        pub.published_by = body.published_by
    else:
        session.add(
            AgentPublished(agent_id=agent_id, env=body.env, version_id=latest.id, published_by=body.published_by)
        )
    session.add(
        AuditEvent(
            id=uuid.uuid4(),
            event_type="agent.publish",
            actor_sub=body.published_by,
            payload={"agent_id": str(agent_id), "env": body.env, "version_id": str(latest.id)},
        )
    )
    await session.commit()
    return {"status": "published", "version_id": str(latest.id), "env": body.env}


@app.get("/internal/v1/agents/{agent_id}/runtime-config", dependencies=[Depends(verify_internal_token)])
async def runtime_config(agent_id: UUID, env: str = "dev", session: AsyncSession = Depends(get_session)) -> RuntimeConfigOut:
    res_pub = await session.execute(
        select(AgentPublished).where(AgentPublished.agent_id == agent_id, AgentPublished.env == env)
    )
    pub = res_pub.scalar_one_or_none()
    if not pub:
        raise HTTPException(404, "no published version for env")
    ver = await session.get(AgentVersion, pub.version_id)
    if not ver:
        raise HTTPException(404, "version missing")
    return RuntimeConfigOut(
        agent_id=agent_id,
        env=env,
        version_id=ver.id,
        version_number=ver.version_number,
        config=ver.config,
    )


@app.post("/internal/v1/ingest-jobs", dependencies=[Depends(verify_internal_token)])
async def create_ingest_job(body: IngestJobCreate, session: AsyncSession = Depends(get_session)) -> IngestJobOut:
    job = IngestJob(
        id=uuid.uuid4(),
        workspace_id=body.workspace_id,
        collection_id=body.collection_id,
        minio_key=body.minio_key,
        status="pending",
    )
    session.add(job)
    await session.commit()
    await session.refresh(job)
    return IngestJobOut.model_validate(job)


@app.patch("/internal/v1/ingest-jobs/{job_id}", dependencies=[Depends(verify_internal_token)])
async def update_ingest_job(
    job_id: UUID, body: IngestJobStatusUpdate, session: AsyncSession = Depends(get_session)
) -> IngestJobOut:
    job = await session.get(IngestJob, job_id)
    if not job:
        raise HTTPException(404, "job not found")
    job.status = body.status
    job.error = body.error
    await session.commit()
    await session.refresh(job)
    return IngestJobOut.model_validate(job)


@app.get("/internal/v1/ingest-jobs/{job_id}", dependencies=[Depends(verify_internal_token)])
async def get_ingest_job(job_id: UUID, session: AsyncSession = Depends(get_session)) -> IngestJobOut:
    job = await session.get(IngestJob, job_id)
    if not job:
        raise HTTPException(404, "job not found")
    return IngestJobOut.model_validate(job)
