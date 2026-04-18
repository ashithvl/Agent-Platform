"""api-service: the only public API surface for the SPA.

Responsibilities:
  - Validate JWTs issued by auth-service.
  - Enforce RBAC for admin-only routes (LiteLLM control plane).
  - Apply per-route rate limits via SlowAPI backed by Redis.
  - Proxy LiteLLM (never leaking the master key).
  - Serve telemetry/cost rollups written by worker-service.
"""
from __future__ import annotations

from datetime import date, timedelta
from typing import Any, Iterable, Literal

from fastapi import Depends, FastAPI, HTTPException, Query, Request, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from eai_common.auth import TokenClaims, claims_from_request, require_any_role
from eai_common.db import make_engine, make_session_factory
from eai_common.settings import Settings

import httpx

from .langfuse_client import LangfuseClient
from .litellm_client import LiteLLMClient
from .models import Base, TracesIndex, UsageDaily

settings = Settings(service_name="api-service")  # type: ignore[call-arg]
engine = make_engine(settings)
SessionFactory = make_session_factory(settings)
litellm = LiteLLMClient(settings)
langfuse = LangfuseClient(settings)

# Redis-backed limiter. `get_remote_address` is enough for demo; in prod we
# would key off the JWT sub so one workspace can't DoS another from NAT.
limiter = Limiter(key_func=get_remote_address, storage_uri=settings.redis_url)

app = FastAPI(title="api-service", version="0.1.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, lambda r, e: HTTPException(429, "Too many requests"))

# CORS only matters when the SPA is served from a different origin than the
# API (e.g. Vite dev on :5173). In the nginx-served build they share origin.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=False,
)


@app.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(engine)


# ---------------------------------------------------------------------------
# DI
# ---------------------------------------------------------------------------


def get_db() -> Iterable[Session]:
    db = SessionFactory()
    try:
        yield db
    finally:
        db.close()


def get_claims(request: Request) -> TokenClaims:
    return claims_from_request(settings, request)


def get_admin_claims(request: Request) -> TokenClaims:
    claims = claims_from_request(settings, request)
    require_any_role(claims, ("admin", "platform-admin"))
    return claims


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok", "service": settings.service_name}


# ---------------------------------------------------------------------------
# LiteLLM passthrough (admin-only writes; authenticated reads)
# ---------------------------------------------------------------------------


class AddModelRequest(BaseModel):
    model_name: str = Field(min_length=1)
    litellm_params: dict[str, Any]
    model_info: dict[str, Any] | None = None


class CreateKeyRequest(BaseModel):
    key_alias: str | None = None
    models: list[str] | None = None
    max_budget: float | None = None
    duration: str | None = None
    metadata: dict[str, Any] | None = None


class UpsertBudgetRequest(BaseModel):
    budget_id: str
    max_budget: float
    budget_duration: str = "monthly"


@app.get("/api/v1/litellm/models")
async def list_models(_: TokenClaims = Depends(get_claims)) -> list[dict[str, Any]]:
    """Authenticated models list - feeds every SPA dropdown."""
    return await litellm.public_models()


@app.get("/api/v1/litellm/admin/models")
async def admin_list_models(_: TokenClaims = Depends(get_admin_claims)) -> list[dict[str, Any]]:
    return await litellm.list_models()


@app.post("/api/v1/litellm/admin/models", status_code=201)
async def admin_add_model(
    body: AddModelRequest, _: TokenClaims = Depends(get_admin_claims)
) -> dict[str, Any]:
    return await litellm.add_model(body.model_dump(exclude_none=True))


@app.delete("/api/v1/litellm/admin/models/{model_id}")
async def admin_delete_model(
    model_id: str, _: TokenClaims = Depends(get_admin_claims)
) -> dict[str, Any]:
    return await litellm.delete_model(model_id)


@app.get("/api/v1/litellm/admin/keys")
async def admin_list_keys(_: TokenClaims = Depends(get_admin_claims)) -> list[dict[str, Any]]:
    return await litellm.list_keys()


@app.post("/api/v1/litellm/admin/keys", status_code=201)
async def admin_create_key(
    body: CreateKeyRequest, _: TokenClaims = Depends(get_admin_claims)
) -> dict[str, Any]:
    return await litellm.create_key(body.model_dump(exclude_none=True))


@app.delete("/api/v1/litellm/admin/keys")
async def admin_delete_keys(
    keys: list[str], _: TokenClaims = Depends(get_admin_claims)
) -> dict[str, Any]:
    return await litellm.delete_key(keys)


@app.get("/api/v1/litellm/admin/budgets")
async def admin_list_budgets(_: TokenClaims = Depends(get_admin_claims)) -> list[dict[str, Any]]:
    return await litellm.list_budgets()


@app.post("/api/v1/litellm/admin/budgets", status_code=201)
async def admin_upsert_budget(
    body: UpsertBudgetRequest, _: TokenClaims = Depends(get_admin_claims)
) -> dict[str, Any]:
    return await litellm.upsert_budget(body.model_dump())


@app.delete("/api/v1/litellm/admin/budgets/{budget_id}")
async def admin_delete_budget(
    budget_id: str, _: TokenClaims = Depends(get_admin_claims)
) -> dict[str, Any]:
    return await litellm.delete_budget(budget_id)


# ---------------------------------------------------------------------------
# Telemetry rollups
# ---------------------------------------------------------------------------


Dimension = Literal["user", "agent", "workflow"]


class TelemetryRow(BaseModel):
    key: str
    label: str
    requests: int
    input_tokens: int
    output_tokens: int
    cost_usd: float


class TelemetrySummary(BaseModel):
    dimension: Dimension
    from_date: date
    to_date: date
    total_requests: int
    total_cost_usd: float
    rows: list[TelemetryRow]


def _column_for_dimension(dim: Dimension):
    return {
        "user": UsageDaily.user_id,
        "agent": UsageDaily.agent_id,
        "workflow": UsageDaily.workflow_id,
    }[dim]


@app.get("/api/v1/telemetry/summary", response_model=TelemetrySummary)
@limiter.limit("60/minute")
def telemetry_summary(
    request: Request,
    dimension: Dimension = "user",
    from_date: date | None = Query(default=None, alias="from"),
    to_date: date | None = Query(default=None, alias="to"),
    _: TokenClaims = Depends(get_claims),
    db: Session = Depends(get_db),
) -> TelemetrySummary:
    to_d = to_date or date.today()
    from_d = from_date or (to_d - timedelta(days=29))
    col = _column_for_dimension(dimension)

    stmt = (
        select(
            col.label("key"),
            func.sum(UsageDaily.requests).label("requests"),
            func.sum(UsageDaily.input_tokens).label("input_tokens"),
            func.sum(UsageDaily.output_tokens).label("output_tokens"),
            func.sum(UsageDaily.cost_usd).label("cost_usd"),
        )
        .where(UsageDaily.date >= from_d, UsageDaily.date <= to_d)
        .group_by(col)
        .order_by(desc("cost_usd"))
    )
    rows = db.execute(stmt).all()
    out_rows = [
        TelemetryRow(
            key=(r.key or "(unknown)"),
            label=(r.key or "(unknown)"),
            requests=int(r.requests or 0),
            input_tokens=int(r.input_tokens or 0),
            output_tokens=int(r.output_tokens or 0),
            cost_usd=float(r.cost_usd or 0),
        )
        for r in rows
    ]
    return TelemetrySummary(
        dimension=dimension,
        from_date=from_d,
        to_date=to_d,
        total_requests=sum(r.requests for r in out_rows),
        total_cost_usd=sum(r.cost_usd for r in out_rows),
        rows=out_rows,
    )


class TraceOut(BaseModel):
    trace_id: str
    name: str
    user_id: str
    agent_id: str
    workflow_id: str
    input_tokens: int
    output_tokens: int
    cost_usd: float
    latency_ms: int
    started_at: str


@app.get("/api/v1/telemetry/traces", response_model=list[TraceOut])
@limiter.limit("60/minute")
def list_traces(
    request: Request,
    limit: int = Query(default=50, ge=1, le=200),
    _: TokenClaims = Depends(get_claims),
    db: Session = Depends(get_db),
) -> list[TraceOut]:
    rows = db.scalars(
        select(TracesIndex).order_by(desc(TracesIndex.started_at)).limit(limit)
    ).all()
    return [
        TraceOut(
            trace_id=r.trace_id,
            name=r.name,
            user_id=r.user_id,
            agent_id=r.agent_id,
            workflow_id=r.workflow_id,
            input_tokens=r.input_tokens,
            output_tokens=r.output_tokens,
            cost_usd=float(r.cost_usd or 0),
            latency_ms=r.latency_ms,
            started_at=r.started_at.isoformat() if r.started_at else "",
        )
        for r in rows
    ]


@app.get("/api/v1/telemetry/traces/{trace_id}")
async def get_trace_detail(
    trace_id: str, _: TokenClaims = Depends(get_claims)
) -> dict[str, Any]:
    """Live drill-down - always fetched from Langfuse so we get spans."""
    return await langfuse.trace(trace_id)


# ---------------------------------------------------------------------------
# Conversations (stub - real storage lands in Phase 5)
# ---------------------------------------------------------------------------


class ConversationMessage(BaseModel):
    role: str
    content: str
    timestamp: str | None = None


class Conversation(BaseModel):
    id: str
    workflow_id: str = ""
    messages: list[ConversationMessage] = []


@app.get("/api/v1/conversations", response_model=list[Conversation])
def list_conversations(_: TokenClaims = Depends(get_claims)) -> list[Conversation]:
    # Phase 5: back this with Redis (short-term) + Postgres (persistent).
    return []


@app.get("/api/v1/conversations/{conversation_id}", response_model=Conversation)
def get_conversation(
    conversation_id: str, _: TokenClaims = Depends(get_claims)
) -> Conversation:
    raise HTTPException(status.HTTP_404_NOT_FOUND, "conversations not migrated yet")


# ---------------------------------------------------------------------------
# Phase 5 proxies: agent-service and knowledge-service
#
# The SPA's per-area feature flags (`VITE_STORAGE_AGENTS`, etc.) point at the
# routes below. api-service is the only public surface; agent-service and
# knowledge-service are private to the docker network.
# ---------------------------------------------------------------------------


AGENT_SERVICE_URL = "http://agent-service:8000"
KNOWLEDGE_SERVICE_URL = "http://knowledge-service:8000"


async def _proxy(
    method: str,
    upstream: str,
    path: str,
    request: Request,
    body: Any | None = None,
) -> Any:
    headers = {
        "Authorization": request.headers.get("authorization", ""),
        "Content-Type": "application/json",
    }
    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.request(
            method, f"{upstream}{path}", headers=headers, json=body
        )
    if resp.status_code >= 400:
        raise HTTPException(resp.status_code, resp.text)
    if resp.status_code == 204 or not resp.content:
        return {}
    return resp.json()


def _make_proxy_routes(prefix: str, upstream: str) -> None:
    slug = prefix.replace("-", "_")

    async def _list_handler(request: Request, _: TokenClaims = Depends(get_claims)):
        return await _proxy("GET", upstream, f"/{prefix}", request)

    async def _upsert_handler(
        request: Request, body: dict[str, Any], _: TokenClaims = Depends(get_claims)
    ):
        return await _proxy("PUT", upstream, f"/{prefix}", request, body)

    async def _delete_handler(
        item_id: str, request: Request, _: TokenClaims = Depends(get_claims)
    ):
        return await _proxy("DELETE", upstream, f"/{prefix}/{item_id}", request)

    _list_handler.__name__ = f"list_{slug}"
    _upsert_handler.__name__ = f"upsert_{slug}"
    _delete_handler.__name__ = f"delete_{slug}"

    app.add_api_route(f"/api/v1/{prefix}", _list_handler, methods=["GET"])
    app.add_api_route(f"/api/v1/{prefix}", _upsert_handler, methods=["PUT"])
    app.add_api_route(f"/api/v1/{prefix}/{{item_id}}", _delete_handler, methods=["DELETE"])


_make_proxy_routes("agents", AGENT_SERVICE_URL)
_make_proxy_routes("workflows", AGENT_SERVICE_URL)
_make_proxy_routes("guardrails", AGENT_SERVICE_URL)
_make_proxy_routes("hubs", KNOWLEDGE_SERVICE_URL)
_make_proxy_routes("rag-profiles", KNOWLEDGE_SERVICE_URL)
