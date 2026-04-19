import { WORKFLOWS, type WorkflowDef } from "../data/workflows";

import { listCustomWorkflows, type CustomWorkflow } from "./workflowStorage";

export const WORKFLOW_CATALOG_CHANGED = "eai-workflow-catalog-changed";

export function notifyWorkflowCatalogChanged(): void {
  window.dispatchEvent(new CustomEvent(WORKFLOW_CATALOG_CHANGED));
}

/** Built-in platform workflows plus custom workflows from the API. */
export async function loadWorkflowCatalog(): Promise<(WorkflowDef | CustomWorkflow)[]> {
  const custom = await listCustomWorkflows();
  return [...WORKFLOWS, ...custom];
}
