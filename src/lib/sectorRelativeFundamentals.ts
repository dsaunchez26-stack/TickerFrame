import { broadSector } from './sectorMapping';

// Sector-relative scoring for Balance Sheet Strength and Growth & Momentum,
// mirroring sectorRelativeValuation.ts's approach for P/E, P/B, P/S: a 15%
// net margin is mediocre for software but exceptional for a grocery chain,
// so comparing each stock against its own sector's median (not one flat
// cutoff for every industry) is a real accuracy improvement, not just a
// calibration tweak.
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

// A D/E ratio above this is far more likely to be a near-zero-book-equity
// artifact (the denominator collapsing toward 0 makes the ratio explode or
// become directionally meaningless) than a genuine, comparable leverage
// figure -- excluded from both benchmark computation and that stock's own
// score component, same reasoning as peRatio's >500 filter in
// fundamentals-scanner.
const MAX_TRUSTED_DEBT_TO_EQUITY = 10;

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

// For ratios where LOWER is better and both sides are always >= 0 (debt/
// equity): trading right at the sector median scores 50, half the sector's
// typical leverage scores 100, 1.5x the sector's typical leverage scores 0.
export function relativeScoreLowerBetter(value: number | null, sectorMedian: number | null): number | null {
  if (value === null || value < 0 || sectorMedian === null || sectorMedian <= 0) return null;
  const ratio = value / sectorMedian;
  return clamp(50 - (ratio - 1) * 100, 0, 100);
}

// Mirror image, for ratios where HIGHER is better and both sides are always
// > 0 (current ratio).
export function relativeScoreHigherBetterRatio(value: number | null, sectorMedian: number | null): number | null {
  if (value === null || value <= 0 || sectorMedian === null || sectorMedian <= 0) return null;
  const ratio = value / sectorMedian;
  return clamp(50 + (ratio - 1) * 100, 0, 100);
}

// For metrics that can be negative or zero (net margin, revenue/EPS growth),
// a ratio against the sector median breaks down (e.g. value=-10, median=5
// gives a nonsensical negative ratio) -- scored as an absolute point
// difference from the sector median instead, same sensitivity constants the
// old flat-cutoff formulas used, just re-centered on the sector's own
// typical value instead of a hardcoded 0.
export function relativeScoreDiff(value: number | null, sectorMedian: number | null, sensitivity: number): number | null {
  if (value === null || sectorMedian === null) return null;
  return clamp(50 + (value - sectorMedian) * sensitivity, 0, 100);
}

export { MAX_TRUSTED_DEBT_TO_EQUITY };
