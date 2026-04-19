/**
 * Real auth-service client. Used when `VITE_USE_BACKEND=1`.
 *
 * The SPA continues to decode the returned JWT with
 * `realmRolesFromAccessToken`, so the claim shape (`realm_access.roles`,
 * `preferred_username`) must match what `auth-service` emits.
 */

import { apiGet, apiPost } from "../lib/apiClient";
import type { CreatableRole } from "./types";

type LoginResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
};

export type BackendUser = {
  username: string;
  roles: string[];
  label: string;
};

export async function backendLogin(username: string, password: string): Promise<string> {
  const res = await apiPost<LoginResponse>("/auth/login", { username, password });
  return res.access_token;
}

export async function backendListUsers(): Promise<BackendUser[]> {
  return apiGet<BackendUser[]>("/auth/users");
}

export async function backendCreateUser(
  username: string,
  password: string,
  role: CreatableRole,
): Promise<BackendUser> {
  return apiPost<BackendUser>("/auth/users", { username, password, role });
}
