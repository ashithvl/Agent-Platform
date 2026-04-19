/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** When "1", SPA talks to auth-service / api-service; entity data is stored in Postgres (not localStorage). */
  readonly VITE_USE_BACKEND?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
