/**
 * Admin-only client for the LiteLLM control plane (`Settings -> Models / Keys / Budgets`).
 *
 * Every route here requires the `admin` or `platform-admin` role on the
 * caller's JWT (enforced in api-service); the SPA still hides the tabs for
 * non-admins to keep the UI tidy.
 */

import { apiDelete, apiGet, apiPost } from "./apiClient";

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------

export type LiteLLMAdminModel = {
  model_name: string;
  litellm_params?: Record<string, unknown> & { model?: string; api_base?: string };
  model_info?: Record<string, unknown> & { id?: string; input_cost_per_token?: number };
};

export function listAdminModels(): Promise<LiteLLMAdminModel[]> {
  return apiGet<LiteLLMAdminModel[]>("/api/v1/litellm/admin/models");
}

export type AddAdminModelRequest = {
  model_name: string;
  litellm_params: Record<string, unknown>;
  model_info?: Record<string, unknown>;
};

export function addAdminModel(payload: AddAdminModelRequest): Promise<LiteLLMAdminModel> {
  return apiPost<LiteLLMAdminModel>("/api/v1/litellm/admin/models", payload);
}

export function deleteAdminModel(modelId: string): Promise<unknown> {
  return apiDelete<unknown>(`/api/v1/litellm/admin/models/${encodeURIComponent(modelId)}`);
}

// ---------------------------------------------------------------------------
// Virtual keys
// ---------------------------------------------------------------------------

export type LiteLLMVirtualKey = {
  key?: string;
  key_alias?: string;
  token?: string;
  models?: string[];
  max_budget?: number | null;
  spend?: number;
  expires?: string | null;
  metadata?: Record<string, unknown>;
};

export function listAdminKeys(): Promise<LiteLLMVirtualKey[]> {
  return apiGet<LiteLLMVirtualKey[]>("/api/v1/litellm/admin/keys");
}

export type CreateKeyRequest = {
  key_alias?: string;
  models?: string[];
  max_budget?: number;
  duration?: string;
  metadata?: Record<string, unknown>;
};

export function createAdminKey(body: CreateKeyRequest): Promise<LiteLLMVirtualKey> {
  return apiPost<LiteLLMVirtualKey>("/api/v1/litellm/admin/keys", body);
}

export function deleteAdminKeys(keys: string[]): Promise<unknown> {
  return apiDelete<unknown>("/api/v1/litellm/admin/keys", keys);
}

// ---------------------------------------------------------------------------
// Budgets
// ---------------------------------------------------------------------------

export type LiteLLMBudget = {
  budget_id: string;
  max_budget: number;
  budget_duration?: string;
  spend?: number;
};

export function listAdminBudgets(): Promise<LiteLLMBudget[]> {
  return apiGet<LiteLLMBudget[]>("/api/v1/litellm/admin/budgets");
}

export type UpsertBudgetRequest = {
  budget_id: string;
  max_budget: number;
  budget_duration?: string;
};

export function upsertAdminBudget(body: UpsertBudgetRequest): Promise<LiteLLMBudget> {
  return apiPost<LiteLLMBudget>("/api/v1/litellm/admin/budgets", body);
}

export function deleteAdminBudget(budgetId: string): Promise<unknown> {
  return apiDelete<unknown>(`/api/v1/litellm/admin/budgets/${encodeURIComponent(budgetId)}`);
}
