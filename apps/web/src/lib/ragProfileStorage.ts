import { apiDelete, apiGet, apiSend } from "./apiClient";
import type { RagProfile, TextSplitterKind } from "./specTypes";

export const RAG_PROFILES_CHANGED = "eai-rag-profiles-changed";

function notify(): void {
  window.dispatchEvent(new CustomEvent(RAG_PROFILES_CHANGED));
}

function normalizeProfile(raw: unknown): RagProfile | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || typeof r.name !== "string") return null;
  return r as unknown as RagProfile;
}

export async function listRagProfiles(): Promise<RagProfile[]> {
  const rows = await apiGet<unknown[]>("/api/v1/rag-profiles");
  if (!Array.isArray(rows)) return [];
  const list = rows.map(normalizeProfile).filter(Boolean) as RagProfile[];
  return [...list].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getRagProfile(id: string, profiles: RagProfile[]): RagProfile | undefined {
  return profiles.find((x) => x.id === id);
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

export async function createRagProfile(input: {
  name: string;
  description: string;
  createdBy: string;
  partial?: Partial<RagProfile>;
}): Promise<RagProfile> {
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
  await apiSend<unknown>("PUT", "/api/v1/rag-profiles", { id: p.id, data: p });
  notify();
  return p;
}

export async function updateRagProfile(
  id: string,
  actor: string,
  isAdmin: boolean,
  patch: Partial<RagProfile>,
): Promise<boolean> {
  const all = await listRagProfiles();
  const cur = all.find((x) => x.id === id);
  if (!cur) return false;
  if (!isAdmin && cur.createdBy !== actor) return false;
  const now = Date.now();
  const next: RagProfile = {
    ...cur,
    ...patch,
    id: cur.id,
    createdBy: cur.createdBy,
    createdAt: cur.createdAt,
    updatedAt: now,
  };
  await apiSend<unknown>("PUT", "/api/v1/rag-profiles", { id, data: next });
  notify();
  return true;
}

export async function deleteRagProfile(id: string): Promise<void> {
  await apiDelete<unknown>(`/api/v1/rag-profiles/${encodeURIComponent(id)}`);
  notify();
}
