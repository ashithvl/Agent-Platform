import { Navigate, Link, useNavigate } from "react-router-dom";

import { PageBusy } from "../components/PageBusy";
import { useAuth } from "./AuthContext";

/** Short labels for realm roles used in route guards (demo JWT). */
const ROLE_DESCRIPTIONS: Record<string, string> = {
  consumer: "Consumer — chat and shared areas",
  builder: "Builder — agents, workflows, knowledge, tools, ingestion",
  admin: "Administrator",
  "platform-admin": "Platform administrator",
};

function describeRole(role: string): string {
  return ROLE_DESCRIPTIONS[role] ?? role;
}

export function AccessDenied({ requiredRoles }: { requiredRoles: readonly string[] }) {
  const { realmRoles, logout } = useAuth();
  const navigate = useNavigate();

  const uniqueRequired = [...new Set(requiredRoles)].sort((a, b) => a.localeCompare(b));
  const yourRoles = [...realmRoles].sort((a, b) => a.localeCompare(b));

  const onSignOut = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="mx-auto max-w-lg px-6 py-12">
      <div className="rounded-lg border border-neutral-200 bg-neutral-50/80 p-6 shadow-sm">
        <h1 className="text-lg font-semibold tracking-tight text-neutral-900">Access restricted</h1>
        <p className="mt-2 text-sm leading-relaxed text-neutral-600">
          This page needs at least one of the roles below. Your current account does not include any of them.
        </p>

        <div className="mt-5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Roles that unlock this page</h2>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-neutral-800">
            {uniqueRequired.map((r) => (
              <li key={r}>
                <span className="font-mono text-xs text-neutral-700">{r}</span>
                <span className="text-neutral-600"> — {describeRole(r)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-5 rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm">
          <span className="text-neutral-500">Your roles: </span>
          {yourRoles.length ? (
            <span className="font-medium text-neutral-900">{yourRoles.join(", ")}</span>
          ) : (
            <span className="text-neutral-700">none</span>
          )}
        </div>

        <p className="mt-4 text-sm text-neutral-600">
          If you were sent a link by mistake, open a workspace you can use from the dashboard, or sign out and sign in
          with a different account (for example <span className="font-mono text-xs">developer</span> or{" "}
          <span className="font-mono text-xs">admin</span> in this demo).
        </p>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Link
            to="/dashboard"
            className="inline-flex justify-center rounded-md bg-neutral-900 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-neutral-800"
          >
            Go to dashboard
          </Link>
          <Link
            to="/chat"
            className="inline-flex justify-center rounded-md border border-neutral-300 bg-white px-4 py-2.5 text-center text-sm font-medium text-neutral-900 hover:bg-neutral-50"
          >
            Open chat
          </Link>
          <button
            type="button"
            onClick={onSignOut}
            className="inline-flex justify-center rounded-md border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
          >
            Sign out
          </button>
        </div>

        <p className="mt-4 text-xs text-neutral-500">
          Need access? Ask a platform or workspace admin to grant the right role. In this demo, admins can add users
          under Settings.
        </p>
      </div>
    </div>
  );
}

export function RoleRoute({ anyOf, children }: { anyOf: string[]; children: React.ReactNode }) {
  const { loading, user, realmRoles } = useAuth();

  if (loading) {
    return <PageBusy message="Checking permissions…" layout="section" />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const ok = anyOf.some((r) => realmRoles.has(r));
  if (!ok) {
    return <AccessDenied requiredRoles={anyOf} />;
  }

  return <>{children}</>;
}
