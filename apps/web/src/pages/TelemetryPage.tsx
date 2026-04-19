import { useEffect, useId, useMemo, useState } from "react";

import { useAuth } from "../auth/AuthContext";
import { EmptyTablePlaceholder } from "../components/EmptyTablePlaceholder";
import { PageChrome } from "../components/PageChrome";
import { TablePagination } from "../components/TablePagination";
import { usePagination } from "../hooks/usePagination";
import {
  type TelemetryDimension,
  type TelemetryRow,
  type TelemetrySummary,
  fetchTelemetrySummary,
} from "../lib/telemetryApi";

type TabId = "overview" | "accounts" | "agents" | "workflows";

type EntityUsage = {
  key: string;
  displayName: string;
  requests: number;
  costUsd: number;
  tokensOut: number;
};

function rowsToUsage(rows: TelemetryRow[]): EntityUsage[] {
  return rows.map((r) => ({
    key: r.key,
    displayName: r.label,
    requests: r.requests,
    costUsd: r.cost_usd,
    tokensOut: r.output_tokens,
  }));
}

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
  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-200">
      <table className="w-full min-w-[520px] text-left text-sm">
        <thead className="bg-neutral-50 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          <tr>
            <th className="px-4 py-2">Name</th>
            <th className="px-4 py-2">Requests</th>
            <th className="px-4 py-2">Cost (USD)</th>
            <th className="px-4 py-2">Tokens out</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-200 bg-white">
          {rows.length === 0 ? (
            <EmptyTablePlaceholder
              colSpan={4}
              visual="activity"
              title="No usage rows yet"
              description="The Langfuse → Postgres rollup job runs every ~15 minutes. Run a few chats and refresh."
            />
          ) : (
            p.pageItems.map((r) => (
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
            ))
          )}
        </tbody>
      </table>
      {rows.length > 0 ? (
        <TablePagination
          label={label}
          page={p.page}
          totalPages={p.totalPages}
          total={p.total}
          from={p.from}
          to={p.to}
          onPageChange={p.setPage}
        />
      ) : null}
    </div>
  );
}

function useLiveSummary(dimension: TelemetryDimension) {
  const [summary, setSummary] = useState<TelemetrySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchTelemetrySummary(dimension)
      .then((s) => {
        if (!cancelled) {
          setSummary(s);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dimension]);

  return { summary, loading, error };
}

export default function TelemetryPage() {
  const tabsId = useId();
  const [tab, setTab] = useState<TabId>("overview");
  const { user } = useAuth();
  const me = user?.profile.preferred_username ?? user?.sub ?? "";

  const { summary: userSummary, loading: userLoading, error: userErr } = useLiveSummary("user");
  const { summary: agentSummary, loading: agentLoading, error: agentErr } = useLiveSummary("agent");
  const { summary: wfSummary, loading: wfLoading, error: wfErr } = useLiveSummary("workflow");

  const byUser = useMemo(() => rowsToUsage(userSummary?.rows ?? []), [userSummary]);
  const byAgent = useMemo(() => rowsToUsage(agentSummary?.rows ?? []), [agentSummary]);
  const byWorkflow = useMemo(() => rowsToUsage(wfSummary?.rows ?? []), [wfSummary]);

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

  const overviewTotals = userSummary
    ? {
        cost: userSummary.total_cost_usd,
        requests: userSummary.total_requests,
        tokens: userSummary.rows.reduce((acc, r) => acc + r.output_tokens, 0),
        from: userSummary.from_date,
        to: userSummary.to_date,
      }
    : { cost: 0, requests: 0, tokens: 0, from: "", to: "" };

  const loadingError = userErr ?? agentErr ?? wfErr;
  const isLoading = userLoading || agentLoading || wfLoading;

  const periodLabel =
    overviewTotals.from && overviewTotals.to ? `${overviewTotals.from} – ${overviewTotals.to}` : "rollup window";

  return (
    <PageChrome
      title="Telemetry"
      description="Usage rollups from Langfuse (synced periodically). Switch tabs for account, agent, and workflow breakdowns."
    >
      <div className="mt-6 border-b border-neutral-200" role="tablist" aria-label="Telemetry views">
        <div className="flex flex-wrap gap-1">
          {tabBtn("overview", "Overview")}
          {tabBtn("accounts", "By account")}
          {tabBtn("agents", "By agent")}
          {tabBtn("workflows", "By workflow")}
        </div>
      </div>

      {loadingError ? (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {loadingError}
        </p>
      ) : null}
      {isLoading ? <p className="mt-4 text-sm text-neutral-500">Loading rollups…</p> : null}

      <div className="mt-8">
        {tab === "overview" ? (
          <div className="space-y-10" role="tabpanel" aria-labelledby={`${tabsId}-overview`}>
            <p className="text-xs text-neutral-500">Period: {periodLabel}</p>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Total cost</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">${overviewTotals.cost.toFixed(2)}</p>
              </div>
              <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Total requests</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{overviewTotals.requests.toLocaleString()}</p>
              </div>
              <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Output tokens (sum of rows)</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{overviewTotals.tokens.toLocaleString()}</p>
              </div>
            </div>

            <p className="text-sm text-neutral-600">
              Per-trace detail and deeper views live under{" "}
              <a href="/settings" className="underline">
                Settings → Observability
              </a>
              .
            </p>
          </div>
        ) : null}

        {tab === "accounts" ? (
          <div role="tabpanel" aria-labelledby={`${tabsId}-accounts`}>
            <p className="mb-4 text-sm text-neutral-600">
              Cost and token usage per user. Your row is highlighted when it matches this session.
            </p>
            <PaginatedUsageTable rows={byUser} highlightKey={me} label="usage by account" />
          </div>
        ) : null}

        {tab === "agents" ? (
          <div role="tabpanel" aria-labelledby={`${tabsId}-agents`}>
            <p className="mb-4 text-sm text-neutral-600">Cost and token usage per agent spec.</p>
            <PaginatedUsageTable rows={byAgent} label="usage by agent" />
          </div>
        ) : null}

        {tab === "workflows" ? (
          <div role="tabpanel" aria-labelledby={`${tabsId}-workflows`}>
            <p className="mb-4 text-sm text-neutral-600">Rollups for each workflow (system + custom).</p>
            <PaginatedUsageTable rows={byWorkflow} label="usage by workflow" />
          </div>
        ) : null}
      </div>
    </PageChrome>
  );
}
