import { WORKFLOW_CATALOG_CHANGED, loadWorkflowCatalog } from "./workflowCatalog";
import { useRemoteList } from "./useRemoteList";

export function useWorkflowCatalog() {
  return useRemoteList(WORKFLOW_CATALOG_CHANGED, loadWorkflowCatalog);
}
