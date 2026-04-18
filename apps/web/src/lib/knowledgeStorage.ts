/**
 * Knowledge hubs: multiple items per owner; each item tracks audience cohorts and many "approvals".
 * Persisted in localStorage (demo).
 */

export type HubAudience = "end_user" | "developer" | "admin";

export type KnowledgeItem = {
  id: string;
  title: string;
  description: string;
  ownerUsername: string;
  /** Which user groups this hub is for (admin can edit any row). */
  audiences: HubAudience[];
  /** Multiple approved artefacts / policy lines. */
  approvals: string[];
  createdAt: number;
  updatedAt: number;
};

const KEY = "eai_knowledge_items_v1";

export const KNOWLEDGE_CHANGED = "eai-knowledge-changed";

function notify(): void {
  window.dispatchEvent(new CustomEvent(KNOWLEDGE_CHANGED));
}

function defaultSeed(): KnowledgeItem[] {
  const now = Date.now();
  return [
    {
      id: "kh_seed_platform",
      title: "Platform runbooks",
      description: "Shared operational context for builders.",
      ownerUsername: "admin",
      audiences: ["developer", "admin"],
      approvals: ["Incident template v1", "SLO definitions", "Rollback checklist"],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "kh_seed_user",
      title: "End-user help center",
      description: "Customer-facing snippets and safe answers.",
      ownerUsername: "admin",
      audiences: ["end_user"],
      approvals: ["Brand voice 2025", "Refund policy summary"],
      createdAt: now,
      updatedAt: now,
    },
  ];
}

function readAll(): KnowledgeItem[] {
  const raw = localStorage.getItem(KEY);
  if (!raw) {
    const s = defaultSeed();
    localStorage.setItem(KEY, JSON.stringify(s));
    return s;
  }
  try {
    const v = JSON.parse(raw) as KnowledgeItem[];
    if (!Array.isArray(v) || v.length === 0) {
      const s = defaultSeed();
      localStorage.setItem(KEY, JSON.stringify(s));
      return s;
    }
    return v;
  } catch {
    const s = defaultSeed();
    localStorage.setItem(KEY, JSON.stringify(s));
    return s;
  }
}

function writeAll(items: KnowledgeItem[]): void {
  localStorage.setItem(KEY, JSON.stringify(items));
  notify();
}

export function listKnowledgeSorted(): KnowledgeItem[] {
  return [...readAll()].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function audienceLabel(a: HubAudience): string {
  switch (a) {
    case "end_user":
      return "End user";
    case "developer":
      return "Developer";
    case "admin":
      return "Admin";
    default:
      return a;
  }
}

function genId(): string {
  return `kh_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createKnowledgeItem(input: {
  ownerUsername: string;
  title: string;
  description: string;
  audiences: HubAudience[];
  approvals: string[];
}): KnowledgeItem {
  const now = Date.now();
  const item: KnowledgeItem = {
    id: genId(),
    title: input.title.trim() || "Untitled hub",
    description: (input.description || "").trim(),
    ownerUsername: input.ownerUsername,
    audiences: input.audiences.length ? [...new Set(input.audiences)] : ["developer"],
    approvals: input.approvals.map((s) => s.trim()).filter(Boolean),
    createdAt: now,
    updatedAt: now,
  };
  const all = readAll();
  all.push(item);
  writeAll(all);
  return item;
}

export function updateKnowledgeAudiences(id: string, audiences: HubAudience[]): void {
  const all = readAll();
  const i = all.findIndex((x) => x.id === id);
  if (i < 0) return;
  const now = Date.now();
  all[i] = { ...all[i], audiences: [...new Set(audiences)], updatedAt: now };
  writeAll(all);
}

export function updateKnowledgeItem(
  id: string,
  actorUsername: string,
  isAdmin: boolean,
  patch: { title?: string; description?: string; approvals?: string[]; audiences?: HubAudience[] },
): boolean {
  const all = readAll();
  const i = all.findIndex((x) => x.id === id);
  if (i < 0) return false;
  const cur = all[i];
  if (!isAdmin && cur.ownerUsername !== actorUsername) return false;
  const now = Date.now();
  all[i] = {
    ...cur,
    title: patch.title !== undefined ? patch.title.trim() || cur.title : cur.title,
    description: patch.description !== undefined ? patch.description : cur.description,
    approvals: patch.approvals !== undefined ? patch.approvals.map((s) => s.trim()).filter(Boolean) : cur.approvals,
    audiences: patch.audiences !== undefined ? [...new Set(patch.audiences)] : cur.audiences,
    updatedAt: now,
  };
  writeAll(all);
  return true;
}

export function deleteKnowledgeItem(id: string, actorUsername: string, isAdmin: boolean): boolean {
  const all = readAll();
  const cur = all.find((x) => x.id === id);
  if (!cur) return false;
  if (!isAdmin && cur.ownerUsername !== actorUsername) return false;
  writeAll(all.filter((x) => x.id !== id));
  return true;
}
