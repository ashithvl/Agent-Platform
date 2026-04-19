# Non-functional requirements (NFR)

Companion tables to the architecture overview. Numbers are **target** values for
the production environment; staging is one tier below, dev is best-effort.

---

## 1. Service-level objectives (SLO)

| Capability | Indicator (SLI) | Target (SLO) | Error budget | Notes |
|---|---|---|---|---|
| Web portal | HTTP 5xx rate on `GET /` | < 0.1% | 30d rolling | Static assets via CDN. |
| Edge gateway | p95 latency, healthy upstream | < 150 ms | 30d rolling | Excludes LLM time. |
| Chat (sync) | p95 end-to-end response | < 4.0 s | 99.0% / 30d | With RAG, single tool call. |
| Chat (sync) | p99 end-to-end response | < 8.0 s | 99.0% / 30d | Cold-start tolerant. |
| Q&A retrieval | p95 vector search | < 250 ms | 99.5% / 30d | Top-k = 8, HNSW. |
| Document ingest | Time to "indexed" for ≤ 50 MB PDF | < 90 s p95 | 99.0% / 30d | Async pipeline. |
| Auth | p95 login | < 600 ms | 99.9% / 30d | Includes JWT mint. |
| Admin APIs | Availability | 99.5% / 30d | — | Read-only fallback if model gateway down. |
| Telemetry pull | Lag from Langfuse to local rollups | < 20 min | 99% / 30d | Scheduled every 15 min. |

---

## 2. Availability and disaster recovery

| Component | Availability target | RPO | RTO | Strategy |
|---|---|---|---|---|
| Edge gateway (Nginx) | 99.95% | n/a | < 5 min | Stateless, multi-replica behind LB. |
| `api-service`, `auth-service`, `agent-service`, `knowledge-service` | 99.9% | n/a | < 10 min | Stateless, ≥ 2 replicas, rolling deploy. |
| `execution-service` | 99.5% | n/a | < 10 min | Degrades to "model gateway down" banner. |
| Postgres (operational) | 99.95% | 5 min | 30 min | Managed PG with PITR; standby in second AZ. |
| Postgres (Langfuse) | 99.5% | 60 min | 60 min | Daily logical backup; trace loss tolerable. |
| Redis (sessions / queues) | 99.9% | 5 min (AOF) | 15 min | Replica + sentinel; queues are idempotent. |
| MinIO / S3 | 99.99% | 0 (versioning) | 30 min | Object lock on `audit/`; cross-region replication for prod. |
| Vector store | 99.5% | rebuildable | 4 h | Snapshot nightly; full rebuild from sources is a documented runbook. |
| LiteLLM | 99.5% | n/a | 10 min | Stateless except DB; failover to second region or self-host fallback model. |
| Langfuse | 99.0% | 60 min | 60 min | Loss of traces does not block user traffic. |

---

## 3. Data retention and residency

| Data class | Store | Default retention | Legal hold | Residency |
|---|---|---|---|---|
| User accounts | Postgres `auth.users` | Account lifetime + 90 d | Yes | Primary region only. |
| Conversations | Postgres `app.conversations` | 180 d (configurable per workspace) | Yes | Workspace region. |
| Uploaded files | MinIO `uploads/{workspace}/` | 365 d, then archive 5 y | Yes | Workspace region; never replicated cross-border without policy. |
| Derived embeddings | Vector store | Linked to source TTL | No | Same as source. |
| LLM traces | Postgres Langfuse | 90 d hot, 1 y cold export | No (PII redacted) | Primary region. |
| Cost / usage rollups | Postgres `app.usage_daily` | 36 months | No | Primary region. |
| Audit log | MinIO `audit/` (object-locked) | 7 y | Yes | Primary region. |
| Secrets | Vault / SSM | Lifetime of credential | n/a | Primary region. |

PII handling: classification on ingest, redaction in `execution-service` before
prompts hit external providers, DSAR (export / erase) job in `worker-service`.

---

## 4. Security and compliance posture

| Control | Requirement | Implementation |
|---|---|---|
| Authentication | OIDC / SSO at the edge | `auth-service` issues short-lived JWT (15 min), refresh in Redis. |
| Authorization | RBAC: `admin`, `developer`, `user`; per-workspace scopes | Enforced at gateway and re-checked per service. |
| Service identity | mTLS between internal services | Mesh (Linkerd or Istio) once on Kubernetes; cert-manager + internal CA. |
| Secrets | No plaintext at rest; rotated every 90 d | Vault / AWS Secrets Manager; sealed-secrets in GitOps repo. |
| Supply chain | Signed images, SBOM, dep scan | cosign + syft + Trivy in CI. |
| Runtime | Pod security baseline, network policies | OPA/Gatekeeper or Kyverno; default-deny network. |
| LLM safety | Prompt injection, tool abuse, output filter | Guardrails service (NeMo Guardrails) in front of `execution-service`. |
| Audit | Immutable, queryable, 7-year retention | Append-only stream to MinIO with object lock; mirrored to SIEM. |
| Privacy | DSAR ≤ 30 days | `worker-service` task triggered by admin endpoint. |

---

## 5. Capacity and cost

| Dimension | Sizing | Cost guardrail |
|---|---|---|
| Concurrent chat sessions | 500 sustained, 2 000 burst | LiteLLM virtual key budgets per workspace. |
| Documents ingested | 50 000 / month, avg 5 MB | TaskIQ concurrency cap; per-workspace daily quota. |
| LLM spend | Tracked daily by workspace, model, env | Hard cap via LiteLLM budget; alert at 80%. |
| Vector store size | 50 M vectors (1536 d) | Sharded; scheduled rebuild job. |
| Storage | 5 TB hot, 50 TB cold | Lifecycle policies; archive after 180 d. |

Cost is allocated by **workspace × environment × model** so finance can
chargeback per business unit; raw provider invoices reconcile monthly.

---

## 6. Environments

| Concern | Dev | Staging | Production |
|---|---|---|---|
| Topology | docker-compose (this repo) | Single-region K8s, 1 AZ | Multi-AZ K8s, multi-region for stateful where listed above |
| Data | synthetic / scrubbed | scrubbed copy of prod (no PII) | live |
| Models | mocked + cheap providers | full provider list, low budget | full list, normal budget |
| Access | engineers only | engineers + selected business reviewers | end users |
| Change control | self-serve | PR review | PR review + change ticket + approver |

---

## 7. Open items / explicit non-goals (today)

- Multi-region active/active for stateful services (Postgres, Vector). Today
  warm-standby in a second AZ; cross-region is documented, not yet wired.
- On-prem provider connectivity (private VPC peering to enterprise systems)
  is in scope but credentials/network plan tracked separately.
- DuckDB analytics surface deferred to phase 2; rollups in Postgres are
  sufficient for the assessment.
