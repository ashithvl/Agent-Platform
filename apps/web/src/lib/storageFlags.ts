/**
 * Per-area storage migration flags (Phase 5).
 *
 * Each one defaults to off so existing localStorage behaviour keeps working
 * until the matching adapter is wired in and the flag is flipped. The one
 * concrete migration landed in this change is `agents`; the rest are
 * plumbing to keep each subsequent PR tiny.
 */

function flag(name: string): boolean {
  if (typeof import.meta === "undefined") return false;
  return import.meta.env?.[name] === "1";
}

export const STORAGE_AGENTS_BACKEND = flag("VITE_STORAGE_AGENTS");
export const STORAGE_WORKFLOWS_BACKEND = flag("VITE_STORAGE_WORKFLOWS");
export const STORAGE_GUARDRAILS_BACKEND = flag("VITE_STORAGE_GUARDRAILS");
export const STORAGE_KNOWLEDGE_BACKEND = flag("VITE_STORAGE_KNOWLEDGE");
export const STORAGE_RAG_PROFILES_BACKEND = flag("VITE_STORAGE_RAG_PROFILES");
export const STORAGE_CHAT_BACKEND = flag("VITE_STORAGE_CHAT");
