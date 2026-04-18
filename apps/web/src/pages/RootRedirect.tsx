import { Navigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { PageBusy } from "../components/PageBusy";

import LandingPage from "./LandingPage";

/** `/` — dashboard when authenticated, marketing landing otherwise. */
export default function RootRedirect() {
  const { user, loading } = useAuth();

  if (loading) {
    return <PageBusy message="Checking session…" layout="fullscreen" />;
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return <LandingPage />;
}
