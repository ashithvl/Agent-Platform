import { Navigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";

import LandingPage from "./LandingPage";

/** `/` — dashboard when authenticated, marketing landing otherwise. */
export default function RootRedirect() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <p className="text-sm text-neutral-500">Loading…</p>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return <LandingPage />;
}
