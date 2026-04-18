/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** When "1", SPA talks to auth-service / api-service instead of localStorage. */
  readonly VITE_USE_BACKEND?: string;

  /** Phase 5 per-area storage flags. "1" = use api-service; unset = localStorage. */
  readonly VITE_STORAGE_AGENTS?: string;
  readonly VITE_STORAGE_WORKFLOWS?: string;
  readonly VITE_STORAGE_GUARDRAILS?: string;
  readonly VITE_STORAGE_KNOWLEDGE?: string;
  readonly VITE_STORAGE_RAG_PROFILES?: string;
  readonly VITE_STORAGE_CHAT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
