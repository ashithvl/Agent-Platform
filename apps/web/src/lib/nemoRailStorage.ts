import { apiDelete, apiGet, apiSend } from "./apiClient";
import type { NeMoGuardrailConfig, NeMoPlacement } from "./specTypes";

export const NEMO_RAILS_CHANGED = "eai-nemo-rails-changed";

function notify(): void {
  window.dispatchEvent(new CustomEvent(NEMO_RAILS_CHANGED));
}

function normalizeRail(raw: unknown): NeMoGuardrailConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || typeof r.name !== "string") return null;
  const placement = r.placement;
  const p: NeMoPlacement =
    placement === "before_model" || placement === "after_model" || placement === "after_tool"
      ? placement
      : "generic";
  return {
    id: r.id,
    name: r.name,
    rawConfig: typeof r.rawConfig === "string" ? r.rawConfig : "",
    placement: p,
    createdBy: typeof r.createdBy === "string" ? r.createdBy : "unknown",
    createdAt: typeof r.createdAt === "number" ? r.createdAt : Date.now(),
    updatedAt: typeof r.updatedAt === "number" ? r.updatedAt : Date.now(),
  };
}

export async function listNeMoRails(): Promise<NeMoGuardrailConfig[]> {
  const rows = await apiGet<unknown[]>("/api/v1/guardrails");
  if (!Array.isArray(rows)) return [];
  return rows.map((r) => normalizeRail(r)).filter(Boolean).sort((a, b) => b.updatedAt - a.updatedAt) as NeMoGuardrailConfig[];
}

function genId(): string {
  return `nemo_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function createNeMoRail(input: {
  name: string;
  rawConfig: string;
  placement: NeMoPlacement;
  createdBy: string;
}): Promise<NeMoGuardrailConfig> {
  const now = Date.now();
  const n: NeMoGuardrailConfig = {
    id: genId(),
    name: input.name.trim() || "Untitled rail",
    rawConfig: input.rawConfig,
    placement: input.placement,
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now,
  };
  await apiSend<unknown>("PUT", "/api/v1/guardrails", { id: n.id, data: n });
  notify();
  return n;
}

export async function deleteNeMoRail(id: string): Promise<void> {
  await apiDelete<unknown>(`/api/v1/guardrails/${encodeURIComponent(id)}`);
  notify();
}
