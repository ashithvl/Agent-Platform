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
