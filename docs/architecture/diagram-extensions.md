# Diagram extensions

Swimlanes, boundaries, and labels to add to the main draw.io architecture so it
covers the gaps called out in the rubric review (multi-tenancy, data lifecycle,
async vs sync paths, service identity, model lifecycle, correlation tracing).

Each section below describes one diagram overlay. The mermaid blocks are
reference sketches; copy the boxes/edges into the matching draw.io page.

---

## 1. Tenant / workspace boundary and policy enforcement

Wrap end-user resources inside a `Workspace` boundary and mark every place
where a policy is evaluated. Same diagram, three colored badges:

- `A` = Authentication (who you are)
- `Z` = Authorization / RBAC (what you can do)
- `Q` = Quota / rate limit (how much you may do)

```mermaid
flowchart LR
  user[User_or_API_client] -->|"A,Z,Q"| edge[Edge_API_gateway]
  edge --> svc[Service_layer]
  svc -->|"Z,Q"| modelGw[Model_gateway_LiteLLM]
  modelGw --> providers[Provider_OpenAI_Anthropic_etc]

  subgraph workspaceA [Workspace A - Team Platform]
    svc
    dataA[Data_A]
  end
  subgraph workspaceB [Workspace B - Team Sales]
    svcB[Service_layer_B]
    dataB[Data_B]
  end
```

Notes for draw.io:

- Use one rounded rectangle per workspace; never let arrows cross workspace
  boundaries except through the **Edge API gateway** or the **Model gateway**.
- Show **per-tenant** virtual keys / model allowlists at the Model gateway box.

---

## 2. Async ingestion vs synchronous inference

Today the diagram tends to show one happy path. Split it explicitly:

```mermaid
flowchart LR
  subgraph syncPath [Sync inference path]
    spaUser[User] --> apiSvc[api_service] --> exec[execution_service]
    exec --> liteLLM[LiteLLM] --> provSync[Provider]
    exec --> retr[knowledge_service_retrieval]
  end

  subgraph asyncPath [Async ingestion path]
    upload[Upload_endpoint] --> minio[Object_store]
    minio --> queue[TaskIQ_queue_Redis]
    queue --> ingest[ingestion_worker]
    ingest --> ocr[OCR_PyMuPDF_Surya]
    ocr --> embed[Embeddings_via_LiteLLM]
    embed --> vec[Vector_store_LanceDB_pgvector]
  end

  retr --> vec
```

Notes:

- Annotate **SLOs** on the sync path (e.g. p95 chat ≤ 4s) and **throughput**
  on the async path (e.g. 200 docs/min sustained).
- Mark **idempotency keys** on `upload`, `queue`, and `ingest`.

---

## 3. Data lifecycle swimlane

Add a horizontal lifecycle band underneath the layers diagram:

```mermaid
flowchart LR
  ingestStage[Ingest] --> processStage[Process_redact_classify]
  processStage --> storeStage[Store_with_TTL_and_legal_hold]
  storeStage --> deriveStage[Derive_embeddings_summaries_traces]
  deriveStage --> exportStage[Export_or_erase_DSAR]
```

Annotations to put on each store in the diagram:

- `Postgres operational`: PII columns flagged, daily backup, 35-day PITR, RPO 5m / RTO 30m.
- `Postgres Langfuse`: trace TTL 90 days, monthly export to cold storage.
- `MinIO/S3`: object-lock for `audit/`, lifecycle to Glacier after 180 days.
- `Vector store`: rebuildable from sources; no PII; nightly snapshot.

---

## 4. Service identity (mTLS) east-west

Distinguish **human identity** (SSO/OIDC) at the edge from **service identity**
between internal services:

```mermaid
flowchart LR
  subgraph edgeBoundary [Edge - human identity]
    sso[SSO_OIDC] --> apiGw[Edge_gateway]
  end
  subgraph internalMesh [Internal mesh - service identity]
    apiGw -. mTLS .-> apiSvcId[api_service]
    apiSvcId -. mTLS .-> agentSvc[agent_service]
    apiSvcId -. mTLS .-> execSvc[execution_service]
    execSvc -. mTLS .-> liteLLMid[LiteLLM]
    execSvc -. mTLS .-> langfuseId[Langfuse]
  end
```

Notes:

- Label the mesh (Linkerd / Istio / consul-connect) and the certificate issuer
  (e.g. cert-manager + an internal CA).
- Mark **break-glass** access with a dashed line from an `OpsAdmin` actor into
  the mesh through a bastion / SSM Session.

---

## 5. Model lifecycle (staging, eval, promotion)

Models move through environments before they appear in production dropdowns:

```mermaid
flowchart LR
  reg[Model_registry_LiteLLM_admin] --> staging[Staging_alias]
  staging --> evalH[Eval_harness_RAG_quality_safety_cost]
  evalH -->|pass| canary[Canary_5_pct_traffic]
  canary -->|metrics ok| prod[Production_alias]
  canary -->|regression| rollback[Rollback]
  prod --> users[All_users]
```

Notes:

- Annotate **who** can move from staging to canary (Platform Admin) vs canary
  to prod (Platform Admin + 1 approver).
- Wire the eval harness output into the **Audit log**.

---

## 6. Correlation tracing across services

Add one `correlation_id` column on every box and one shared collector:

```mermaid
flowchart LR
  client[Client_request] -->|"X-Request-Id"| edgeC[Edge_gateway]
  edgeC -->|"trace_id propagated"| apiC[api_service]
  apiC -->|"trace_id"| execC[execution_service]
  execC -->|"trace_id"| liteC[LiteLLM]
  execC -->|"trace_id metadata"| lfC[Langfuse]
  apiC --> otel[OpenTelemetry_collector]
  execC --> otel
  liteC --> otel
  otel --> obs[Tempo_Loki_Prometheus]
  lfC --> obs
```

Notes:

- The `trace_id` injected by the gateway should equal the Langfuse `trace.id`
  used by `execution-service`, so a single ID joins **HTTP traces**,
  **logs**, and **LLM traces**.

---

## How to apply these in draw.io

1. Open the existing six-layer diagram.
2. Add a new page per overlay above (named after the section).
3. Cross-reference with link arrows back to the boxes on the main page.
4. Keep the legend (`A` / `Z` / `Q` badges, mTLS dashed line, lifecycle band)
   on a small sidebar so reviewers don't have to guess.
