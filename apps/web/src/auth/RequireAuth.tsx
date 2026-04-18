import { Navigate, Outlet } from "react-router-dom";

import { useAuth } from "./AuthContext";

/** Gate that requires a logged-in user; renders nested routes via `<Outlet />`. */
export function RequireAuth() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="text-sm text-neutral-500">Loading…</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
