import type { WorkflowPipeline } from "./specTypes";

const KEY = "eai_workflow_graphs_v1";
export const PIPELINES_CHANGED = "eai-pipelines-changed";

function notify(): void {
  window.dispatchEvent(new CustomEvent(PIPELINES_CHANGED));
}

function readAll(): WorkflowPipeline[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const v = JSON.parse(raw) as WorkflowPipeline[];
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function writeAll(items: WorkflowPipeline[]): void {
  localStorage.setItem(KEY, JSON.stringify(items));
  notify();
}

export function listPipelines(): WorkflowPipeline[] {
  return [...readAll()].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getPipeline(id: string): WorkflowPipeline | undefined {
  return readAll().find((x) => x.id === id);
}

function genId(): string {
  return `pipe_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createPipeline(input: {
  name: string;
  description: string;
  steps: WorkflowPipeline["steps"];
  createdBy: string;
}): WorkflowPipeline {
  const now = Date.now();
  const p: WorkflowPipeline = {
    id: genId(),
    name: input.name.trim() || "Untitled pipeline",
    description: input.description,
    steps: input.steps,
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now,
  };
  const all = readAll();
  all.push(p);
  writeAll(all);
  return p;
}

export function updatePipeline(
  id: string,
  actor: string,
  isAdmin: boolean,
  patch: Partial<Pick<WorkflowPipeline, "name" | "description" | "steps">>,
): boolean {
  const all = readAll();
  const i = all.findIndex((x) => x.id === id);
  if (i < 0) return false;
  const cur = all[i];
  if (!isAdmin && cur.createdBy !== actor) return false;
  const now = Date.now();
  all[i] = { ...cur, ...patch, updatedAt: now };
  writeAll(all);
  return true;
}

export function deletePipeline(id: string, actor: string, isAdmin: boolean): boolean {
  const all = readAll();
  const cur = all.find((x) => x.id === id);
  if (!cur) return false;
  if (!isAdmin && cur.createdBy !== actor) return false;
  writeAll(all.filter((x) => x.id !== id));
  return true;
}
