/** Chat / embedding / rerank labels for dropdowns — bundled in the SPA only (no network). */
export type LiteLLMModelOption = {
  id: string;
  label: string;
};

const STATIC_MODEL_CATALOG: LiteLLMModelOption[] = [
  { id: "gpt-4o-mini", label: "gpt-4o-mini (demo catalog)" },
  { id: "gpt-4o", label: "gpt-4o (demo catalog)" },
  { id: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet (demo catalog)" },
  { id: "text-embedding-3-small", label: "text-embedding-3-small (demo catalog)" },
  { id: "text-embedding-3-large", label: "text-embedding-3-large (demo catalog)" },
  { id: "rerank-english-v3.0", label: "rerank-english-v3.0 (demo catalog)" },
];

/** Deterministic in-browser catalog — replaces any previous LiteLLM HTTP fetch. */
export function listStaticLiteLLMModels(): LiteLLMModelOption[] {
  return STATIC_MODEL_CATALOG.map((m) => ({ ...m }));
}

/** Heuristic: likely embedding models for RAG dropdowns. */
export function filterEmbeddingLike(models: LiteLLMModelOption[]): LiteLLMModelOption[] {
  const m = models.filter((x) => /embed|embedding|ada-002|e5|bge|voyage/i.test(x.id));
  return m.length ? m : listStaticLiteLLMModels().filter((x) => /embed/i.test(x.id));
}

/** Heuristic: likely rerank models. */
export function filterRerankLike(models: LiteLLMModelOption[]): LiteLLMModelOption[] {
  const m = models.filter((x) => /rerank|rank/i.test(x.id));
  if (m.length) return m;
  const fb = listStaticLiteLLMModels().find((x) => /rerank/i.test(x.id));
  return fb ? [fb] : [];
}
