# Sequence flows

Three end-to-end flows that the layered diagram does not show on its own.
Together they prove the platform handles **synchronous chat with retrieval**,
**asynchronous ingestion**, and **governed admin changes**.

Every flow propagates a single `trace_id` (the gateway's `X-Request-Id`)
across services so logs, HTTP traces, and Langfuse traces can be joined.

---

## 1. Authenticated chat with RAG

User asks a question through the web portal; the platform retrieves context
from the workspace knowledge hub, calls an LLM via LiteLLM, records the trace
in Langfuse, and returns the answer.

```mermaid
sequenceDiagram
  autonumber
  actor U as User (browser)
  participant N as Edge gateway (Nginx)
  participant A as auth-service
  participant API as api-service
  participant G as Guardrails
  participant E as execution-service
  participant K as knowledge-service
  participant V as Vector store
  participant L as LiteLLM
  participant P as LLM provider
  participant LF as Langfuse

  U->>N: POST /auth/login (username, password)
  N->>A: forward
  A->>A: verify bcrypt, mint JWT (15 min)
  A-->>U: 200 { access_token }

  U->>N: POST /api/v1/chat { workspace, question }<br/>Authorization: Bearer JWT<br/>X-Request-Id: r1
  N->>API: forward (rate limit, JWT verify)
  API->>API: RBAC check (role = user/dev/admin)
  API->>E: /execute { workspace, question, trace_id=r1 }
  E->>K: /retrieve { workspace, question }
  K->>V: vector search (top-k)
  V-->>K: chunks
  K-->>E: context
  E->>G: pre-flight (prompt injection, PII)
  G-->>E: ok / redacted prompt
  E->>L: chat.completions (model, prompt, metadata.trace_id=r1)
  L->>P: provider call (with virtual key, budget check)
  P-->>L: completion
  L-->>E: completion
  E->>G: post-flight (output filter)
  G-->>E: ok
  E->>LF: trace { id=r1, spans, tokens, cost }
  E-->>API: { answer }
  API-->>N: 200 { answer }
  N-->>U: 200 { answer }
```

Failure / degradation notes:

- If `knowledge-service` or vector store is down, `execution-service` falls
  back to **no-context** mode and tags the trace `degraded=retrieval_off`.
- If LiteLLM rejects (budget exceeded), `api-service` returns `429` with a
  workspace-friendly message.
- If Langfuse is unreachable, the trace is buffered locally for 1 h before
  being dropped; user traffic is never blocked on telemetry.

---

## 2. Document upload and indexing

User uploads a file; the platform stores it in object storage, queues an
ingestion task, extracts text, generates embeddings, and writes vectors back
to the workspace index.

```mermaid
sequenceDiagram
  autonumber
  actor U as User (browser)
  participant N as Edge gateway
  participant API as api-service
  participant K as knowledge-service
  participant M as MinIO / S3
  participant Q as TaskIQ (Redis)
  participant W as ingestion-worker
  participant O as OCR / parser (PyMuPDF, Surya)
  participant L as LiteLLM (embeddings)
  participant V as Vector store
  participant DB as Postgres (knowledge metadata)
  participant LF as Langfuse

  U->>N: POST /api/v1/uploads (file, workspace)<br/>X-Request-Id: r2
  N->>API: forward (auth, RBAC, size cap)
  API->>K: register upload (workspace, filename, sha256)
  K->>M: PUT s3://uploads/{workspace}/{sha256}
  K->>DB: insert document(status=queued, trace_id=r2)
  K->>Q: enqueue ingest_document(doc_id, trace_id=r2, idempotency_key=sha256)
  K-->>API: 202 { doc_id }
  API-->>U: 202 { doc_id }

  Q->>W: deliver task
  W->>DB: mark status=processing
  W->>M: GET object
  W->>O: parse + OCR
  O-->>W: text + structure
  W->>L: embeddings.create(chunks)
  L-->>W: vectors
  W->>V: upsert vectors (workspace namespace, doc_id)
  W->>DB: mark status=indexed, chunk_count
  W->>LF: trace { id=r2, kind=ingest, tokens, cost }
```

Notes:

- The `idempotency_key` is the file's `sha256`; replays of the same upload
  are no-ops and never double-charge.
- The user can poll `GET /api/v1/uploads/{doc_id}` (served by `knowledge-service`
  via `api-service`) to see `queued → processing → indexed` or `failed`.
- Failures move the task to a dead-letter queue; the SPA shows a "retry"
  button that re-enqueues with the same idempotency key.

---

## 3. Admin model change with audit and canary

A platform admin promotes a new provider/model into the catalog. The change
is governed: it requires elevated role, lands in **staging** first, runs the
eval harness, optionally canaries, and only then becomes visible to all
workspaces. Every step is auditable.

```mermaid
sequenceDiagram
  autonumber
  actor Adm as Platform admin
  participant N as Edge gateway
  participant API as api-service
  participant L as LiteLLM admin API
  participant DB as Postgres (catalog + audit)
  participant Eval as Eval harness (worker)
  participant LF as Langfuse
  participant Aud as Audit sink (MinIO object-lock)
  actor App as Approver (admin #2)

  Adm->>N: POST /api/v1/litellm/models<br/>{ name, provider, params }<br/>X-Request-Id: r3
  N->>API: forward
  API->>API: require role=admin, MFA fresh
  API->>L: create model in alias=staging
  L-->>API: ok
  API->>DB: insert catalog_change(actor=Adm, alias=staging, trace_id=r3)
  API->>Aud: append immutable audit record
  API-->>Adm: 201 { id, alias=staging }

  Adm->>N: POST /api/v1/eval/run { model, suite }
  N->>API: forward
  API->>Eval: enqueue eval task
  Eval->>L: run prompts (RAG quality, safety, cost)
  Eval->>LF: traces
  Eval->>DB: write eval_report(score, regressions)
  Eval-->>API: complete
  API-->>Adm: 200 { eval_report_id }

  Adm->>N: POST /api/v1/litellm/models/{id}/promote<br/>{ to=canary, percent=5 }
  N->>API: forward
  API->>App: open approval ticket (out-of-band)
  App-->>API: approve
  API->>L: update routing (canary 5%)
  API->>DB: insert catalog_change(actor=Adm, approver=App, alias=canary)
  API->>Aud: append audit record
  API-->>Adm: 200 { alias=canary }

  Note over LF,API: Canary metrics watched 24h<br/>(error rate, latency, cost)

  Adm->>N: POST /api/v1/litellm/models/{id}/promote { to=production }
  N->>API: forward
  API->>App: second approval
  App-->>API: approve
  API->>L: switch alias=production
  API->>DB: insert catalog_change(alias=production)
  API->>Aud: append audit record
  API-->>Adm: 200 { alias=production }
```

Notes:

- Every transition (`staging → canary → production`) requires a second admin
  approval and is appended to the **object-locked** audit bucket; rollback
  is a single API call that flips the alias and writes another audit record.
- If canary metrics regress (Langfuse-derived error rate or p95), the
  `worker-service` watcher posts a warning to the admin and disables the
  promote endpoint until acknowledged.
- End users never see staging or canary models unless their workspace is
  explicitly opted in via virtual-key tags.

---

## How to use these in the submission

1. Each section above maps to one **page** in the draw.io file
   (`Sequence: Chat`, `Sequence: Upload`, `Sequence: Admin model change`).
2. Keep the same actor/participant naming as the main layered diagram so
   reviewers can trace boxes back to layers.
3. The `X-Request-Id` / `trace_id` annotation is the bridge between this file
   and `diagram-extensions.md` (section 6, correlation tracing).
