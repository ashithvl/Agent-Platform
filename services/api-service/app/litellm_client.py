"""Thin async wrapper around LiteLLM's admin REST API.

Everything here takes the LiteLLM master key from settings and never returns
it to callers. Errors are normalised into HTTPException so FastAPI routes stay
short.
"""
from __future__ import annotations

from typing import Any

import httpx
from fastapi import HTTPException, status

from eai_common.settings import Settings


class LiteLLMClient:
    def __init__(self, settings: Settings) -> None:
        self._base = settings.litellm_base_url.rstrip("/")
        self._headers = {
            "Authorization": f"Bearer {settings.litellm_master_key}",
            "Content-Type": "application/json",
        }

    async def _request(self, method: str, path: str, **kwargs: Any) -> Any:
        url = f"{self._base}{path}"
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.request(method, url, headers=self._headers, **kwargs)
        if resp.status_code >= 400:
            # Surface LiteLLM's message as-is so admins can act on it.
            raise HTTPException(resp.status_code, f"LiteLLM error: {resp.text}")
        if resp.headers.get("content-type", "").startswith("application/json"):
            return resp.json()
        return resp.text

    # ------------------------------------------------------------------
    # Models (read + write)
    # ------------------------------------------------------------------
    async def list_models(self) -> list[dict[str, Any]]:
        data = await self._request("GET", "/model/info")
        # LiteLLM returns {"data": [...]} for /model/info.
        return data.get("data", []) if isinstance(data, dict) else data

    async def public_models(self) -> list[dict[str, Any]]:
        """OpenAI-compatible `/v1/models` - used to feed the SPA's dropdowns."""
        data = await self._request("GET", "/v1/models")
        return data.get("data", []) if isinstance(data, dict) else data

    async def add_model(self, payload: dict[str, Any]) -> dict[str, Any]:
        return await self._request("POST", "/model/new", json=payload)

    async def delete_model(self, model_id: str) -> dict[str, Any]:
        return await self._request("POST", "/model/delete", json={"id": model_id})

    # ------------------------------------------------------------------
    # Virtual keys
    # ------------------------------------------------------------------
    async def list_keys(self) -> list[dict[str, Any]]:
        data = await self._request("GET", "/key/info")
        if isinstance(data, dict):
            return data.get("keys", data.get("data", []))
        return data

    async def create_key(self, payload: dict[str, Any]) -> dict[str, Any]:
        return await self._request("POST", "/key/generate", json=payload)

    async def delete_key(self, keys: list[str]) -> dict[str, Any]:
        return await self._request("POST", "/key/delete", json={"keys": keys})

    # ------------------------------------------------------------------
    # Budgets / teams
    # ------------------------------------------------------------------
    async def list_budgets(self) -> list[dict[str, Any]]:
        try:
            data = await self._request("GET", "/budget/list")
        except HTTPException as exc:
            if exc.status_code == status.HTTP_404_NOT_FOUND:
                return []
            raise
        if isinstance(data, dict):
            return data.get("data", [])
        return data

    async def upsert_budget(self, payload: dict[str, Any]) -> dict[str, Any]:
        return await self._request("POST", "/budget/new", json=payload)

    async def delete_budget(self, budget_id: str) -> dict[str, Any]:
        return await self._request("POST", "/budget/delete", json={"id": budget_id})
