/**
 * Typed filter helpers shared by every model dropdown.
 *
 * The actual list of models comes from `useLiteLLMModels()`, which talks to
 * `GET /api/v1/litellm/models` via api-service. When the backend flag is off
 * the hook yields a tiny offline fallback so dev still works.
 */

export type LiteLLMModelKind = "llm" | "embedding" | "rerank";

export type LiteLLMModelOption = {
  id: string;
  label: string;
  kind: LiteLLMModelKind;
  /** When true, model is shown under "Multi-model only" on the agent form. */
  multiModel?: boolean;
};

/** LLM chat models only (excludes embedding / rerank). */
export function filterLLMModels(models: LiteLLMModelOption[]): LiteLLMModelOption[] {
  return models.filter((x) => x.kind === "llm");
}

/** LLM models for the agent form. When `onlyMultiModel` is true, only multi-model entries pass. */
export function filterLLMModelsForAgent(
  models: LiteLLMModelOption[],
  onlyMultiModel: boolean,
): LiteLLMModelOption[] {
  const llm = filterLLMModels(models);
  return onlyMultiModel ? llm.filter((m) => m.multiModel) : llm;
}

/** Embedding models. Heuristic fallback matches names when `kind` isn't set. */
export function filterEmbeddingLike(models: LiteLLMModelOption[]): LiteLLMModelOption[] {
  const byKind = models.filter((x) => x.kind === "embedding");
  if (byKind.length) return byKind;
  return models.filter((x) => /embed|embedding|ada-002|e5|bge|voyage/i.test(x.id));
}

/** Rerank models. Same heuristic fallback pattern (includes Cohere rerank ids). */
export function filterRerankLike(models: LiteLLMModelOption[]): LiteLLMModelOption[] {
  const byKind = models.filter((x) => x.kind === "rerank");
  if (byKind.length) return byKind;
  return models.filter((x) => /rerank|rank|cohere\/rerank/i.test(x.id));
}

/** Cohere rerank models (LiteLLM: `cohere/rerank-*`). Always merged into dropdowns for Python parity. */
const COHERE_RERANK_PRESETS: LiteLLMModelOption[] = [
  { id: "cohere/rerank-english-v3.0", label: "Cohere rerank — English v3.0", kind: "rerank" },
  { id: "cohere/rerank-multilingual-v3.0", label: "Cohere rerank — multilingual v3.0", kind: "rerank" },
];

/** API-returned rerankers plus Cohere presets when those exact ids are missing. */
export function mergeRerankCatalog(models: LiteLLMModelOption[]): LiteLLMModelOption[] {
  const base = filterRerankLike(models);
  const ids = new Set(base.map((m) => m.id.toLowerCase()));
  const out = [...base];
  for (const p of COHERE_RERANK_PRESETS) {
    if (ids.has(p.id.toLowerCase())) continue;
    out.push(p);
    ids.add(p.id.toLowerCase());
  }
  return out;
}
