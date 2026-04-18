# Enterprise AI Platform (Compose MVP)

Internal AI lab stack: **nginx** (edge), **Authentik** (OIDC/RBAC), **FastAPI** services (`api-service`, `agent-service`, `execution-service`, `knowledge-service`), **Redis** queue + **worker-service**, **LiteLLM**, **Postgres**, **MinIO**, **LanceDB** (volume), and a **single Vite + React SPA** with route-level RBAC.

## Prerequisites

- Docker Engine + Docker Compose v2
- (Optional) `OPENAI_API_KEY` for real LiteLLM / OpenAI chat completions

## Quick start

```bash
cp .env.example .env
# Optionally set OPENAI_API_KEY in .env
docker compose up --build
```

**Important:** The SPA is **baked into the `nginx` image** at build time. If you only run `docker compose up` (without `--build`), Docker often **reuses an old nginx image** and you will still see an **older UI** (e.g. the same login screen). After pulling code or changing `apps/web`, always rebuild the edge image:

```bash
docker compose build --no-cache nginx && docker compose up
```

Then do a **hard refresh** in the browser (e.g. Cmd+Shift+R) so `index.html` is not served from cache.

Open:

| URL | Purpose |
|-----|---------|
| http://localhost:8080 | **React SPA** — start here for Chat / Studio / Admin; sign-in is username/password in the app (the API talks to Authentik server-side; users never see the IdP) |
| http://localhost:8080/login | Same login entry as home (bookmark-friendly) |
| http://localhost:8080/authentik/ | Authentik admin UI and IdP pages (provider setup, not the app shell) |
| http://localhost:4000 | **LiteLLM** (host port; SPA model lists via `/litellm` when using nginx on 8080, or Vite proxy in dev) |
| http://localhost:9002 | MinIO S3 API (host port; internal services use `minio:9000`) |
| http://localhost:9003 | MinIO console |

### Authentik bootstrap credentials

| Field | Value |
|-------|-------|
| email | `${AUTHENTIK_BOOTSTRAP_EMAIL}` (default `admin@example.com`) |
| password | `${AUTHENTIK_BOOTSTRAP_PASSWORD}` (default `admin`) |

After the stack is up, bootstrap the OIDC app (public client id and application slug **`web-spa`**) and RBAC groups using the same token as in `.env`:

```bash
set -a && source .env && set +a
python3 infra/authentik/bootstrap_web_spa.py
```

This creates the provider if missing, adds groups `consumer`, `builder`, `admin`, and `platform-admin`, and assigns them to `akadmin` together with `authentik Admins`. Access tokens include `realm_access.roles` and `groups` derived from Authentik group names (see SPA/API RBAC). Then open **http://localhost:8080** and use **Sign in** (same credentials as your Authentik user). Routes: **Chat** (consumer+), **Studio** (builder+), **Admin** (admin+).

## Request flow (chat)

```text
Browser -> nginx:8080/api/... -> api-service (JWT/JWKS from Authentik OIDC discovery)
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

1. `nginx` — static SPA + reverse proxy to `api-service`, **LiteLLM** at `/litellm/` (same-origin for SPA model lists), and **Authentik** at `/authentik/`
2. `authentik-server` + `authentik-worker` + `postgres-authentik` + `redis-authentik`
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

Vite proxies `/api` to `http://localhost:8000`. Run `api-service` (and dependencies) via Compose or locally with matching env vars (`OIDC_*` and `AUTHENTIK_INTERNAL_BASE` as in `docker-compose.yml`). The SPA calls `POST /api/v1/auth/login`; optionally set `VITE_API_BASE` if your API is not under `/api/v1` behind the dev proxy.

Vite also proxies `/litellm` to `http://localhost:4000` when LiteLLM is published (Compose maps **4000:4000**). Through nginx at **http://localhost:8080**, the SPA uses **`/litellm/`** as the same-origin base for **`GET /litellm/v1/models`**.

### SPA: LiteLLM model dropdown (demo)

The Agents / RAG UI can list models from LiteLLM’s OpenAI-compatible API. Set in **`apps/web/.env`** (or Docker build args for the nginx-baked SPA):

- **`VITE_LITELLM_BASE`** — default `/litellm` (behind nginx) or `http://localhost:4000` for raw LiteLLM in dev.
- **`VITE_LITELLM_API_KEY`** — must match **`LITELLM_MASTER_KEY`** (default `sk-litellm-master-key`). **This exposes the master key to the browser — demo only;** use a BFF or server-side proxy in production.

**Logout:** The SPA clears the stored access token and returns to `/login`. No redirect to Authentik in the browser.

## API examples (with token)

```bash
TOKEN=... # access_token from browser devtools or OIDC flow

curl -sS -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/v1/me
curl -sS -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/v1/workspaces/default/agents
```

## Security notes (MVP)

- Service-to-service calls use `X-Internal-Token` (set via `INTERNAL_SERVICE_TOKEN`).
- Replace with mTLS or workload identity for production.
- JWT `aud` verification is relaxed (`verify_aud: false`) for provider compatibility; tighten when client audience is stable.

## Known limitations / Phase 2

- OPA-style policy engine; per-tenant rate limits in app code; virus scanning for uploads.
- LanceDB single-node volume (no HA); backups are your responsibility.
- LangGraph multi-node workflows; TaskIQ-based task package shared across services.
- Full Langfuse self-hosted compose (Postgres + ClickHouse) if required on-prem.
