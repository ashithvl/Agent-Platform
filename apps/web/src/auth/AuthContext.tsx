import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { BACKEND_ENABLED } from "../lib/apiClient";
import { backendLogin } from "./backendAuth";
import { loginLocal } from "./localUsers";
import { realmRolesFromAccessToken } from "./roles";

const STORAGE_KEY = "eai_access_token";

export type AuthUser = {
  sub: string;
  access_token: string;
  profile: { preferred_username?: string; name?: string };
};

function decodeJwtPayload(accessToken: string): Record<string, unknown> | null {
  try {
    const part = accessToken.split(".")[1];
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
    return JSON.parse(atob(b64 + pad)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function userFromAccessToken(accessToken: string): AuthUser | null {
  const p = decodeJwtPayload(accessToken);
  if (!p?.sub) return null;
  const sub = String(p.sub);
  return {
    sub,
    access_token: accessToken,
    profile: {
      preferred_username: (p.preferred_username as string | undefined) ?? (p.email as string | undefined),
      name: p.name as string | undefined,
    },
  };
}

type AuthState = {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  getAccessToken: () => string | null;
  realmRoles: Set<string>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = sessionStorage.getItem(STORAGE_KEY);
    if (t) {
      const u = userFromAccessToken(t);
      if (u) setUser(u);
      else sessionStorage.removeItem(STORAGE_KEY);
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    setError(null);
    const at = BACKEND_ENABLED ? await backendLogin(username, password) : loginLocal(username, password);
    sessionStorage.setItem(STORAGE_KEY, at);
    const u = userFromAccessToken(at);
    if (!u) {
      sessionStorage.removeItem(STORAGE_KEY);
      throw new Error("Invalid session.");
    }
    setUser(u);
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
    setUser(null);
    window.location.replace(`${window.location.origin}/login`);
  }, []);

  const getAccessToken = useCallback(() => user?.access_token ?? null, [user]);

  const realmRoles = useMemo(() => realmRolesFromAccessToken(user?.access_token ?? null), [user]);

  const value = useMemo(
    () => ({
      user,
      loading,
      error,
      login,
      logout,
      getAccessToken,
      realmRoles,
    }),
    [user, loading, error, login, logout, getAccessToken, realmRoles],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
