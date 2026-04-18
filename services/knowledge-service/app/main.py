import logging
from uuid import UUID

import httpx
import redis.asyncio as redis
from fastapi import Depends, FastAPI
from pydantic import BaseModel, Field

from app.config import settings
from app.deps import verify_internal_token
from app.minio_client import ensure_bucket

logger = logging.getLogger(__name__)
app = FastAPI(title="Knowledge Service", version="0.1.0")


@app.on_event("startup")
async def startup() -> None:
    try:
        ensure_bucket()
    except Exception as e:  # noqa: BLE001
        logger.warning("minio bucket ensure failed (may retry): %s", e)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


class IngestBody(BaseModel):
    workspace_id: str
    minio_key: str


@app.post("/internal/v1/collections/{collection_id}/ingest", dependencies=[Depends(verify_internal_token)])
async def enqueue_ingest(collection_id: str, body: IngestBody) -> dict[str, str]:
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.post(
            f"{settings.agent_service_url}/internal/v1/ingest-jobs",
            headers={"X-Internal-Token": settings.internal_service_token},
            json={
                "workspace_id": body.workspace_id,
                "collection_id": collection_id,
                "minio_key": body.minio_key,
            },
        )
        r.raise_for_status()
        job = r.json()

    rds = redis.from_url(settings.redis_url, decode_responses=True)
    await rds.rpush(settings.ingest_queue_key, job["id"])
    await rds.aclose()

    return {"job_id": job["id"], "status": "queued"}


@app.get("/internal/v1/ingest-jobs/{job_id}", dependencies=[Depends(verify_internal_token)])
async def get_job(job_id: UUID) -> dict:
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.get(
            f"{settings.agent_service_url}/internal/v1/ingest-jobs/{job_id}",
            headers={"X-Internal-Token": settings.internal_service_token},
        )
        r.raise_for_status()
        return r.json()


class PresignBody(BaseModel):
    object_name: str = Field(..., min_length=1)
    expires_seconds: int = 3600


@app.post("/internal/v1/presign-put", dependencies=[Depends(verify_internal_token)])
async def presign_put(body: PresignBody) -> dict[str, str]:
    from datetime import timedelta

    from app.minio_client import get_client

    client = get_client()
    url = client.presigned_put_object(
        settings.minio_bucket,
        body.object_name,
        expires=timedelta(seconds=body.expires_seconds),
    )
    return {"upload_url": url, "bucket": settings.minio_bucket, "object_name": body.object_name}
