/** Chat / embedding / rerank labels for dropdowns — bundled in the SPA only (no network). */
export type LiteLLMModelKind = "llm" | "embedding" | "rerank";

export type LiteLLMModelOption = {
  id: string;
  label: string;
  kind: LiteLLMModelKind;
  /** When true, model is shown when “Multi-model only” is selected for agents (LiteLLM-style routing). */
  multiModel?: boolean;
};

const STATIC_MODEL_CATALOG: LiteLLMModelOption[] = [
  { id: "gpt-4o-mini", label: "gpt-4o-mini (demo catalog)", kind: "llm", multiModel: true },
  { id: "gpt-4o", label: "gpt-4o (demo catalog)", kind: "llm", multiModel: true },
  {
    id: "claude-3-5-sonnet-20241022",
    label: "Claude 3.5 Sonnet (demo catalog)",
    kind: "llm",
    multiModel: true,
  },
  { id: "text-embedding-3-small", label: "text-embedding-3-small (demo catalog)", kind: "embedding" },
  { id: "text-embedding-3-large", label: "text-embedding-3-large (demo catalog)", kind: "embedding" },
  { id: "rerank-english-v3.0", label: "rerank-english-v3.0 (demo catalog)", kind: "rerank" },
];

/** Deterministic in-browser catalog — replaces any previous LiteLLM HTTP fetch. */
export function listStaticLiteLLMModels(): LiteLLMModelOption[] {
  return STATIC_MODEL_CATALOG.map((m) => ({ ...m }));
}

/** LLM chat models only (excludes embedding / rerank). */
export function filterLLMModels(models: LiteLLMModelOption[]): LiteLLMModelOption[] {
  return models.filter((x) => x.kind === "llm");
}

/**
 * LLM models for the agent form. When `onlyMultiModel` is true, only entries flagged `multiModel` appear.
 */
export function filterLLMModelsForAgent(
  models: LiteLLMModelOption[],
  onlyMultiModel: boolean,
): LiteLLMModelOption[] {
  const llm = filterLLMModels(models);
  if (!onlyMultiModel) return llm;
  return llm.filter((m) => m.multiModel);
}

/** Embedding models for RAG / ingestion dropdowns. */
export function filterEmbeddingLike(models: LiteLLMModelOption[]): LiteLLMModelOption[] {
  const byKind = models.filter((x) => x.kind === "embedding");
  if (byKind.length) return byKind;
  const m = models.filter((x) => /embed|embedding|ada-002|e5|bge|voyage/i.test(x.id));
  return m.length ? m : listStaticLiteLLMModels().filter((x) => x.kind === "embedding");
}

/** Rerank models. */
export function filterRerankLike(models: LiteLLMModelOption[]): LiteLLMModelOption[] {
  const byKind = models.filter((x) => x.kind === "rerank");
  if (byKind.length) return byKind;
  const m = models.filter((x) => /rerank|rank/i.test(x.id));
  if (m.length) return m;
  const fb = listStaticLiteLLMModels().find((x) => x.kind === "rerank");
  return fb ? [fb] : [];
}
