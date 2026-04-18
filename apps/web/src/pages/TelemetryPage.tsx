import { useId, useMemo, useState } from "react";

import { useAuth } from "../auth/AuthContext";
import { listUsersPublic } from "../auth/localUsers";
import { EmptyTablePlaceholder } from "../components/EmptyTablePlaceholder";
import { PageChrome } from "../components/PageChrome";
import { TablePagination } from "../components/TablePagination";
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
import { usePagination } from "../hooks/usePagination";
import { useSyncedList } from "../lib/useSyncedList";

type TabId = "overview" | "accounts" | "agents" | "workflows";

function PaginatedUsageTable({
  rows,
  highlightKey,
  label,
}: {
  rows: EntityUsage[];
  highlightKey?: string;
  label: string;
}) {
  const p = usePagination(rows, 10);
  if (rows.length === 0) {
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
            <EmptyTablePlaceholder
              colSpan={4}
              visual="activity"
              title="No usage rows for this view"
              description="Mock rollups appear when there is data to attribute (e.g. local accounts, agents, or workflows). Add resources elsewhere in the workspace, then check again."
            />
          </tbody>
        </table>
      </div>
    );
  }
  return (
    <>
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
            {p.pageItems.map((r) => (
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
        <TablePagination
          label={label}
          page={p.page}
          totalPages={p.totalPages}
          total={p.total}
          from={p.from}
          to={p.to}
          onPageChange={p.setPage}
        />
      </div>
    </>
  );
}

export default function TelemetryPage() {
  const tabsId = useId();
  const [tab, setTab] = useState<TabId>("overview");
  const { user } = useAuth();
  const me = user?.profile.preferred_username ?? user?.sub ?? "";
  const days = useMemo(() => last7Days(), []);
  const t = useMemo(() => totals7d(days), [days]);
  const maxCost = Math.max(...days.map((d) => d.costUsd), 1);
  const maxReq = Math.max(...days.map((d) => d.requests), 1);
  const dailyPage = usePagination(days, 10);

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

  const tabBtn = (id: TabId, label: string) => (
    <button
      key={id}
      type="button"
      role="tab"
      aria-selected={tab === id}
      id={`${tabsId}-${id}`}
      onClick={() => setTab(id)}
      className={[
        "-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
        tab === id
          ? "border-neutral-900 text-neutral-900"
          : "border-transparent text-neutral-500 hover:text-neutral-800",
      ].join(" ")}
    >
      {label}
    </button>
  );

  return (
    <PageChrome
      title="Telemetry"
      description="Mock usage and daily rollups — not connected to real metering. Switch tabs for account, agent, and workflow breakdowns."
    >
      <div className="mt-6 border-b border-neutral-200" role="tablist" aria-label="Telemetry views">
        <div className="flex flex-wrap gap-1">
          {tabBtn("overview", "Overview")}
          {tabBtn("accounts", "By account")}
          {tabBtn("agents", "By agent")}
          {tabBtn("workflows", "By workflow")}
        </div>
      </div>

      <div className="mt-8">
        {tab === "overview" ? (
          <div className="space-y-10" role="tabpanel" aria-labelledby={`${tabsId}-overview`}>
            <div className="grid gap-4 sm:grid-cols-3">
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

            <section className="overflow-hidden rounded-lg border border-neutral-200" aria-labelledby="telemetry-daily-heading">
              <h2 id="telemetry-daily-heading" className="sr-only">
                Daily telemetry table
              </h2>
              <p className="sr-only">
                Mock seven-day breakdown. Use pagination to move through days. The chart below repeats cost visually.
              </p>
              <table className="w-full text-left text-sm">
                <caption className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-left text-sm text-neutral-800">
                  <span className="font-medium text-neutral-900">Daily breakdown</span>
                  <span className="mt-1 block text-xs font-normal text-neutral-600">Mock values — same data as the chart.</span>
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
                  {days.length === 0 ? (
                    <EmptyTablePlaceholder
                      colSpan={5}
                      visual="chart"
                      title="No daily telemetry"
                      description="The mock seven-day series is empty. This is unexpected in the demo — refresh the page if it persists."
                    />
                  ) : (
                    dailyPage.pageItems.map((d, i) => (
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
                    ))
                  )}
                </tbody>
              </table>
              {days.length > 0 ? (
                <TablePagination
                  label="daily rows"
                  page={dailyPage.page}
                  totalPages={dailyPage.totalPages}
                  total={dailyPage.total}
                  from={dailyPage.from}
                  to={dailyPage.to}
                  onPageChange={dailyPage.setPage}
                />
              ) : null}
            </section>

            <section aria-labelledby="telemetry-chart-heading">
              <h2 id="telemetry-chart-heading" className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
                Daily cost (visual)
              </h2>
              <p className="mt-1 text-xs text-neutral-600">Decorative — values match the table above.</p>
              <div className="mt-4 flex h-44 items-end justify-between gap-2 border-b border-neutral-200 pb-0" aria-hidden="true">
                {days.length === 0 ? (
                  <div className="flex w-full items-center justify-center text-xs text-neutral-500">No chart data</div>
                ) : (
                  days.map((d, i) => (
                    <div key={`${d.day}-${i}`} className="flex flex-1 flex-col items-center gap-2">
                      <div
                        className="w-full max-w-[48px] rounded-t bg-neutral-900"
                        style={{ height: `${(d.costUsd / maxCost) * 100}%`, minHeight: "4px" }}
                        title={`$${d.costUsd.toFixed(2)}`}
                      />
                      <span className="text-[10px] text-neutral-500">{d.day}</span>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        ) : null}

        {tab === "accounts" ? (
          <div role="tabpanel" aria-labelledby={`${tabsId}-accounts`}>
            <p className="mb-4 text-sm text-neutral-600">
              Mock attribution by username (local accounts). Your row is highlighted when it matches this session.
            </p>
            <PaginatedUsageTable rows={byUser} highlightKey={me} label="usage by account" />
          </div>
        ) : null}

        {tab === "agents" ? (
          <div role="tabpanel" aria-labelledby={`${tabsId}-agents`}>
            <p className="mb-4 text-sm text-neutral-600">Estimated calls and cost per agent spec in this browser.</p>
            <PaginatedUsageTable rows={byAgent} label="usage by agent" />
          </div>
        ) : null}

        {tab === "workflows" ? (
          <div role="tabpanel" aria-labelledby={`${tabsId}-workflows`}>
            <p className="mb-4 text-sm text-neutral-600">Rollups for each catalog workflow (system + custom).</p>
            <PaginatedUsageTable rows={byWorkflow} label="usage by workflow" />
          </div>
        ) : null}
      </div>

      <p className="mt-10 text-xs text-neutral-500">
        For production metering and SSO-backed attribution, wire this UI to your identity and billing stack — these
        numbers are placeholders only.
      </p>
    </PageChrome>
  );
}
