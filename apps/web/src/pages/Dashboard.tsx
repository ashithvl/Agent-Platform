import { Link } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { AGENT_SPECS_CHANGED, listAgentSpecs } from "../lib/agentSpecStorage";
import { useSyncedList } from "../lib/useSyncedList";
import { useWorkflowCatalog } from "../lib/useWorkflowCatalog";

export default function Dashboard() {
  const { realmRoles } = useAuth();
  const workflows = useWorkflowCatalog();
  const agentSpecs = useSyncedList(AGENT_SPECS_CHANGED, listAgentSpecs);
  const isBuilder = realmRoles.has("builder") || realmRoles.has("admin") || realmRoles.has("platform-admin");
  const canSeeApiKeys =
    realmRoles.has("api_access") || realmRoles.has("admin") || realmRoles.has("platform-admin");

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="border-b border-neutral-200 pb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Dashboard</h1>
        <p className="mt-1 text-sm text-neutral-600">Overview of your AI workspace — demo data, stored locally.</p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Active workflows" value={String(workflows.length)} hint="System + your flows" />
        <MetricCard
          label="Agents"
          value={String(agentSpecs.filter((a) => a.status === "active").length)}
          hint="Configured in Agents"
        />
        <MetricCard label="Est. cost (7d)" value="$482.10" hint="Mock aggregate" />
        <MetricCard label="Requests (24h)" value="12.4k" hint="Mock traffic" />
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <section className="rounded-lg border border-neutral-200 bg-neutral-50/50 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Quick actions</h2>
          <ul className="mt-4 space-y-2 text-sm">
            <li>
              <Link className="font-medium text-neutral-900 underline-offset-4 hover:underline" to="/chat">
                Open chat
              </Link>
              <span className="text-neutral-600"> — Pick a workflow and continue a thread.</span>
            </li>
            {isBuilder ? (
              <>
                <li>
                  <Link className="font-medium text-neutral-900 underline-offset-4 hover:underline" to="/knowledge">
                    Knowledge hub
                  </Link>
                  <span className="text-neutral-600"> — Hubs, audiences, and approvals.</span>
                </li>
                {canSeeApiKeys ? (
                  <li>
                    <Link className="font-medium text-neutral-900 underline-offset-4 hover:underline" to="/api-access">
                      API access
                    </Link>
                    <span className="text-neutral-600"> — Keys and invoke URLs per workflow.</span>
                  </li>
                ) : null}
              </>
            ) : null}
          </ul>
        </section>

        <section className="rounded-lg border border-neutral-200 bg-neutral-50/50 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Health</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between border-b border-neutral-200/80 py-2">
              <dt className="text-neutral-600">Platform</dt>
              <dd className="font-medium text-neutral-900">Operational</dd>
            </div>
            <div className="flex justify-between border-b border-neutral-200/80 py-2">
              <dt className="text-neutral-600">Inference</dt>
              <dd className="font-medium text-neutral-900">Degraded (demo)</dd>
            </div>
            <div className="flex justify-between py-2">
              <dt className="text-neutral-600">Storage</dt>
              <dd className="font-medium text-neutral-900">Local only</dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}

function MetricCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-neutral-900">{value}</p>
      <p className="mt-1 text-xs text-neutral-500">{hint}</p>
    </div>
  );
}
