import { apiDelete, apiGet, apiSend } from "./apiClient";
import type { McpTransport, Tool, ToolKind } from "./specTypes";

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

export async function listTools(): Promise<Tool[]> {
  const rows = await apiGet<unknown[]>("/api/v1/tools");
  if (!Array.isArray(rows)) return [];
  return rows.map(normalizeTool).filter(Boolean).sort((a, b) => b.createdAt - a.createdAt) as Tool[];
}

function genId(): string {
  return `tool_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function createTool(input: Omit<Tool, "id" | "createdAt">): Promise<Tool> {
  const now = Date.now();
  const t: Tool = { ...input, id: genId(), createdAt: now };
  await apiSend<unknown>("PUT", "/api/v1/tools", { id: t.id, data: t });
  notify();
  return t;
}

export async function deleteTool(id: string): Promise<void> {
  await apiDelete<unknown>(`/api/v1/tools/${encodeURIComponent(id)}`);
  notify();
}
