import { useEffect, useMemo, useState } from "react";

import { KNOWLEDGE_CHANGED, listKnowledgeSorted } from "./knowledgeStorage";

export function useKnowledgeList() {
  const [v, setV] = useState(0);
  useEffect(() => {
    const h = () => setV((x) => x + 1);
    window.addEventListener(KNOWLEDGE_CHANGED, h);
    return () => window.removeEventListener(KNOWLEDGE_CHANGED, h);
  }, []);
  return useMemo(() => listKnowledgeSorted(), [v]);
}
