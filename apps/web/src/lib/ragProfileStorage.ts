import type { RagProfile, TextSplitterKind } from "./specTypes";

const KEY = "eai_rag_profiles_v1";
export const RAG_PROFILES_CHANGED = "eai-rag-profiles-changed";

function notify(): void {
  window.dispatchEvent(new CustomEvent(RAG_PROFILES_CHANGED));
}

function readAll(): RagProfile[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const v = JSON.parse(raw) as RagProfile[];
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function writeAll(items: RagProfile[]): void {
  localStorage.setItem(KEY, JSON.stringify(items));
  notify();
}

export function listRagProfiles(): RagProfile[] {
  return [...readAll()].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getRagProfile(id: string): RagProfile | undefined {
  return readAll().find((x) => x.id === id);
}

function genId(): string {
  return `rag_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

const defaultRag = (): Omit<RagProfile, "id" | "name" | "description" | "createdBy" | "createdAt" | "updatedAt"> => ({
  knowledgeItemIds: [],
  embeddingModel: "text-embedding-3-small",
  chunkSize: 512,
  chunkOverlap: 64,
  splitter: "recursive" as TextSplitterKind,
  vectorStore: "lancedb",
  retrievalSemantic: true,
  retrievalHybrid: false,
  retrievalMetadata: false,
  hybridAlpha: 0.5,
  hybridDedup: true,
  hybridReciprocalRankFusion: false,
  useReranker: false,
  rerankModel: "",
});

export function createRagProfile(input: {
  name: string;
  description: string;
  createdBy: string;
  partial?: Partial<RagProfile>;
}): RagProfile {
  const now = Date.now();
  const base = defaultRag();
  const p: RagProfile = {
    ...base,
    ...input.partial,
    id: genId(),
    name: input.name.trim() || "Untitled profile",
    description: input.description,
    knowledgeItemIds: input.partial?.knowledgeItemIds ?? [],
    embeddingModel: input.partial?.embeddingModel ?? base.embeddingModel,
    rerankModel: input.partial?.rerankModel ?? "",
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now,
  };
  const all = readAll();
  all.push(p);
  writeAll(all);
  return p;
}

export function updateRagProfile(id: string, actor: string, isAdmin: boolean, patch: Partial<RagProfile>): boolean {
  const all = readAll();
  const i = all.findIndex((x) => x.id === id);
  if (i < 0) return false;
  const cur = all[i];
  if (!isAdmin && cur.createdBy !== actor) return false;
  const now = Date.now();
  all[i] = { ...cur, ...patch, id: cur.id, createdBy: cur.createdBy, createdAt: cur.createdAt, updatedAt: now };
  writeAll(all);
  return true;
}

export function deleteRagProfile(id: string, actor: string, isAdmin: boolean): boolean {
  const all = readAll();
  const cur = all.find((x) => x.id === id);
  if (!cur) return false;
  if (!isAdmin && cur.createdBy !== actor) return false;
  writeAll(all.filter((x) => x.id !== id));
  return true;
}
