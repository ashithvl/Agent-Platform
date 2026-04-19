import { apiDelete, apiGet, apiSend } from "./apiClient";

/**
 * Knowledge hubs — persisted in knowledge-service (Postgres JSONB).
 */

export type HubAudience = "end_user" | "developer" | "admin";

export type ExtractionLibrary =
  | "auto"
  | "pymupdf"
  | "surya"
  | "pymupdf_surya"
  | "plain_text"
  | "placeholder_av";

export type IndexingMode = "chunked_semantic" | "document_level" | "unspecified";

export type KnowledgeSource = {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  addedAt: number;
  textPreview?: string;
};

export type MetadataPair = { key: string; value: string };

export type KnowledgeItem = {
  id: string;
  title: string;
  description: string;
  ownerUsername: string;
  audiences: HubAudience[];
  complianceNotes: string[];
  createdAt: number;
  updatedAt: number;
  sources: KnowledgeSource[];
  ocrEnabled: boolean;
  extractionLibrary: ExtractionLibrary;
  extractionByMime?: Record<string, ExtractionLibrary>;
  indexingMode: IndexingMode;
  metadataRequired: boolean;
  metadataPairs: MetadataPair[];
};

export const KNOWLEDGE_CHANGED = "eai-knowledge-changed";

const MAX_TEXT_PREVIEW_CHARS = 120_000;

function notify(): void {
  window.dispatchEvent(new CustomEvent(KNOWLEDGE_CHANGED));
}

function migrateRow(raw: Record<string, unknown>): KnowledgeItem {
  const approvalsLegacy = raw.approvals;
  const complianceNotesRaw = raw.complianceNotes;
  const compliance =
    Array.isArray(complianceNotesRaw) && (complianceNotesRaw as unknown[]).length > 0
      ? (complianceNotesRaw as string[]).map(String)
      : Array.isArray(approvalsLegacy)
        ? (approvalsLegacy as string[]).map(String)
        : [];

  const sourcesRaw = raw.sources;
  const sources: KnowledgeSource[] = Array.isArray(sourcesRaw)
    ? (sourcesRaw as Record<string, unknown>[]).map((s) => ({
        id: String(s.id ?? `src_${Math.random().toString(36).slice(2)}`),
        name: String(s.name ?? "file"),
        mimeType: String(s.mimeType ?? "application/octet-stream"),
        sizeBytes: Number(s.sizeBytes ?? 0),
        addedAt: Number(s.addedAt ?? Date.now()),
        textPreview: typeof s.textPreview === "string" ? s.textPreview : undefined,
      }))
    : [];

  const extractionLibrary = (raw.extractionLibrary as ExtractionLibrary) || "auto";
  const indexingMode = (raw.indexingMode as IndexingMode) || "unspecified";

  return {
    id: String(raw.id),
    title: String(raw.title ?? "Untitled"),
    description: String(raw.description ?? ""),
    ownerUsername: String(raw.ownerUsername ?? "unknown"),
    audiences: Array.isArray(raw.audiences) ? (raw.audiences as HubAudience[]) : [],
    complianceNotes: compliance.map((s) => s.trim()).filter(Boolean),
    createdAt: Number(raw.createdAt ?? Date.now()),
    updatedAt: Number(raw.updatedAt ?? Date.now()),
    sources,
    ocrEnabled: Boolean(raw.ocrEnabled),
    extractionLibrary: ["auto", "pymupdf", "surya", "pymupdf_surya", "plain_text", "placeholder_av"].includes(
      extractionLibrary,
    )
      ? extractionLibrary
      : "auto",
    extractionByMime:
      raw.extractionByMime && typeof raw.extractionByMime === "object"
        ? (raw.extractionByMime as Record<string, ExtractionLibrary>)
        : undefined,
    indexingMode: ["chunked_semantic", "document_level", "unspecified"].includes(indexingMode)
      ? indexingMode
      : "unspecified",
    metadataRequired: Boolean(raw.metadataRequired),
    metadataPairs: Array.isArray(raw.metadataPairs)
      ? (raw.metadataPairs as Record<string, unknown>[]).map((p) => ({
          key: String(p.key ?? "").trim(),
          value: String(p.value ?? "").trim(),
        }))
      : [],
  };
}

export async function listKnowledgeSorted(): Promise<KnowledgeItem[]> {
  const rows = await apiGet<unknown[]>("/api/v1/hubs");
  if (!Array.isArray(rows)) return [];
  return rows
    .map((r) => migrateRow(r as Record<string, unknown>))
    .sort((a, b) => b.updatedAt - a.updatedAt);
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

export function extractionLabel(lib: ExtractionLibrary): string {
  switch (lib) {
    case "auto":
      return "Auto (by MIME)";
    case "pymupdf":
      return "PyMuPDF";
    case "surya":
      return "Surya (layout / OCR)";
    case "pymupdf_surya":
      return "PyMuPDF + Surya";
    case "plain_text":
      return "Plain text only";
    case "placeholder_av":
      return "Audio / video (transcribe — planned)";
    default:
      return lib;
  }
}

export function indexingLabel(m: IndexingMode): string {
  switch (m) {
    case "chunked_semantic":
      return "Chunked → vectors";
    case "document_level":
      return "One vector per document";
    case "unspecified":
      return "Unspecified";
    default:
      return m;
  }
}

async function fileToSource(f: File): Promise<KnowledgeSource> {
  const id = `src_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const base: KnowledgeSource = {
    id,
    name: f.name,
    mimeType: f.type || "application/octet-stream",
    sizeBytes: f.size,
    addedAt: Date.now(),
  };
  const isTextLike =
    f.type.startsWith("text/") ||
    f.type === "application/json" ||
    /\.(txt|md|csv|json|log)$/i.test(f.name);
  if (isTextLike && f.size <= MAX_TEXT_PREVIEW_CHARS * 2) {
    try {
      const text = await f.text();
      base.textPreview = text.slice(0, MAX_TEXT_PREVIEW_CHARS);
    } catch {
      /* ignore */
    }
  }
  return base;
}

export async function filesToSources(files: File[]): Promise<KnowledgeSource[]> {
  return Promise.all(Array.from(files).map((f) => fileToSource(f)));
}

export async function createKnowledgeItem(input: {
  ownerUsername: string;
  title: string;
  description: string;
  audiences: HubAudience[];
  complianceNotes: string[];
  sources: KnowledgeSource[];
  ocrEnabled: boolean;
  extractionLibrary: ExtractionLibrary;
  extractionByMime?: Record<string, ExtractionLibrary>;
  indexingMode: IndexingMode;
  metadataRequired: boolean;
  metadataPairs: MetadataPair[];
}): Promise<KnowledgeItem> {
  const now = Date.now();
  const item: KnowledgeItem = {
    id: genId(),
    title: input.title.trim() || "Untitled hub",
    description: (input.description || "").trim(),
    ownerUsername: input.ownerUsername,
    audiences: [...new Set(input.audiences)],
    complianceNotes: input.complianceNotes.map((s) => s.trim()).filter(Boolean),
    createdAt: now,
    updatedAt: now,
    sources: input.sources,
    ocrEnabled: input.ocrEnabled,
    extractionLibrary: input.extractionLibrary,
    extractionByMime: input.extractionByMime,
    indexingMode: input.indexingMode,
    metadataRequired: input.metadataRequired,
    metadataPairs: input.metadataPairs.filter((p) => p.key.length > 0),
  };
  await apiSend<unknown>("PUT", "/api/v1/hubs", { id: item.id, data: item });
  notify();
  return item;
}

export async function updateKnowledgeAudiences(id: string, audiences: HubAudience[]): Promise<void> {
  const all = await listKnowledgeSorted();
  const cur = all.find((x) => x.id === id);
  if (!cur) return;
  const next: KnowledgeItem = { ...cur, audiences: [...new Set(audiences)], updatedAt: Date.now() };
  await apiSend<unknown>("PUT", "/api/v1/hubs", { id, data: next });
  notify();
}

export async function updateKnowledgeItem(
  id: string,
  actorUsername: string,
  isAdmin: boolean,
  patch: {
    title?: string;
    description?: string;
    complianceNotes?: string[];
    audiences?: HubAudience[];
    sources?: KnowledgeSource[];
    ocrEnabled?: boolean;
    extractionLibrary?: ExtractionLibrary;
    indexingMode?: IndexingMode;
    metadataRequired?: boolean;
    metadataPairs?: MetadataPair[];
  },
): Promise<boolean> {
  const all = await listKnowledgeSorted();
  const cur = all.find((x) => x.id === id);
  if (!cur) return false;
  if (!isAdmin && cur.ownerUsername !== actorUsername) return false;
  const now = Date.now();
  const next: KnowledgeItem = {
    ...cur,
    title: patch.title !== undefined ? patch.title.trim() || cur.title : cur.title,
    description: patch.description !== undefined ? patch.description : cur.description,
    complianceNotes:
      patch.complianceNotes !== undefined
        ? patch.complianceNotes.map((s) => s.trim()).filter(Boolean)
        : cur.complianceNotes,
    audiences: patch.audiences !== undefined ? [...new Set(patch.audiences)] : cur.audiences,
    sources: patch.sources !== undefined ? patch.sources : cur.sources,
    ocrEnabled: patch.ocrEnabled !== undefined ? patch.ocrEnabled : cur.ocrEnabled,
    extractionLibrary: patch.extractionLibrary ?? cur.extractionLibrary,
    indexingMode: patch.indexingMode ?? cur.indexingMode,
    metadataRequired: patch.metadataRequired !== undefined ? patch.metadataRequired : cur.metadataRequired,
    metadataPairs:
      patch.metadataPairs !== undefined ? patch.metadataPairs.filter((p) => p.key.length > 0) : cur.metadataPairs,
    updatedAt: now,
  };
  await apiSend<unknown>("PUT", "/api/v1/hubs", { id, data: next });
  notify();
  return true;
}

export async function deleteKnowledgeItem(id: string): Promise<void> {
  await apiDelete<unknown>(`/api/v1/hubs/${encodeURIComponent(id)}`);
  notify();
}
