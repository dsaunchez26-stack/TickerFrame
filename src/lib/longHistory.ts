// Long-run price history (5 to 60+ years) for the 5Y / 10Y / 20Y / MAX chart views.
// Pure helpers only; the network call lives in hooks/useStockHistory.

export type LongRange = '5Y' | '10Y' | '20Y' | 'MAX';
export const LONG_RANGES: { key: LongRange; label: string }[] = [
  { key: '5Y', label: '5Y' },
  { key: '10Y', label: '10Y' },
  { key: '20Y', label: '20Y' },
  { key: 'MAX', label: 'MAX' },
];
export const isLongRange = (v: string): v is LongRange => LONG_RANGES.some(r => r.key === v);

export interface HistoryPoint {
  t: number; // ms since epoch
  close: number; // split-adjusted
  adj: number; // split- and dividend-adjusted (total return)
}

export interface HistoryResponse {
  t: number[]; // seconds
  c: number[];
  a: number[];
  interval: 'week' | 'month';
  name?: string | null;
}

export function parseHistory(res: Partial<HistoryResponse> | null | undefined): HistoryPoint[] {
  if (!res || !Array.isArray(res.t) || !Array.isArray(res.c)) return [];
  const out: HistoryPoint[] = [];
  for (let i = 0; i < res.t.length; i++) {
    const close = res.c[i];
    const adj = res.a?.[i] ?? close;
    if (!Number.isFinite(res.t[i]) || !Number.isFinite(close) || close <= 0) continue;
    out.push({ t: res.t[i] * 1000, close, adj: Number.isFinite(adj) && adj > 0 ? adj : close });
  }
  return out;
}

export interface HistoryStats {
  years: number;
  priceChangePct: number;
  totalReturnPct: number;
  /** Compound annual growth of the dividend-adjusted series. */
  cagrPct: number | null;
  /** Deepest peak-to-trough fall in the closing prices. */
  maxDrawdown: { pct: number; peakT: number; troughT: number };
}

const YEAR_MS = 365.25 * 86400_000;

export function historyStats(points: HistoryPoint[]): HistoryStats | null {
  if (points.length < 2) return null;
  const first = points[0];
  const last = points[points.length - 1];
  const years = (last.t - first.t) / YEAR_MS;
  let peak = first;
  let worst = { pct: 0, peakT: first.t, troughT: first.t };
  for (const p of points) {
    if (p.close > peak.close) peak = p;
    const dd = (p.close / peak.close - 1) * 100;
    if (dd < worst.pct) worst = { pct: dd, peakT: peak.t, troughT: p.t };
  }
  const growth = last.adj / first.adj;
  return {
    years,
    priceChangePct: (last.close / first.close - 1) * 100,
    totalReturnPct: (growth - 1) * 100,
    cagrPct: years >= 1 ? (Math.pow(growth, 1 / years) - 1) * 100 : null,
    maxDrawdown: worst,
  };
}

export interface MarketEra { label: string; from: number; to: number }

const d = (s: string) => Date.parse(`${s}T00:00:00Z`);
// Well-known U.S. equity-market downturns (S&P 500 peak to trough), shaded on the
// chart so a reader can see how a company behaved through each one.
export const MARKET_ERAS: MarketEra[] = [
  { label: '1973-74 bear market', from: d('1973-01-11'), to: d('1974-10-03') },
  { label: '1987 crash', from: d('1987-08-25'), to: d('1987-12-04') },
  { label: 'Dot-com bust', from: d('2000-03-24'), to: d('2002-10-09') },
  { label: 'Financial crisis', from: d('2007-10-09'), to: d('2009-03-09') },
  { label: 'COVID crash', from: d('2020-02-19'), to: d('2020-03-23') },
  { label: '2022 bear market', from: d('2022-01-03'), to: d('2022-10-12') },
];

/** Eras that overlap the visible window, clipped to it. */
export function erasWithin(startT: number, endT: number): MarketEra[] {
  return MARKET_ERAS.filter(e => e.to > startT && e.from < endT).map(e => ({
    label: e.label,
    from: Math.max(e.from, startT),
    to: Math.min(e.to, endT),
  }));
}
