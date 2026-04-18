# Enterprise AI Platform (Compose MVP)

Internal AI lab stack: **nginx** (edge), **Keycloak** (OIDC/RBAC), **FastAPI** services (`api-service`, `agent-service`, `execution-service`, `knowledge-service`), **Redis** queue + **worker-service**, **LiteLLM**, **Postgres**, **MinIO**, **LanceDB** (volume), and a **single Vite + React SPA** with route-level RBAC.

## Prerequisites

- Docker Engine + Docker Compose v2
- (Optional) `OPENAI_API_KEY` for real LiteLLM / OpenAI chat completions

## Quick start

```bash
cp .env.example .env
# Optionally set OPENAI_API_KEY in .env
docker compose up --build
```

Open:

| URL | Purpose |
|-----|---------|
| http://localhost:8080 | Web UI (via nginx) + `/api/v1` BFF |
| http://localhost:8090 | Keycloak (admin console: `admin` / `admin`) |

### Test users (realm `platform`)

| Username | Password | Roles |
|----------|----------|-------|
| `consumer` | `consumer` | consumer |
| `builder` | `builder` | consumer, builder |
| `admin` | `admin` | consumer, builder, admin, platform-admin |

After login, use **Chat** (all users), **Studio** (builder+), **Admin** (admin+). SPA reads **realm roles** from the **access token** JWT for client-side gating; **api-service** enforces the same roles on mutating routes.

## Request flow (chat)

```text
Browser -> nginx:8080/api/... -> api-service (JWT/JWKS from Keycloak)
       -> execution-service -> agent-service (published runtime config)
       -> LiteLLM -> (optional) Langfuse trace (background thread)
```

## Document ingest flow

```text
Builder -> api-service -> knowledge-service -> Postgres (ingest_jobs) + Redis list ingest_queue
worker-service -> MinIO GET -> stub extract -> LanceDB table kb_{collection_id}
               -> agent-service PATCH ingest job status
```

The worker uses a **Redis list** (`ingest_queue`) for MVP simplicity. **TaskIQ** can replace this later with a shared task package.

## Services (containers)

1. `nginx` — static SPA + reverse proxy to `api-service`
2. `keycloak` + `postgres-keycloak`
3. `postgres-app` — platform metadata (agents, versions, publish pointers, ingest jobs, audit)
4. `redis`
5. `minio`
6. `api-service` — BFF + JWT validation + RBAC
7. `agent-service` — agents / prompts / publish / ingest job records
8. `execution-service` — stub “LangGraph” (single LLM step) + LiteLLM + Guardrails placeholder + optional Langfuse
9. `knowledge-service` — presign (internal), enqueue ingest
10. `worker-service` — async consumer
11. `litellm` — model gateway

## Langfuse (observability)

Self-hosted Langfuse typically requires **Postgres + ClickHouse** (and sometimes Redis). This MVP **does not** ship a full Langfuse stack to keep Compose lean.

**Recommended:** use [Langfuse Cloud](https://langfuse.com). Set in `.env`:

- `LANGFUSE_PUBLIC_KEY`
- `LANGFUSE_SECRET_KEY`
- `LANGFUSE_HOST` (e.g. `https://cloud.langfuse.com`)

`execution-service` emits traces in a **background thread** and never blocks the chat response on Langfuse availability.

## Development (SPA only)

```bash
cd apps/web
npm install
npm run dev
```

Vite proxies `/api` to `http://localhost:8000`. Run `api-service` (and dependencies) via Compose or locally with matching env vars. Keycloak redirect URIs must include `http://localhost:5173/callback` if you test OIDC against local Vite—add that redirect URI to the `web-spa` client in Keycloak.

## API examples (with token)

```bash
TOKEN=... # access_token from browser devtools or OIDC flow

curl -sS -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/v1/me
curl -sS -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/v1/workspaces/default/agents
```

## Security notes (MVP)

- Service-to-service calls use `X-Internal-Token` (set via `INTERNAL_SERVICE_TOKEN`).
- Replace with mTLS or workload identity for production.
- JWT `aud` verification is relaxed (`verify_aud: false`) for Keycloak compatibility; tighten when client audience is stable.

## Known limitations / Phase 2

- OPA-style policy engine; per-tenant rate limits in app code; virus scanning for uploads.
- LanceDB single-node volume (no HA); backups are your responsibility.
- LangGraph multi-node workflows; TaskIQ-based task package shared across services.
- Full Langfuse self-hosted compose (Postgres + ClickHouse) if required on-prem.
