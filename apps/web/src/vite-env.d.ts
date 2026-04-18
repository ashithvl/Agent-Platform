/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional override for the mock invoke URL base shown on API Access (display only). */
  readonly VITE_MOCK_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
