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

/** Rerank models. Same heuristic fallback pattern. */
export function filterRerankLike(models: LiteLLMModelOption[]): LiteLLMModelOption[] {
  const byKind = models.filter((x) => x.kind === "rerank");
  if (byKind.length) return byKind;
  return models.filter((x) => /rerank|rank/i.test(x.id));
}
