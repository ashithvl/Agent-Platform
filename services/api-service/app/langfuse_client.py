"""Thin async wrapper around Langfuse's public REST API.

We only call endpoints under `/api/public/*` - those accept Basic auth with
the project public/secret key pair stored in settings. Used for:
  - pulling traces for the Admin -> Observability drill-down view
  - pulling daily metrics for the rollup job (worker-service)
"""
from __future__ import annotations

import base64
from typing import Any

import httpx
from fastapi import HTTPException

from eai_common.settings import Settings


class LangfuseClient:
    def __init__(self, settings: Settings) -> None:
        self._base = settings.langfuse_host.rstrip("/")
        if not settings.langfuse_public_key or not settings.langfuse_secret_key:
            self._auth_header: str | None = None
        else:
            token = base64.b64encode(
                f"{settings.langfuse_public_key}:{settings.langfuse_secret_key}".encode()
            ).decode()
            self._auth_header = f"Basic {token}"

    async def _request(self, method: str, path: str, **kwargs: Any) -> Any:
        if self._auth_header is None:
            raise HTTPException(
                503, "Langfuse keys not configured (set LANGFUSE_PUBLIC_KEY / LANGFUSE_SECRET_KEY)"
            )
        url = f"{self._base}{path}"
        headers = {"Authorization": self._auth_header, "Content-Type": "application/json"}
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.request(method, url, headers=headers, **kwargs)
        if resp.status_code >= 400:
            raise HTTPException(resp.status_code, f"Langfuse error: {resp.text}")
        if resp.headers.get("content-type", "").startswith("application/json"):
            return resp.json()
        return resp.text

    async def traces(
        self,
        *,
        limit: int = 50,
        page: int = 1,
        user_id: str | None = None,
        from_timestamp: str | None = None,
        to_timestamp: str | None = None,
    ) -> dict[str, Any]:
        params: dict[str, Any] = {"limit": limit, "page": page}
        if user_id:
            params["userId"] = user_id
        if from_timestamp:
            params["fromTimestamp"] = from_timestamp
        if to_timestamp:
            params["toTimestamp"] = to_timestamp
        return await self._request("GET", "/api/public/traces", params=params)

    async def trace(self, trace_id: str) -> dict[str, Any]:
        return await self._request("GET", f"/api/public/traces/{trace_id}")

    async def daily_metrics(
        self, *, from_timestamp: str, to_timestamp: str
    ) -> dict[str, Any]:
        params = {"fromTimestamp": from_timestamp, "toTimestamp": to_timestamp}
        return await self._request("GET", "/api/public/metrics/daily", params=params)
