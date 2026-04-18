import type { Tool } from "./specTypes";

const KEY = "eai_tools_v1";
export const TOOLS_CHANGED = "eai-tools-changed";

function notify(): void {
  window.dispatchEvent(new CustomEvent(TOOLS_CHANGED));
}

function readAll(): Tool[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const v = JSON.parse(raw) as Tool[];
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function writeAll(items: Tool[]): void {
  localStorage.setItem(KEY, JSON.stringify(items));
  notify();
}

export function listTools(): Tool[] {
  return [...readAll()].sort((a, b) => b.createdAt - a.createdAt);
}

function genId(): string {
  return `tool_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createTool(input: Omit<Tool, "id" | "createdAt">): Tool {
  const now = Date.now();
  const t: Tool = {
    ...input,
    id: genId(),
    createdAt: now,
  };
  const all = readAll();
  all.push(t);
  writeAll(all);
  return t;
}

export function deleteTool(id: string, actor: string, isAdmin: boolean): boolean {
  const all = readAll();
  const cur = all.find((x) => x.id === id);
  if (!cur) return false;
  if (!isAdmin && cur.createdBy !== actor) return false;
  writeAll(all.filter((x) => x.id !== id));
  return true;
}
