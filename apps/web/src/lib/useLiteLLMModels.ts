import { useCallback, useEffect, useState } from "react";

import { type LiteLLMModelOption, fetchLiteLLMModels } from "./liteLLMModels";

export type LiteLLMModelsState = {
  models: LiteLLMModelOption[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

export function useLiteLLMModels(): LiteLLMModelsState {
  const [models, setModels] = useState<LiteLLMModelOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchLiteLLMModels();
      setModels(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setModels([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { models, loading, error, refresh };
}
