import { Navigate } from "react-router-dom";

import { useAuth } from "./AuthContext";

export function AccessDenied() {
  return (
    <div className="mx-auto max-w-lg px-6 py-16 text-center">
      <h1 className="text-lg font-semibold text-neutral-900">Access restricted</h1>
      <p className="mt-2 text-sm text-neutral-600">Your role doesn&apos;t include this area. Contact a platform admin.</p>
    </div>
  );
}

export function RoleRoute({ anyOf, children }: { anyOf: string[]; children: React.ReactNode }) {
  const { loading, user, realmRoles } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <span className="text-sm text-neutral-500">Loading…</span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const ok = anyOf.some((r) => realmRoles.has(r));
  if (!ok) {
    return <AccessDenied />;
  }

  return <>{children}</>;
}
