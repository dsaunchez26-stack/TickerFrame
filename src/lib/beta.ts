// Beta from daily bars, the same arithmetic as supabase/functions/stock-betas (keep in sync).
// Used by the demo, which computes betas in the browser from its saved candles.
export interface BetaResult { beta: number; r2: number | null; volatility: number | null; observations: number }

export function computeBeta(stock: Map<string, number>, market: Map<string, number>, minObservations = 100): BetaResult | null {
  const dates = [...stock.keys()].filter((d) => market.has(d)).sort();
  if (dates.length < minObservations + 1) return null;
  const rs: number[] = [], rm: number[] = [];
  for (let i = 1; i < dates.length; i++) {
    const s0 = stock.get(dates[i - 1])!, s1 = stock.get(dates[i])!, m0 = market.get(dates[i - 1])!, m1 = market.get(dates[i])!;
    if (s0 > 0 && m0 > 0) { rs.push(s1 / s0 - 1); rm.push(m1 / m0 - 1); }
  }
  const n = rs.length;
  if (n < minObservations) return null;
  const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  const ms = mean(rs), mm = mean(rm);
  let cov = 0, vm = 0, vs = 0;
  for (let i = 0; i < n; i++) { cov += (rs[i] - ms) * (rm[i] - mm); vm += (rm[i] - mm) ** 2; vs += (rs[i] - ms) ** 2; }
  if (vm === 0) return null;
  return { beta: cov / vm, r2: vs > 0 ? (cov * cov) / (vm * vs) : null, volatility: Math.sqrt(vs / (n - 1)) * Math.sqrt(252) * 100, observations: n };
}
