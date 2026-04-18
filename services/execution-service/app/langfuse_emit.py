import logging
import threading
from typing import Any

from app.config import settings

logger = logging.getLogger(__name__)


def _enabled() -> bool:
    return bool(settings.langfuse_host and settings.langfuse_public_key and settings.langfuse_secret_key)


def emit_trace_async(
    *,
    name: str,
    user_sub: str | None,
    agent_id: str,
    input_text: str,
    output_text: str,
    metadata: dict[str, Any] | None = None,
) -> None:
    if not _enabled():
        return

    def _run() -> None:
        try:
            from langfuse import Langfuse

            lf = Langfuse(
                public_key=settings.langfuse_public_key,
                secret_key=settings.langfuse_secret_key,
                host=settings.langfuse_host.rstrip("/"),
            )
            lf.trace(
                name=name,
                user_id=user_sub,
                metadata={"agent_id": agent_id, **(metadata or {})},
                input=input_text,
                output=output_text,
            )
            lf.flush()
        except Exception as e:  # noqa: BLE001
            logger.warning("langfuse emit failed: %s", e)

    threading.Thread(target=_run, daemon=True).start()
