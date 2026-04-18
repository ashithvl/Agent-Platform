import type { AgentSpec, ContextStrategy } from "./specTypes";

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
    contextStrategy: "passthrough",
    contextNotes: "",
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
    contextStrategy: "from_previous_step",
    contextNotes: "Expect prior RAG step output in the thread.",
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
    contextStrategy: "templated",
    contextNotes: "",
    toolIds: [],
    status: "paused",
    createdBy: "system",
    createdAt: 1,
    updatedAt: 1,
  },
];

function readAll(): AgentSpec[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      localStorage.setItem(KEY, JSON.stringify(SEED));
      return [...SEED];
    }
    const v = JSON.parse(raw) as AgentSpec[];
    if (!Array.isArray(v) || v.length === 0) {
      localStorage.setItem(KEY, JSON.stringify(SEED));
      return [...SEED];
    }
    return v;
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
  contextStrategy: ContextStrategy;
  contextNotes: string;
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
    contextStrategy: input.contextStrategy,
    contextNotes: input.contextNotes,
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
    Pick<AgentSpec, "name" | "model" | "systemPrompt" | "contextStrategy" | "contextNotes" | "toolIds" | "status">
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
