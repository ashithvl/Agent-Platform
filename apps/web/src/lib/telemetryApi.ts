/** Telemetry / observability client - talks to api-service rollups. */
import { apiGet } from "./apiClient";

export type TelemetryDimension = "user" | "agent" | "workflow";

export type TelemetryRow = {
  key: string;
  label: string;
  requests: number;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
};

export type TelemetrySummary = {
  dimension: TelemetryDimension;
  from_date: string;
  to_date: string;
  total_requests: number;
  total_cost_usd: number;
  rows: TelemetryRow[];
};

export function fetchTelemetrySummary(
  dimension: TelemetryDimension,
  opts: { from?: string; to?: string } = {},
): Promise<TelemetrySummary> {
  const params = new URLSearchParams({ dimension });
  if (opts.from) params.set("from", opts.from);
  if (opts.to) params.set("to", opts.to);
  return apiGet<TelemetrySummary>(`/api/v1/telemetry/summary?${params.toString()}`);
}

export type TraceIndex = {
  trace_id: string;
  name: string;
  user_id: string;
  agent_id: string;
  workflow_id: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  latency_ms: number;
  started_at: string;
};

export function fetchTraces(limit = 50): Promise<TraceIndex[]> {
  return apiGet<TraceIndex[]>(`/api/v1/telemetry/traces?limit=${limit}`);
}

export function fetchTraceDetail(traceId: string): Promise<Record<string, unknown>> {
  return apiGet<Record<string, unknown>>(`/api/v1/telemetry/traces/${encodeURIComponent(traceId)}`);
}
