import { useEffect, useMemo, useState } from "react";

import { WORKFLOW_CATALOG_CHANGED, getAllWorkflows } from "./workflowCatalog";

export function useWorkflowCatalog() {
  const [v, setV] = useState(0);
  useEffect(() => {
    const h = () => setV((x) => x + 1);
    window.addEventListener(WORKFLOW_CATALOG_CHANGED, h);
    return () => window.removeEventListener(WORKFLOW_CATALOG_CHANGED, h);
  }, []);
  return useMemo(() => getAllWorkflows(), [v]);
}
