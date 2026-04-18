import type { WorkflowDef } from "../data/workflows";

/** One node in a workflow canvas; the same agent may appear multiple times. */
export type WorkflowFlowStep = {
  id: string;
  agentId: string;
  /** `null` = use agent / platform default at runtime. */
  temperature: number | null;
  topP: number | null;
  topK: number | null;
  /** Empty string = use the agent’s configured model. */
  modelOverride: string;
};

export type CustomWorkflow = WorkflowDef & {
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  flowSteps: WorkflowFlowStep[];
};

const KEY = "eai_custom_workflows_v1";

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

function load(): CustomWorkflow[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const v = JSON.parse(raw) as unknown[];
    if (!Array.isArray(v)) return [];
    return v.map(migrateRow).filter(Boolean) as CustomWorkflow[];
  } catch {
    return [];
  }
}

function save(items: CustomWorkflow[]): void {
  localStorage.setItem(KEY, JSON.stringify(items));
}

export function listCustomWorkflows(): CustomWorkflow[] {
  return load();
}

export function createWorkflow(createdBy: string, name: string, description: string): CustomWorkflow {
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
  const all = load();
  all.push(w);
  save(all);
  return w;
}

export function updateCustomWorkflow(
  id: string,
  patch: { name?: string; description?: string; flowSteps?: WorkflowFlowStep[] },
  username: string,
  isAdmin: boolean,
): boolean {
  const all = load();
  const i = all.findIndex((w) => w.id === id);
  if (i < 0) return false;
  const w = all[i];
  if (!isAdmin && w.createdBy !== username) return false;
  all[i] = {
    ...w,
    ...patch,
    updatedAt: Date.now(),
  };
  save(all);
  return true;
}

export function deleteCustomWorkflow(id: string, username: string, isAdmin: boolean): boolean {
  const all = load();
  const idx = all.findIndex((w) => w.id === id);
  if (idx < 0) return false;
  const w = all[idx];
  if (!isAdmin && w.createdBy !== username) return false;
  all.splice(idx, 1);
  save(all);
  return true;
}

export function isCustomWorkflow(w: WorkflowDef): w is CustomWorkflow {
  return "createdBy" in w && "flowSteps" in w;
}
