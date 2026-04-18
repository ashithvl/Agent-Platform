/** OpenAI-compatible /v1/models item (LiteLLM). */
export type LiteLLMModelOption = {
  id: string;
  label: string;
};

const FALLBACK: LiteLLMModelOption[] = [
  { id: "gpt-4o-mini", label: "gpt-4o-mini (fallback)" },
  { id: "text-embedding-3-small", label: "text-embedding-3-small (fallback)" },
  { id: "rerank-english-v3.0", label: "rerank-english-v3.0 (fallback)" },
];

export function getLiteLLMBaseUrl(): string {
  const raw = (import.meta.env.VITE_LITELLM_BASE ?? "/litellm").replace(/\/$/, "");
  return raw || "/litellm";
}

export function getLiteLLMApiKey(): string {
  return import.meta.env.VITE_LITELLM_API_KEY ?? "sk-litellm-master-key";
}

export function fallbackModelOptions(): LiteLLMModelOption[] {
  return [...FALLBACK];
}

type ModelsResponse = {
  data?: Array<{ id?: string; owned_by?: string }>;
};

/** Fetch models from LiteLLM; returns fallback on network/parse errors. */
export async function fetchLiteLLMModels(): Promise<LiteLLMModelOption[]> {
  const base = getLiteLLMBaseUrl();
  const url = `${base}/v1/models`;
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${getLiteLLMApiKey()}`,
        Accept: "application/json",
      },
    });
    if (!res.ok) {
      return fallbackModelOptions();
    }
    const json = (await res.json()) as ModelsResponse;
    const rows = json.data;
    if (!Array.isArray(rows) || rows.length === 0) {
      return fallbackModelOptions();
    }
    return rows
      .map((m) => {
        const id = m.id;
        if (!id) return null;
        return { id, label: m.owned_by ? `${id} (${m.owned_by})` : id };
      })
      .filter((x): x is LiteLLMModelOption => x !== null);
  } catch {
    return fallbackModelOptions();
  }
}

/** Heuristic: likely embedding models for RAG dropdowns. */
export function filterEmbeddingLike(models: LiteLLMModelOption[]): LiteLLMModelOption[] {
  const m = models.filter((x) => /embed|embedding|ada-002|e5|bge|voyage/i.test(x.id));
  return m.length ? m : fallbackModelOptions().filter((x) => /embed/i.test(x.id));
}

/** Heuristic: likely rerank models (e.g. Cohere via LiteLLM). */
export function filterRerankLike(models: LiteLLMModelOption[]): LiteLLMModelOption[] {
  const m = models.filter((x) => /rerank|rank/i.test(x.id));
  if (m.length) return m;
  const fb = fallbackModelOptions().find((x) => /rerank/i.test(x.id));
  return fb ? [fb] : [];
}
