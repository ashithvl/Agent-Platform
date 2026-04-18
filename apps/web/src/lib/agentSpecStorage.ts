import { apiDelete, apiGet, apiSend } from "./apiClient";
import type { AgentSpec } from "./specTypes";
import { STORAGE_AGENTS_BACKEND } from "./storageFlags";

const KEY = "eai_agent_specs_v1";
export const AGENT_SPECS_CHANGED = "eai-agent-specs-changed";

function notify(): void {
  window.dispatchEvent(new CustomEvent(AGENT_SPECS_CHANGED));
}

const SEED: AgentSpec[] = [
  {
    id: "ag-gpt",
    name: "General Assistant",
    model: "gpt-4o-mini",
    systemPrompt: "You are a helpful assistant for the enterprise workspace.",
    contextVariableNames: [],
    toolIds: [],
    status: "active",
    createdBy: "system",
    createdAt: 1,
    updatedAt: 1,
  },
  {
    id: "ag-doc",
    name: "Document RAG",
    model: "gpt-4o-mini",
    systemPrompt: "You answer using retrieved context when provided.",
    contextVariableNames: ["rag_context", "user_query"],
    toolIds: [],
    status: "active",
    createdBy: "system",
    createdAt: 1,
    updatedAt: 1,
  },
  {
    id: "ag-guard",
    name: "Policy Sentinel",
    model: "gpt-4o-mini",
    systemPrompt: "You validate outputs against policy snippets.",
    contextVariableNames: [],
    toolIds: [],
    status: "paused",
    createdBy: "system",
    createdAt: 1,
    updatedAt: 1,
  },
];

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

function isLegacyAgentShape(raw: unknown): boolean {
  if (!raw || typeof raw !== "object") return false;
  return "contextStrategy" in raw || "contextNotes" in raw;
}

function readAll(): AgentSpec[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      localStorage.setItem(KEY, JSON.stringify(SEED));
      return [...SEED];
    }
    const parsed = JSON.parse(raw) as unknown[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      localStorage.setItem(KEY, JSON.stringify(SEED));
      return [...SEED];
    }
    const normalized = parsed.map((item) => normalizeAgent(item)).filter(Boolean) as AgentSpec[];
    const legacy = parsed.some((item) => isLegacyAgentShape(item));
    if (legacy || normalized.length !== parsed.length) {
      writeAll(normalized.length ? normalized : [...SEED]);
    }
    return (normalized.length ? normalized : [...SEED]).sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    localStorage.setItem(KEY, JSON.stringify(SEED));
    return [...SEED];
  }
}

function writeAll(items: AgentSpec[]): void {
  localStorage.setItem(KEY, JSON.stringify(items));
  notify();
}

export function listAgentSpecs(): AgentSpec[] {
  return [...readAll()].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getAgentSpec(id: string): AgentSpec | undefined {
  return readAll().find((a) => a.id === id);
}

function genId(): string {
  return `ag_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createAgentSpec(input: {
  name: string;
  model: string;
  systemPrompt: string;
  contextVariableNames: string[];
  toolIds: string[];
  createdBy: string;
  status?: "active" | "paused";
}): AgentSpec {
  const now = Date.now();
  const a: AgentSpec = {
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
  const all = readAll();
  all.push(a);
  writeAll(all);
  return a;
}

export function updateAgentSpec(
  id: string,
  actor: string,
  isAdmin: boolean,
  patch: Partial<
    Pick<AgentSpec, "name" | "model" | "systemPrompt" | "contextVariableNames" | "toolIds" | "status">
  >,
): boolean {
  const all = readAll();
  const i = all.findIndex((x) => x.id === id);
  if (i < 0) return false;
  const cur = all[i];
  if (!isAdmin && cur.createdBy !== actor) return false;
  const now = Date.now();
  all[i] = {
    ...cur,
    ...patch,
    contextVariableNames:
      patch.contextVariableNames !== undefined
        ? [...new Set(patch.contextVariableNames.map((s) => s.trim()).filter(Boolean))]
        : cur.contextVariableNames,
    toolIds: patch.toolIds !== undefined ? [...new Set(patch.toolIds)] : cur.toolIds,
    updatedAt: now,
  };
  writeAll(all);
  return true;
}

export function deleteAgentSpec(id: string, actor: string, isAdmin: boolean): boolean {
  const all = readAll();
  const cur = all.find((x) => x.id === id);
  if (!cur) return false;
  if (cur.createdBy === "system") return false;
  if (!isAdmin && cur.createdBy !== actor) return false;
  writeAll(all.filter((x) => x.id !== id));
  return true;
}

// ---------------------------------------------------------------------------
// Phase 5 backend adapters.
// Gated on VITE_STORAGE_AGENTS=1. Callers that want the migrated path use
// the `*Async` variants; the sync ones above stay on localStorage for anyone
// who hasn't adopted the flag yet.
// ---------------------------------------------------------------------------

type BackendListResult = AgentSpec[] | { data: AgentSpec[] };

async function fetchRemoteAgents(): Promise<AgentSpec[]> {
  const payload = await apiGet<BackendListResult>("/api/v1/agents");
  const rows = Array.isArray(payload) ? payload : payload.data ?? [];
  return rows.map((r) => normalizeAgent(r)).filter(Boolean) as AgentSpec[];
}

export async function listAgentSpecsAsync(): Promise<AgentSpec[]> {
  if (!STORAGE_AGENTS_BACKEND) return listAgentSpecs();
  const rows = await fetchRemoteAgents();
  return [...rows].sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function createAgentSpecAsync(input: {
  name: string;
  model: string;
  systemPrompt: string;
  contextVariableNames: string[];
  toolIds: string[];
  createdBy: string;
  status?: "active" | "paused";
}): Promise<AgentSpec> {
  if (!STORAGE_AGENTS_BACKEND) return createAgentSpec(input);
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

export async function deleteAgentSpecAsync(id: string): Promise<boolean> {
  if (!STORAGE_AGENTS_BACKEND) {
    // Without backend we still need actor info; callers use the sync path.
    throw new Error("deleteAgentSpecAsync requires VITE_STORAGE_AGENTS=1");
  }
  await apiDelete<unknown>(`/api/v1/agents/${encodeURIComponent(id)}`);
  notify();
  return true;
}
