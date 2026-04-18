# Document-Rag (enterprise stack)

A self-hosted enterprise AI platform: a React SPA plus a microservice backend
covering auth, LiteLLM control plane, Langfuse-fed telemetry, and
agents/workflows/knowledge CRUD. Everything runs under `docker compose`;
Kubernetes/Terraform come later.

## Services

| Container | Role |
| --- | --- |
| `web` (nginx) | SPA + reverse proxy for `/api`, `/auth` |
| `auth-service` | Username/password login, JWT (`realm_access.roles`), user CRUD |
| `api-service` | Public BFF: JWT verify, SlowAPI rate limit, LiteLLM + Langfuse proxy, telemetry rollups |
| `agent-service` | Agents / workflows / guardrails CRUD (Postgres JSONB) |
| `execution-service` | LangGraph runner; every call emits a Langfuse trace |
| `knowledge-service` | Knowledge hubs + RAG profiles CRUD |
| `ingestion-worker` | TaskIQ worker (PyMuPDF / OCR / embeddings - stub today) |
| `worker-service` + `worker-scheduler` | TaskIQ worker + scheduler; Langfuse -> Postgres rollup job every 15 min |
| `postgres` | App DB (`eai`) |
| `postgres-langfuse` | Dedicated DB for Langfuse |
| `redis` | Sessions, SlowAPI counters, TaskIQ broker |
| `minio` (+ init) | S3-compatible object store (buckets: `uploads`, `extracts`, `exports`, `langfuse`) |
| `litellm` | Model gateway (master key stays server-side) |
| `langfuse-web` | Self-hosted Langfuse UI on `:3003` |

## Bring the stack up

```bash
cp infra/litellm/.env.example infra/litellm/.env       # add OPENAI / ANTHROPIC keys
cp infra/langfuse/.env.example infra/langfuse/.env     # set NEXTAUTH_SECRET / SALT
cp apps/web/.env.example apps/web/.env.local           # opt into backend features

docker compose up --build
```

Then:

1. Visit http://localhost:3003 and create the Langfuse org/project.
2. Copy the public/secret key pair back into `infra/langfuse/.env`.
3. `docker compose up -d api-service execution-service worker-service worker-scheduler` to pick up the keys.
4. Open http://localhost:8080 - log in as `admin / admin`, `developer / developer`, or `user / user`.

## Admin features in the SPA (admins only)

Settings ->
- **Models** - manage the LiteLLM catalog (`/model/new`, `/model/delete`, `/model/info`)
- **Virtual keys** - generate/revoke LiteLLM keys (`/key/generate`, `/key/delete`)
- **Budgets** - per-key/per-team budgets (`/budget/*`)
- **Observability** - live Langfuse traces with drill-down (span tree, metadata)

The **Telemetry** page shows real cost/request/token rollups broken down by user / agent / workflow, served by api-service from the `usage_daily` table (populated by `worker-scheduler`).

## Feature flags

`apps/web/.env.local`:

```
VITE_USE_BACKEND=1          # auth + api go through services instead of localStorage
VITE_STORAGE_AGENTS=1       # agents CRUD via /api/v1/agents (Phase 5)
VITE_STORAGE_WORKFLOWS=0    # not flipped yet - still localStorage
...
```

Each `VITE_STORAGE_*` migrates one area at a time without breaking the others.

## Local-only (no backend)

Drop `VITE_USE_BACKEND` and run only the SPA:

```bash
cd apps/web && npm install && npm run dev
```

The SPA falls back to localStorage for users, agents, workflows, knowledge, etc.
