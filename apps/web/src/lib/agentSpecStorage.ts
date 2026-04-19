import { apiDelete, apiGet, apiSend } from "./apiClient";
import type { AgentSpec } from "./specTypes";

export const AGENT_SPECS_CHANGED = "eai-agent-specs-changed";

function notify(): void {
  window.dispatchEvent(new CustomEvent(AGENT_SPECS_CHANGED));
}

function normalizeAgent(raw: unknown): AgentSpec | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || typeof r.name !== "string") return null;

  let contextVariableNames: string[] = [];
  if (Array.isArray(r.contextVariableNames)) {
    contextVariableNames = (r.contextVariableNames as unknown[])
      .map((x) => String(x).trim())
      .filter(Boolean);
  }

  return {
    id: r.id,
    name: r.name,
    model: typeof r.model === "string" ? r.model : "",
    systemPrompt: typeof r.systemPrompt === "string" ? r.systemPrompt : "",
    contextVariableNames,
    toolIds: Array.isArray(r.toolIds) ? [...new Set((r.toolIds as string[]).filter(Boolean))] : [],
    status: r.status === "paused" ? "paused" : "active",
    createdBy: typeof r.createdBy === "string" ? r.createdBy : "unknown",
    createdAt: typeof r.createdAt === "number" ? r.createdAt : Date.now(),
    updatedAt: typeof r.updatedAt === "number" ? r.updatedAt : Date.now(),
  };
}

type BackendListResult = AgentSpec[] | { data: AgentSpec[] };

async function fetchRemoteAgents(): Promise<AgentSpec[]> {
  const payload = await apiGet<BackendListResult>("/api/v1/agents");
  const rows = Array.isArray(payload) ? payload : payload.data ?? [];
  return rows.map((r) => normalizeAgent(r)).filter(Boolean) as AgentSpec[];
}

export async function listAgentSpecs(): Promise<AgentSpec[]> {
  const rows = await fetchRemoteAgents();
  return [...rows].sort((a, b) => b.updatedAt - a.updatedAt);
}

function genId(): string {
  return `ag_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function createAgentSpec(input: {
  name: string;
  model: string;
  systemPrompt: string;
  contextVariableNames: string[];
  toolIds: string[];
  createdBy: string;
  status?: "active" | "paused";
}): Promise<AgentSpec> {
  const now = Date.now();
  const spec: AgentSpec = {
    id: genId(),
    name: input.name.trim() || "Untitled agent",
    model: input.model,
    systemPrompt: input.systemPrompt,
    contextVariableNames: [...new Set(input.contextVariableNames.map((s) => s.trim()).filter(Boolean))],
    toolIds: [...new Set(input.toolIds)],
    status: input.status ?? "active",
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now,
  };
  await apiSend<unknown>("PUT", "/api/v1/agents", { id: spec.id, data: spec });
  notify();
  return spec;
}

export async function updateAgentSpec(
  id: string,
  patch: Partial<
    Pick<AgentSpec, "name" | "model" | "systemPrompt" | "contextVariableNames" | "toolIds" | "status">
  >,
): Promise<AgentSpec | null> {
  const rows = await fetchRemoteAgents();
  const cur = rows.find((x) => x.id === id);
  if (!cur) return null;
  const contextVariableNames =
    patch.contextVariableNames !== undefined
      ? [...new Set(patch.contextVariableNames.map((s) => s.trim()).filter(Boolean))]
      : cur.contextVariableNames;
  const toolIds = patch.toolIds !== undefined ? [...new Set(patch.toolIds)] : cur.toolIds;
  const next: AgentSpec = {
    ...cur,
    ...patch,
    contextVariableNames,
    toolIds,
    id: cur.id,
    createdBy: cur.createdBy,
    createdAt: cur.createdAt,
  };
  await apiSend<unknown>("PUT", "/api/v1/agents", { id, data: next });
  notify();
  return next;
}

export async function deleteAgentSpec(id: string): Promise<void> {
  await apiDelete<unknown>(`/api/v1/agents/${encodeURIComponent(id)}`);
  notify();
}
