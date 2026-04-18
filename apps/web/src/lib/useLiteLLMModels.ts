import { useCallback, useEffect, useRef, useState } from "react";

import { apiGet, BACKEND_ENABLED } from "./apiClient";
import type { LiteLLMModelOption } from "./liteLLMModels";

export type LiteLLMModelsState = {
  models: LiteLLMModelOption[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

/** Shape returned by `/api/v1/litellm/models` (OpenAI-compatible /v1/models). */
type OpenAIModelsEntry = {
  id: string;
  object?: string;
  owned_by?: string;
  /** Our api-service sets this from LiteLLM's /model/info so we know chat vs embedding. */
  mode?: "chat" | "completion" | "embedding" | "rerank" | string;
};

/** Offline fallback - keeps dropdowns non-empty when VITE_USE_BACKEND is not set. */
const OFFLINE_FALLBACK: LiteLLMModelOption[] = [
  { id: "gpt-4o-mini", label: "gpt-4o-mini (offline demo)", kind: "llm", multiModel: true },
  { id: "gpt-4o", label: "gpt-4o (offline demo)", kind: "llm", multiModel: true },
  { id: "claude-3-5-sonnet", label: "Claude 3.5 Sonnet (offline demo)", kind: "llm", multiModel: true },
  { id: "text-embedding-3-small", label: "text-embedding-3-small (offline demo)", kind: "embedding" },
  { id: "rerank-english-v3.0", label: "rerank-english-v3.0 (offline demo)", kind: "rerank" },
];

function classify(entry: OpenAIModelsEntry): LiteLLMModelOption {
  const id = entry.id;
  let kind: LiteLLMModelOption["kind"] = "llm";
  if (entry.mode === "embedding" || /embed|embedding|ada-002|e5|bge|voyage/i.test(id)) {
    kind = "embedding";
  } else if (entry.mode === "rerank" || /rerank|rank/i.test(id)) {
    kind = "rerank";
  }
  return { id, label: id, kind, multiModel: kind === "llm" };
}

export function useLiteLLMModels(): LiteLLMModelsState {
  const [models, setModels] = useState<LiteLLMModelOption[]>(() =>
    BACKEND_ENABLED ? [] : [...OFFLINE_FALLBACK],
  );
  const [loading, setLoading] = useState<boolean>(BACKEND_ENABLED);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    if (!BACKEND_ENABLED) {
      setModels([...OFFLINE_FALLBACK]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const payload = await apiGet<OpenAIModelsEntry[] | { data: OpenAIModelsEntry[] }>(
        "/api/v1/litellm/models",
      );
      const list = Array.isArray(payload) ? payload : payload.data ?? [];
      if (mounted.current) setModels(list.map(classify));
    } catch (err) {
      if (mounted.current) {
        setError(err instanceof Error ? err.message : String(err));
        setModels([...OFFLINE_FALLBACK]);
      }
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    return () => {
      mounted.current = false;
    };
  }, [refresh]);

  return { models, loading, error, refresh };
}
