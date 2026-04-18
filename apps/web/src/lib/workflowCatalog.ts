import { WORKFLOWS, type WorkflowDef } from "../data/workflows";

import { listCustomWorkflows, type CustomWorkflow } from "./workflowStorage";

export const WORKFLOW_CATALOG_CHANGED = "eai-workflow-catalog-changed";

export function notifyWorkflowCatalogChanged(): void {
  window.dispatchEvent(new CustomEvent(WORKFLOW_CATALOG_CHANGED));
}

/** Built-in platform workflows plus any saved in this browser. */
export function getAllWorkflows(): (WorkflowDef | CustomWorkflow)[] {
  return [...WORKFLOWS, ...listCustomWorkflows()];
}

export function workflowById(id: string | undefined): (WorkflowDef | CustomWorkflow) | undefined {
  if (!id) return undefined;
  return getAllWorkflows().find((w) => w.id === id);
}
