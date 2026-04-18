import { useCallback, useState } from "react";

import { type LiteLLMModelOption, listStaticLiteLLMModels } from "./liteLLMModels";

export type LiteLLMModelsState = {
  models: LiteLLMModelOption[];
  /** Always false — catalog is bundled; no remote fetch. */
  loading: boolean;
  /** Always null — no gateway errors. */
  error: string | null;
  /** Re-applies the bundled catalog (useful after hot reload or tests). */
  refresh: () => Promise<void>;
};

export function useLiteLLMModels(): LiteLLMModelsState {
  const [models, setModels] = useState<LiteLLMModelOption[]>(() => listStaticLiteLLMModels());

  const refresh = useCallback(async () => {
    setModels(listStaticLiteLLMModels());
  }, []);

  return { models, loading: false, error: null, refresh };
}
