/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** API prefix for auth and BFF calls (default `/api/v1`). */
  readonly VITE_API_BASE?: string;
  /** Mock API base shown on API Access page. */
  readonly VITE_MOCK_API_BASE?: string;
  /**
   * LiteLLM OpenAI-compatible base (no trailing slash).
   * Default `/litellm` behind nginx; use `http://localhost:4000` for raw LiteLLM in Vite dev.
   */
  readonly VITE_LITELLM_BASE?: string;
  /**
   * LiteLLM master key for `Authorization: Bearer` on `/v1/models`.
   * Demo only — exposes secret to the browser.
   */
  readonly VITE_LITELLM_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
