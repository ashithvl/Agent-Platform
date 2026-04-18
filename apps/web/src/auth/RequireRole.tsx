import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

export function RequireRole({
  anyOf,
  children,
}: {
  anyOf: string[];
  children: React.ReactNode;
}) {
  const { loading, user, realmRoles } = useAuth();
  if (loading) return <p>Loading…</p>;
  if (!user) return <Navigate to="/" replace />;
  const ok = anyOf.some((r) => realmRoles.has(r));
  if (!ok) return <Navigate to="/" replace />;
  return <>{children}</>;
}
