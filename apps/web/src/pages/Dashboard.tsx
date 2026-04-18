import { Link } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { PageChrome } from "../components/PageChrome";
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
    <PageChrome title="Dashboard" description="Overview of your AI workspace — demo data, stored locally.">
      {!isBuilder ? (
        <div
          className="mt-6 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm leading-relaxed text-sky-950"
          role="status"
        >
          <strong className="font-semibold">Role-based sidebar:</strong> Agents, workflows, knowledge, tools, and data
          ingestion only appear when your account has the <span className="font-medium">builder</span>,{" "}
          <span className="font-medium">admin</span>, or <span className="font-medium">platform-admin</span> role. Open{" "}
          <Link className="font-medium underline-offset-4 hover:underline" to="/settings">
            Settings
          </Link>{" "}
          to see your roles, or use a demo user that includes builder to explore the full catalog.
        </div>
      ) : null}

      <div
        className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-950"
        role="note"
      >
        <strong className="font-semibold">Cost and traffic tiles are not real telemetry.</strong> The dollar and
        request figures below are <strong>static placeholders</strong> for layout demos only — they are not wired to
        billing or any remote backend. Workflow and agent counts come from data stored in this browser.
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Active workflows" value={String(workflows.length)} hint="System + your flows" />
        <MetricCard
          label="Agents"
          value={String(agentSpecs.filter((a) => a.status === "active").length)}
          hint="Configured in Agents"
        />
        <MetricCard
          label="Est. cost (7d)"
          value="$482.10"
          hint="Illustration only — not billing or usage data"
          demoFigures
        />
        <MetricCard
          label="Requests (24h)"
          value="12.4k"
          hint="Illustration only — not production traffic"
          demoFigures
        />
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
            <li>
              <Link className="font-medium text-neutral-900 underline-offset-4 hover:underline" to="/telemetry">
                Telemetry
              </Link>
              <span className="text-neutral-600"> — Mock usage by account, agent, and workflow.</span>
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
    </PageChrome>
  );
}

function MetricCard({
  label,
  value,
  hint,
  demoFigures,
}: {
  label: string;
  value: string;
  hint: string;
  /** Stronger visual cue that the value is fictional (cost / traffic demos). */
  demoFigures?: boolean;
}) {
  return (
    <div
      className={[
        "rounded-lg border p-4 shadow-sm",
        demoFigures ? "border-amber-200 bg-amber-50/70" : "border-neutral-200 bg-white",
      ].join(" ")}
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</p>
        {demoFigures ? (
          <span className="rounded border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-950">
            Demo only
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-neutral-900">{value}</p>
      <p className="mt-1 text-xs text-neutral-600">{hint}</p>
    </div>
  );
}
