import { User, UserManager } from "oidc-client-ts";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { buildOidcSettings } from "./oidcSettings";
import { realmRolesFromUser } from "./roles";

function buildUserManager(): UserManager {
  return new UserManager(buildOidcSettings());
}

type AuthState = {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  getAccessToken: () => string | null;
  realmRoles: Set<string>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const userManager = useMemo(() => buildUserManager(), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const u = await userManager.getUser();
        if (!cancelled) setUser(u);
      } catch (e) {
        if (!cancelled) setError(String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userManager]);

  const login = useCallback(async () => {
    setError(null);
    await userManager.signinRedirect();
  }, [userManager]);

  const logout = useCallback(async () => {
    await userManager.signoutRedirect();
  }, [userManager]);

  const getAccessToken = useCallback(() => user?.access_token ?? null, [user]);

  const realmRoles = useMemo(() => realmRolesFromUser(user), [user]);

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
