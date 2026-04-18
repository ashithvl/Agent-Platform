import { useMemo } from "react";

import { last7Days, totals7d } from "../lib/telemetryMock";

export default function TelemetryPage() {
  const days = useMemo(() => last7Days(), []);
  const t = useMemo(() => totals7d(days), [days]);
  const maxCost = Math.max(...days.map((d) => d.costUsd), 1);
  const maxReq = Math.max(...days.map((d) => d.requests), 1);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <header className="border-b border-neutral-200 pb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Telemetry</h1>
        <p className="mt-1 text-sm text-neutral-600">Cost and usage (mock data generated in the browser for admin review).</p>
      </header>

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

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Daily cost</h2>
        <div className="mt-4 flex h-44 items-end justify-between gap-2 border-b border-neutral-200 pb-0">
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

      <section className="mt-10 overflow-hidden rounded-lg border border-neutral-200">
        <table className="w-full text-left text-sm">
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
    </div>
  );
}
