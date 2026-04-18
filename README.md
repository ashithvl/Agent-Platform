# Document-Rag (frontend-only)

Single **Vite + React** workspace: agents, workflows, chat (mock replies), knowledge, tools, RAG profiles, settings, and telemetry **all persist in `localStorage`** in the browser. There are **no** Python/FastAPI services, workers, schedulers, or execution pipelines in this repository.

## Run the SPA (development)

```bash
cd apps/web
npm install
npm run dev
```

Open http://localhost:5173 — sign in uses **local demo accounts** (see Settings → People).

## Run a static build in Docker

```bash
docker compose up --build
```

Open http://localhost:8080 — nginx serves the built SPA only (no `/api`, no LiteLLM proxy, no IdP).

Rebuild after UI changes:

```bash
docker compose build --no-cache && docker compose up
```

## Model dropdowns

Chat/agent/RAG model lists come from a **bundled static catalog** in `apps/web/src/lib/liteLLMModels.ts`. The app does **not** call remote model APIs.

## API Access page

Invoke URLs and keys are **mock strings** for layout demos; the SPA does not send traffic to them.
