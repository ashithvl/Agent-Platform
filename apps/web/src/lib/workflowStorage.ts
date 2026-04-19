import type { WorkflowDef } from "../data/workflows";

import { apiDelete, apiGet, apiSend } from "./apiClient";
import { notifyWorkflowCatalogChanged } from "./workflowCatalog";

/** One node in a workflow canvas; the same agent may appear multiple times. */
export type WorkflowFlowStep = {
  id: string;
  agentId: string;
  temperature: number | null;
  topP: number | null;
  topK: number | null;
  modelOverride: string;
};

export type CustomWorkflow = WorkflowDef & {
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  flowSteps: WorkflowFlowStep[];
};

export const DND_AGENT_ID = "application/x-eai-workflow-agent-id";
export const DND_STEP_FROM_INDEX = "application/x-eai-workflow-step-from-index";

export function makeWorkflowFlowStep(agentId: string): WorkflowFlowStep {
  return {
    id: `step_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`,
    agentId,
    temperature: null,
    topP: null,
    topK: null,
    modelOverride: "",
  };
}

function parseFlowSteps(raw: unknown): WorkflowFlowStep[] {
  if (!Array.isArray(raw)) return [];
  const out: WorkflowFlowStep[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    if (typeof r.id !== "string" || typeof r.agentId !== "string") continue;
    out.push({
      id: r.id,
      agentId: r.agentId,
      temperature: typeof r.temperature === "number" && Number.isFinite(r.temperature) ? r.temperature : null,
      topP: typeof r.topP === "number" && Number.isFinite(r.topP) ? r.topP : null,
      topK: typeof r.topK === "number" && Number.isFinite(r.topK) ? Math.round(r.topK) : null,
      modelOverride: typeof r.modelOverride === "string" ? r.modelOverride : "",
    });
  }
  return out;
}

function migrateRow(row: unknown): CustomWorkflow | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  if (typeof r.id !== "string" || typeof r.createdBy !== "string") return null;
  const createdAt = typeof r.createdAt === "number" ? r.createdAt : Date.now();
  const name = typeof r.name === "string" ? r.name : "Untitled workflow";
  const description =
    typeof r.description === "string" ? r.description : "Developer-created workflow.";
  const flowSteps = parseFlowSteps(r.flowSteps);
  const updatedAt = typeof r.updatedAt === "number" ? r.updatedAt : createdAt;
  return { id: r.id, name, description, createdBy: r.createdBy, createdAt, updatedAt, flowSteps };
}

export async function listCustomWorkflows(): Promise<CustomWorkflow[]> {
  const rows = await apiGet<unknown[]>("/api/v1/workflows");
  if (!Array.isArray(rows)) return [];
  return rows.map(migrateRow).filter(Boolean) as CustomWorkflow[];
}

export async function createWorkflow(createdBy: string, name: string, description: string): Promise<CustomWorkflow> {
  const id = `wf_custom_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  const now = Date.now();
  const w: CustomWorkflow = {
    id,
    name: name.trim() || "Untitled workflow",
    description: (description || "").trim() || "Configure agents in order on the workflow canvas.",
    createdBy,
    createdAt: now,
    updatedAt: now,
    flowSteps: [],
  };
  await apiSend<unknown>("PUT", "/api/v1/workflows", { id: w.id, data: w });
  notifyWorkflowCatalogChanged();
  return w;
}

export async function updateCustomWorkflow(
  id: string,
  patch: { name?: string; description?: string; flowSteps?: WorkflowFlowStep[] },
  username: string,
  isAdmin: boolean,
): Promise<boolean> {
  const all = await listCustomWorkflows();
  const w = all.find((x) => x.id === id);
  if (!w) return false;
  if (!isAdmin && w.createdBy !== username) return false;
  const next: CustomWorkflow = {
    ...w,
    ...patch,
    updatedAt: Date.now(),
  };
  await apiSend<unknown>("PUT", "/api/v1/workflows", { id, data: next });
  notifyWorkflowCatalogChanged();
  return true;
}

export async function deleteCustomWorkflow(id: string): Promise<void> {
  await apiDelete<unknown>(`/api/v1/workflows/${encodeURIComponent(id)}`);
  notifyWorkflowCatalogChanged();
}

export function isCustomWorkflow(w: WorkflowDef): w is CustomWorkflow {
  return "createdBy" in w && "flowSteps" in w;
}
