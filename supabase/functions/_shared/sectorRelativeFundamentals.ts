import { broadSector } from './sectorMapping.ts';

// Deno-side port of src/lib/sectorRelativeFundamentals.ts (kept in sync
// manually -- no shared build step between the Vite app and edge
// functions).
interface HasFundamentalsMetrics {
  symbol: string;
  sector: string | null;
  debt_to_equity: number | null;
  current_ratio: number | null;
  net_margin: number | null;
  revenue_growth_yoy: number | null;
  eps_growth_yoy: number | null;
}

const MIN_PEERS = 4;
export const MAX_TRUSTED_DEBT_TO_EQUITY = 10;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export interface FundamentalsBenchmark {
  sector: string;
  peerCount: number;
  medianDebtToEquity: number | null;
  medianCurrentRatio: number | null;
  medianNetMargin: number | null;
  medianRevenueGrowth: number | null;
  medianEpsGrowth: number | null;
}

export function computeFundamentalsBenchmarks(rows: HasFundamentalsMetrics[]): Map<string, FundamentalsBenchmark> {
  const bySector = new Map<string, HasFundamentalsMetrics[]>();
  for (const r of rows) {
    const s = broadSector(r.symbol, r.sector);
    if (!bySector.has(s)) bySector.set(s, []);
    bySector.get(s)!.push(r);
  }
  const out = new Map<string, FundamentalsBenchmark>();
  for (const [sector, peers] of bySector) {
    const de = peers.map(p => p.debt_to_equity).filter((v): v is number => v !== null && v >= 0 && v <= MAX_TRUSTED_DEBT_TO_EQUITY);
    const cr = peers.map(p => p.current_ratio).filter((v): v is number => v !== null && v > 0);
    const nm = peers.map(p => p.net_margin).filter((v): v is number => v !== null);
    const rg = peers.map(p => p.revenue_growth_yoy).filter((v): v is number => v !== null);
    const eg = peers.map(p => p.eps_growth_yoy).filter((v): v is number => v !== null);
    out.set(sector, {
      sector,
      peerCount: peers.length,
      medianDebtToEquity: de.length >= MIN_PEERS ? median(de) : null,
      medianCurrentRatio: cr.length >= MIN_PEERS ? median(cr) : null,
      medianNetMargin: nm.length >= MIN_PEERS ? median(nm) : null,
      medianRevenueGrowth: rg.length >= MIN_PEERS ? median(rg) : null,
      medianEpsGrowth: eg.length >= MIN_PEERS ? median(eg) : null,
    });
  }
  return out;
}

function clamp(n: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, n)); }

export function relativeScoreLowerBetter(value: number | null, sectorMedian: number | null): number | null {
  if (value === null || value < 0 || sectorMedian === null || sectorMedian <= 0) return null;
  const ratio = value / sectorMedian;
  return clamp(50 - (ratio - 1) * 100, 0, 100);
}

export function relativeScoreHigherBetterRatio(value: number | null, sectorMedian: number | null): number | null {
  if (value === null || value <= 0 || sectorMedian === null || sectorMedian <= 0) return null;
  const ratio = value / sectorMedian;
  return clamp(50 + (ratio - 1) * 100, 0, 100);
}

export function relativeScoreDiff(value: number | null, sectorMedian: number | null, sensitivity: number): number | null {
  if (value === null || sectorMedian === null) return null;
  return clamp(50 + (value - sectorMedian) * sensitivity, 0, 100);
}
