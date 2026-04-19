import { apiGet, apiSend } from "./apiClient";

export const WORKSPACE_POLICIES_CHANGED = "eai-workspace-policies-changed";

function notify(): void {
  window.dispatchEvent(new CustomEvent(WORKSPACE_POLICIES_CHANGED));
}

export type GuardrailPolicy = {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
};

function normalizePolicy(raw: unknown): GuardrailPolicy | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || typeof r.name !== "string") return null;
  return {
    id: r.id,
    name: r.name,
    description: typeof r.description === "string" ? r.description : "",
    enabled: Boolean(r.enabled),
  };
}

export async function listGuardrails(): Promise<GuardrailPolicy[]> {
  const rows = await apiGet<unknown[]>("/api/v1/workspace-policies");
  if (!Array.isArray(rows)) return [];
  return rows.map((r) => normalizePolicy(r)).filter(Boolean) as GuardrailPolicy[];
}

export async function setGuardrailEnabled(id: string, enabled: boolean): Promise<void> {
  const list = await listGuardrails();
  const cur = list.find((p) => p.id === id);
  if (!cur) return;
  await apiSend<unknown>("PUT", "/api/v1/workspace-policies", { id, data: { ...cur, enabled } });
  notify();
}
