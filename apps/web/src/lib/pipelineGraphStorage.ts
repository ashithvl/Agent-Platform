import { apiDelete, apiGet, apiSend } from "./apiClient";
import type { WorkflowPipeline } from "./specTypes";

export const PIPELINES_CHANGED = "eai-pipelines-changed";

function notify(): void {
  window.dispatchEvent(new CustomEvent(PIPELINES_CHANGED));
}

function normalizePipeline(raw: unknown): WorkflowPipeline | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || typeof r.name !== "string") return null;
  return r as unknown as WorkflowPipeline;
}

export async function listPipelines(): Promise<WorkflowPipeline[]> {
  const rows = await apiGet<unknown[]>("/api/v1/pipelines");
  if (!Array.isArray(rows)) return [];
  return rows.map(normalizePipeline).filter(Boolean).sort((a, b) => b.updatedAt - a.updatedAt) as WorkflowPipeline[];
}

function genId(): string {
  return `pipe_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function createPipeline(input: {
  name: string;
  description: string;
  steps: WorkflowPipeline["steps"];
  createdBy: string;
}): Promise<WorkflowPipeline> {
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
  await apiSend<unknown>("PUT", "/api/v1/pipelines", { id: p.id, data: p });
  notify();
  return p;
}

export async function deletePipeline(id: string): Promise<void> {
  await apiDelete<unknown>(`/api/v1/pipelines/${encodeURIComponent(id)}`);
  notify();
}
