from typing import Any

import httpx

from app.config import settings


def _headers() -> dict[str, str]:
    return {"X-Internal-Token": settings.internal_service_token}


async def agent_get(path: str) -> Any:
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.get(f"{settings.agent_service_url}{path}", headers=_headers())
        r.raise_for_status()
        return r.json()


async def agent_post(path: str, json: dict[str, Any] | None = None) -> Any:
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.post(f"{settings.agent_service_url}{path}", headers=_headers(), json=json)
        if r.status_code >= 400:
            try:
                detail = r.json()
            except Exception:
                detail = r.text
            raise RuntimeError(str(detail))
        return r.json()


async def execution_post(path: str, json: dict[str, Any] | None = None) -> Any:
    async with httpx.AsyncClient(timeout=120.0) as client:
        r = await client.post(f"{settings.execution_service_url}{path}", headers=_headers(), json=json)
        if r.status_code >= 400:
            try:
                detail = r.json()
            except Exception:
                detail = r.text
            raise RuntimeError(str(detail))
        return r.json()


async def knowledge_post(path: str, json: dict[str, Any] | None = None) -> Any:
    async with httpx.AsyncClient(timeout=60.0) as client:
        r = await client.post(f"{settings.knowledge_service_url}{path}", headers=_headers(), json=json)
        if r.status_code >= 400:
            try:
                detail = r.json()
            except Exception:
                detail = r.text
            raise RuntimeError(str(detail))
        return r.json()


async def knowledge_get(path: str) -> Any:
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.get(f"{settings.knowledge_service_url}{path}", headers=_headers())
        r.raise_for_status()
        return r.json()
