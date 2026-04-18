import type { WorkflowDef } from "../data/workflows";

export type CustomWorkflow = WorkflowDef & {
  createdBy: string;
  createdAt: number;
};

const KEY = "eai_custom_workflows_v1";

function load(): CustomWorkflow[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const v = JSON.parse(raw) as CustomWorkflow[];
    return Array.isArray(v) ? v : [];
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
  const w: CustomWorkflow = {
    id,
    name: name.trim() || "Untitled flow",
    description: (description || "").trim() || "Developer-created workflow.",
    createdBy,
    createdAt: Date.now(),
  };
  const all = load();
  all.push(w);
  save(all);
  return w;
}

export function deleteCustomWorkflow(id: string, username: string, isAdmin: boolean): boolean {
  const all = load();
  const i = all.findIndex((w) => w.id === id);
  if (i < 0) return false;
  const w = all[i];
  if (!isAdmin && w.createdBy !== username) return false;
  all.splice(i, 1);
  save(all);
  return true;
}

export function isCustomWorkflow(w: WorkflowDef): w is CustomWorkflow {
  return "createdBy" in w;
}
