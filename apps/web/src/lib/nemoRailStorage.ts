import type { NeMoGuardrailConfig, NeMoPlacement } from "./specTypes";

const KEY = "eai_nemo_rails_v1";
export const NEMO_RAILS_CHANGED = "eai-nemo-rails-changed";

function notify(): void {
  window.dispatchEvent(new CustomEvent(NEMO_RAILS_CHANGED));
}

function readAll(): NeMoGuardrailConfig[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const v = JSON.parse(raw) as NeMoGuardrailConfig[];
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function writeAll(items: NeMoGuardrailConfig[]): void {
  localStorage.setItem(KEY, JSON.stringify(items));
  notify();
}

export function listNeMoRails(): NeMoGuardrailConfig[] {
  return [...readAll()].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getNeMoRail(id: string): NeMoGuardrailConfig | undefined {
  return readAll().find((x) => x.id === id);
}

function genId(): string {
  return `nemo_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createNeMoRail(input: {
  name: string;
  rawConfig: string;
  placement: NeMoPlacement;
  createdBy: string;
}): NeMoGuardrailConfig {
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
  const all = readAll();
  all.push(n);
  writeAll(all);
  return n;
}

export function updateNeMoRail(
  id: string,
  actor: string,
  isAdmin: boolean,
  patch: Partial<Pick<NeMoGuardrailConfig, "name" | "rawConfig" | "placement">>,
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

export function deleteNeMoRail(id: string, actor: string, isAdmin: boolean): boolean {
  const all = readAll();
  const cur = all.find((x) => x.id === id);
  if (!cur) return false;
  if (!isAdmin && cur.createdBy !== actor) return false;
  writeAll(all.filter((x) => x.id !== id));
  return true;
}
