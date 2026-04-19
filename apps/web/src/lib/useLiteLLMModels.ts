import { useCallback, useEffect, useRef, useState } from "react";

import { apiGet } from "./apiClient";
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
  const [models, setModels] = useState<LiteLLMModelOption[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
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
        setModels([]);
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
