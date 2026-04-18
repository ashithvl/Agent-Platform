import { useMemo } from "react";

import { useAuth } from "../auth/AuthContext";
import { listUsersPublic } from "../auth/localUsers";
import { PageChrome } from "../components/PageChrome";
import { AGENT_SPECS_CHANGED, listAgentSpecs } from "../lib/agentSpecStorage";
import {
  last7Days,
  totals7d,
  usageByAgents,
  usageByUsers,
  usageByWorkflows,
  type EntityUsage,
} from "../lib/telemetryMock";
import { useWorkflowCatalog } from "../lib/useWorkflowCatalog";
import { useSyncedList } from "../lib/useSyncedList";

function UsageTable({ rows, highlightKey }: { rows: EntityUsage[]; highlightKey?: string }) {
  if (rows.length === 0) {
    return <p className="text-sm text-neutral-500">No rows to show yet.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-200">
      <table className="w-full min-w-[520px] text-left text-sm">
        <thead className="bg-neutral-50 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          <tr>
            <th className="px-4 py-2">Name</th>
            <th className="px-4 py-2">Requests (est.)</th>
            <th className="px-4 py-2">Cost (USD, est.)</th>
            <th className="px-4 py-2">Tokens out (est.)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-200 bg-white">
          {rows.map((r) => (
            <tr
              key={r.key}
              className={[
                "border-b border-neutral-100 last:border-0",
                highlightKey && r.displayName === highlightKey ? "bg-sky-50" : "bg-white",
              ].join(" ")}
            >
              <td className="px-4 py-2 font-medium text-neutral-900">{r.displayName}</td>
              <td className="px-4 py-2 tabular-nums">{r.requests.toLocaleString()}</td>
              <td className="px-4 py-2 tabular-nums">${r.costUsd.toFixed(2)}</td>
              <td className="px-4 py-2 tabular-nums">{r.tokensOut.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function TelemetryPage() {
  const { user } = useAuth();
  const me = user?.profile.preferred_username ?? user?.sub ?? "";
  const days = useMemo(() => last7Days(), []);
  const t = useMemo(() => totals7d(days), [days]);
  const maxCost = Math.max(...days.map((d) => d.costUsd), 1);
  const maxReq = Math.max(...days.map((d) => d.requests), 1);

  const agents = useSyncedList(AGENT_SPECS_CHANGED, listAgentSpecs);
  const workflows = useWorkflowCatalog();
  const users = useMemo(() => listUsersPublic().map((u) => u.username), []);

  const byUser = useMemo(() => usageByUsers(users.length ? users : [me || "user"]), [users, me]);
  const byAgent = useMemo(
    () => usageByAgents(agents.map((a) => ({ id: a.id, name: a.name }))),
    [agents],
  );
  const byWorkflow = useMemo(
    () => usageByWorkflows(workflows.map((w) => ({ id: w.id, name: w.name }))),
    [workflows],
  );

  return (
    <PageChrome
      title="Telemetry"
      description="Workspace usage views (mock numbers for layout — not connected to real metering or billing). Everyone signed in can open this page; refine access in production if needed."
    >
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">7d est. cost</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">${t.cost.toFixed(2)}</p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">7d requests</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{t.requests.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">7d output tokens (est.)</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{t.tokens.toLocaleString()}</p>
        </div>
      </div>

      <section className="mt-10 overflow-hidden rounded-lg border border-neutral-200" aria-labelledby="telemetry-table-heading">
        <h2 id="telemetry-table-heading" className="sr-only">
          Daily telemetry table
        </h2>
        <p className="sr-only">
          Seven-day mock breakdown: each row is a calendar day with estimated cost in US dollars, request count, output
          tokens, and a relative load bar. Use this table as the authoritative summary; the bar chart below repeats cost
          for visual comparison only.
        </p>
        <table className="w-full text-left text-sm">
          <caption className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-left text-sm text-neutral-800">
            <span className="font-medium text-neutral-900">Daily breakdown</span>
            <span className="mt-1 block text-xs font-normal text-neutral-600">
              Mock values — same data as the optional chart below.
            </span>
          </caption>
          <thead className="bg-neutral-50 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-2">Day</th>
              <th className="px-4 py-2">Cost</th>
              <th className="px-4 py-2">Requests</th>
              <th className="px-4 py-2">Tokens out</th>
              <th className="hidden px-4 py-2 md:table-cell">Load</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 bg-white">
            {days.map((d, i) => (
              <tr key={`${d.day}-${i}`}>
                <td className="px-4 py-2 font-medium text-neutral-900">{d.day}</td>
                <td className="px-4 py-2 tabular-nums">${d.costUsd.toFixed(2)}</td>
                <td className="px-4 py-2 tabular-nums">{d.requests.toLocaleString()}</td>
                <td className="px-4 py-2 tabular-nums">{d.tokensOut.toLocaleString()}</td>
                <td className="hidden px-4 py-2 md:table-cell">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200">
                    <div
                      className="h-full rounded-full bg-neutral-900"
                      style={{ width: `${(d.requests / maxReq) * 100}%` }}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-10" aria-labelledby="telemetry-chart-heading">
        <h2 id="telemetry-chart-heading" className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Daily cost (visual)
        </h2>
        <p className="mt-1 text-xs text-neutral-600">Decorative repeat of the cost column — see the table above for exact numbers.</p>
        <div className="mt-4 flex h-44 items-end justify-between gap-2 border-b border-neutral-200 pb-0" aria-hidden="true">
          {days.map((d, i) => (
            <div key={`${d.day}-${i}`} className="flex flex-1 flex-col items-center gap-2">
              <div
                className="w-full max-w-[48px] rounded-t bg-neutral-900"
                style={{ height: `${(d.costUsd / maxCost) * 100}%`, minHeight: "4px" }}
                title={`$${d.costUsd.toFixed(2)}`}
              />
              <span className="text-[10px] text-neutral-500">{d.day}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12 border-t border-neutral-200 pt-10">
        <h2 className="text-base font-semibold text-neutral-900">Usage by account</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Mock attribution by username (from local accounts). Your row is highlighted when the name matches your session.
        </p>
        <div className="mt-4">
          <UsageTable rows={byUser} highlightKey={me} />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-base font-semibold text-neutral-900">Usage by agent</h2>
        <p className="mt-1 text-sm text-neutral-600">Estimated calls and cost per agent spec in this browser.</p>
        <div className="mt-4">
          <UsageTable rows={byAgent} />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-base font-semibold text-neutral-900">Usage by workflow</h2>
        <p className="mt-1 text-sm text-neutral-600">Rollups for each catalog workflow id (system + custom).</p>
        <div className="mt-4">
          <UsageTable rows={byWorkflow} />
        </div>
      </section>

      <p className="mt-10 text-xs text-neutral-500">
        For real user management (password resets, SSO, quotas), use your identity provider and metering pipeline — this
        screen is a structured placeholder only.
      </p>
    </PageChrome>
  );
}
