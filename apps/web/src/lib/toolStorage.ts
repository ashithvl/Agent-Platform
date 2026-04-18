import type { McpTransport, Tool, ToolKind } from "./specTypes";

const KEY = "eai_tools_v1";
export const TOOLS_CHANGED = "eai-tools-changed";

function notify(): void {
  window.dispatchEvent(new CustomEvent(TOOLS_CHANGED));
}

function inferTransport(raw: Record<string, unknown>): McpTransport {
  if (raw.kind === "http") return "http";

  const explicit = raw.mcpTransport;
  if (explicit === "http" || explicit === "sse") return explicit;

  const legacy = String(raw.transport ?? "").toLowerCase();
  if (legacy === "http") return "http";
  if (legacy === "sse") return "sse";

  return "sse";
}

function normalizeMcpConfigJson(r: Record<string, unknown>): string {
  const raw = r.mcpConfigJson;
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
        return JSON.stringify(parsed, null, 2);
      }
    } catch {
      /* fall through */
    }
  }
  if (typeof r.serverUrl === "string" && r.serverUrl.trim()) {
    return JSON.stringify({ url: r.serverUrl.trim() }, null, 2);
  }
  return JSON.stringify({ url: "" }, null, 2);
}

function normalizeTool(raw: unknown): Tool | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || typeof r.name !== "string") return null;

  const kind: ToolKind = "mcp";
  const mcpTransport = inferTransport(r);
  const mcpConfigJson = normalizeMcpConfigJson(r);

  return {
    id: r.id,
    name: r.name,
    kind,
    description: typeof r.description === "string" ? r.description : "",
    createdBy: typeof r.createdBy === "string" ? r.createdBy : "unknown",
    createdAt: typeof r.createdAt === "number" ? r.createdAt : Date.now(),
    mcpTransport,
    mcpConfigJson,
    headersJson: typeof r.headersJson === "string" && r.headersJson.trim() ? r.headersJson : undefined,
  };
}

function needsPersistMigration(raw: unknown, _normalized: Tool): boolean {
  if (!raw || typeof raw !== "object") return true;
  const r = raw as Record<string, unknown>;
  if (r.kind && r.kind !== "mcp") return true;
  if (typeof r.mcpConfigJson !== "string" || !r.mcpConfigJson.trim()) {
    if (r.serverUrl) return true;
  }
  if (!r.mcpTransport && r.transport) return true;
  return false;
}

function readAll(): Tool[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown[];
    if (!Array.isArray(parsed)) return [];
    let migrated = false;
    const out: Tool[] = [];
    for (const item of parsed) {
      const n = normalizeTool(item);
      if (n) {
        if (needsPersistMigration(item, n)) migrated = true;
        out.push(n);
      }
    }
    if (migrated && out.length) {
      writeAll(out);
    }
    return out;
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
