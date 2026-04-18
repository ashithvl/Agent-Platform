import { Navigate, Outlet } from "react-router-dom";

import { PageBusy } from "../components/PageBusy";
import { useAuth } from "./AuthContext";

/** Gate that requires a logged-in user; renders nested routes via `<Outlet />`. */
export function RequireAuth() {
  const { user, loading } = useAuth();

  if (loading) {
    return <PageBusy message="Restoring your session…" layout="fullscreen" />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
