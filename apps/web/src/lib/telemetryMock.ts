/** Deterministic demo metrics (no server). */

export type DayPoint = { day: string; costUsd: number; requests: number; tokensOut: number };

const seededRandom = (seed: number) => {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
};

export function last7Days(): DayPoint[] {
  const out: DayPoint[] = [];
  const rnd = seededRandom(42);
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dow = d.toLocaleDateString(undefined, { weekday: "short" });
    const costUsd = Math.round((8 + rnd() * 120 + i * 3) * 100) / 100;
    const requests = Math.floor(400 + rnd() * 9000 + i * 50);
    const tokensOut = Math.floor(requests * (180 + rnd() * 400));
    out.push({
      day: dow,
      costUsd,
      requests,
      tokensOut,
    });
  }
  return out;
}

export function totals7d(days: DayPoint[]): { cost: number; requests: number; tokens: number } {
  return days.reduce(
    (a, d) => ({
      cost: a.cost + d.costUsd,
      requests: a.requests + d.requests,
      tokens: a.tokens + d.tokensOut,
    }),
    { cost: 0, requests: 0, tokens: 0 },
  );
}

/** Mock per-entity rollups for workspace telemetry (deterministic from keys). */
export type EntityUsage = {
  key: string;
  displayName: string;
  requests: number;
  costUsd: number;
  tokensOut: number;
};

const keyHash = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h) || 1;
};

export function mockEntityUsage(key: string, displayName: string): EntityUsage {
  const rnd = seededRandom(keyHash(key));
  const requests = 40 + Math.floor(rnd() * 12000);
  const costUsd = Math.round((rnd() * 55 + requests * 0.0008) * 100) / 100;
  const tokensOut = Math.floor(requests * (120 + rnd() * 380));
  return { key, displayName, requests, costUsd, tokensOut };
}

export function usageByUsers(usernames: string[]): EntityUsage[] {
  return usernames.map((u) => mockEntityUsage(`acct:${u}`, u));
}

export function usageByAgents(agents: { id: string; name: string }[]): EntityUsage[] {
  return agents.map((a) => mockEntityUsage(`agent:${a.id}`, a.name));
}

export function usageByWorkflows(workflows: { id: string; name: string }[]): EntityUsage[] {
  return workflows.map((w) => mockEntityUsage(`wf:${w.id}`, w.name));
}
