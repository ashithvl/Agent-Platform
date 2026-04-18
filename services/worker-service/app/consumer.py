import asyncio
import logging
import os
import uuid
from datetime import datetime
from uuid import UUID

import httpx
import redis.asyncio as redis
from minio import Minio

from app.config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def minio_client() -> Minio:
    ep = settings.minio_endpoint.replace("http://", "").replace("https://", "")
    secure = settings.minio_endpoint.startswith("https://")
    return Minio(
        ep,
        access_key=settings.minio_access_key,
        secret_key=settings.minio_secret_key,
        secure=secure,
    )


async def patch_job(job_id: UUID, status: str, error: str | None = None) -> None:
    async with httpx.AsyncClient(timeout=30.0) as client:
        await client.patch(
            f"{settings.agent_service_url}/internal/v1/ingest-jobs/{job_id}",
            headers={"X-Internal-Token": settings.internal_service_token},
            json={"status": status, "error": error},
        )


async def process_job(job_id: str) -> None:
    jid = UUID(job_id)
    await patch_job(jid, "processing", None)
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            r = await client.get(
                f"{settings.agent_service_url}/internal/v1/ingest-jobs/{jid}",
                headers={"X-Internal-Token": settings.internal_service_token},
            )
            r.raise_for_status()
            job = r.json()

        mc = minio_client()
        obj = mc.get_object(settings.minio_bucket, job["minio_key"])
        raw = obj.read()
        obj.close()
        obj.release_conn()

        # Stub extract: treat as utf-8 text or note binary length
        try:
            text = raw.decode("utf-8")[:8000]
        except UnicodeDecodeError:
            text = f"[binary len={len(raw)}]"

        os.makedirs(settings.lancedb_path, exist_ok=True)
        import lancedb

        db = lancedb.connect(settings.lancedb_path)
        table_name = f"kb_{job.get('collection_id') or 'default'}"
        rows = [
            {
                "id": str(uuid.uuid4()),
                "job_id": job_id,
                "minio_key": job["minio_key"],
                "text": text,
                "created_at": datetime.utcnow().isoformat() + "Z",
            }
        ]
        try:
            tbl = db.open_table(table_name)
            tbl.add(rows)
        except (ValueError, FileNotFoundError, OSError):
            db.create_table(table_name, data=rows)

        await patch_job(jid, "completed", None)
        logger.info("ingest completed job=%s table=%s", job_id, table_name)
    except Exception as e:  # noqa: BLE001
        logger.exception("ingest failed job=%s", job_id)
        await patch_job(jid, "failed", str(e)[:4000])


async def loop_forever() -> None:
    r = redis.from_url(settings.redis_url, decode_responses=True)
    logger.info("worker listening on queue=%s", settings.ingest_queue_key)
    while True:
        try:
            item = await r.brpop(settings.ingest_queue_key, timeout=5)
            if not item:
                continue
            _, job_id = item
            await process_job(job_id)
        except asyncio.CancelledError:
            raise
        except Exception as e:  # noqa: BLE001
            logger.exception("worker loop error: %s", e)
            await asyncio.sleep(1)


def main() -> None:
    asyncio.run(loop_forever())


if __name__ == "__main__":
    main()
