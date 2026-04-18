"""ingestion-worker stub. Future: PyMuPDF / Surya OCR -> embeddings -> LanceDB."""
from __future__ import annotations

from taskiq_redis import ListQueueBroker, RedisAsyncResultBackend

from eai_common.settings import Settings

settings = Settings(service_name="ingestion-worker")  # type: ignore[call-arg]

broker = ListQueueBroker(url=settings.redis_url).with_result_backend(
    RedisAsyncResultBackend(redis_url=settings.redis_url)
)


@broker.task(task_name="ingestion.noop")
async def noop(document_id: str) -> str:
    """Placeholder task so the worker boots green."""
    return f"received:{document_id}"
