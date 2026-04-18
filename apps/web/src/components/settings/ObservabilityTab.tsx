import { useEffect, useState } from "react";

import { useFlash } from "../FlashContext";
import { type TraceIndex, fetchTraceDetail, fetchTraces } from "../../lib/telemetryApi";
import { Dialog } from "../Dialog";

export function ObservabilityTab() {
  const { showError } = useFlash();
  const [traces, setTraces] = useState<TraceIndex[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      setTraces(await fetchTraces(100));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <section>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Recent traces
          </h2>
          <p className="mt-1 text-sm text-neutral-600">
            Flat projection of Langfuse traces. Click a row for the full span tree.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="shrink-0 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm hover:bg-neutral-50"
        >
          Refresh
        </button>
      </div>

      {error ? (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-6 overflow-hidden rounded-lg border border-neutral-200 shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-100 text-xs font-semibold uppercase tracking-wide text-neutral-600">
            <tr>
              <th className="px-4 py-3">Started</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">User</th>
              <th className="hidden px-4 py-3 md:table-cell">Agent / Workflow</th>
              <th className="hidden px-4 py-3 md:table-cell">Tokens</th>
              <th className="px-4 py-3">Cost</th>
              <th className="hidden px-4 py-3 md:table-cell">Latency</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 bg-white">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-neutral-500">
                  Loading…
                </td>
              </tr>
            ) : traces.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-neutral-500">
                  No traces yet — the sync job runs every 15 minutes.
                </td>
              </tr>
            ) : (
              traces.map((t) => (
                <tr
                  key={t.trace_id}
                  onClick={() => setSelected(t.trace_id)}
                  className="cursor-pointer odd:bg-white even:bg-neutral-50/60 hover:bg-sky-50"
                >
                  <td className="px-4 py-3 font-mono text-xs text-neutral-600">
                    {new Date(t.started_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-medium text-neutral-900">{t.name || "(unnamed)"}</td>
                  <td className="px-4 py-3 text-neutral-700">{t.user_id || "—"}</td>
                  <td className="hidden px-4 py-3 text-neutral-700 md:table-cell">
                    {(t.agent_id || t.workflow_id) ? `${t.agent_id}${t.workflow_id ? ` / ${t.workflow_id}` : ""}` : "—"}
                  </td>
                  <td className="hidden px-4 py-3 text-neutral-700 md:table-cell">
                    {t.input_tokens + t.output_tokens}
                  </td>
                  <td className="px-4 py-3 text-neutral-700">${t.cost_usd.toFixed(4)}</td>
                  <td className="hidden px-4 py-3 text-neutral-700 md:table-cell">{t.latency_ms} ms</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selected ? (
        <TraceDetailDialog
          traceId={selected}
          onClose={() => setSelected(null)}
          onError={(msg) => showError(msg)}
        />
      ) : null}
    </section>
  );
}

function TraceDetailDialog({
  traceId,
  onClose,
  onError,
}: {
  traceId: string;
  onClose: () => void;
  onError: (message: string) => void;
}) {
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchTraceDetail(traceId)
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch((err) => onError(err instanceof Error ? err.message : String(err)))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [traceId, onError]);

  return (
    <Dialog open onClose={onClose} title={`Trace ${traceId}`} size="lg">
      {loading ? (
        <p className="text-sm text-neutral-500">Loading trace…</p>
      ) : detail ? (
        <div className="space-y-4">
          <div className="grid gap-2 text-xs sm:grid-cols-2">
            <KV k="id" v={String(detail.id ?? traceId)} />
            <KV k="name" v={String(detail.name ?? "")} />
            <KV k="userId" v={String(detail.userId ?? "")} />
            <KV k="timestamp" v={String(detail.timestamp ?? detail.createdAt ?? "")} />
            <KV k="totalCost" v={String(detail.totalCost ?? detail.calculatedTotalCost ?? "0")} />
            <KV k="latency (s)" v={String(detail.latency ?? "")} />
          </div>

          <section>
            <h3 className="text-sm font-semibold text-neutral-800">Metadata</h3>
            <pre className="mt-2 max-h-48 overflow-auto rounded bg-neutral-950 p-3 text-[11px] leading-relaxed text-neutral-100">
              {JSON.stringify(detail.metadata ?? {}, null, 2)}
            </pre>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-neutral-800">Observations</h3>
            <pre className="mt-2 max-h-64 overflow-auto rounded bg-neutral-950 p-3 text-[11px] leading-relaxed text-neutral-100">
              {JSON.stringify(detail.observations ?? [], null, 2)}
            </pre>
          </section>

          <details className="rounded border border-neutral-200 bg-neutral-50 p-2">
            <summary className="cursor-pointer text-xs font-semibold text-neutral-700">Raw payload</summary>
            <pre className="mt-2 max-h-80 overflow-auto text-[11px] leading-relaxed">
              {JSON.stringify(detail, null, 2)}
            </pre>
          </details>
        </div>
      ) : (
        <p className="text-sm text-neutral-500">No trace detail returned.</p>
      )}
    </Dialog>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded border border-neutral-100 bg-neutral-50 px-2 py-1.5">
      <p className="font-mono text-[10px] uppercase tracking-wide text-neutral-500">{k}</p>
      <p className="mt-0.5 break-all text-xs text-neutral-900">{v || "—"}</p>
    </div>
  );
}
