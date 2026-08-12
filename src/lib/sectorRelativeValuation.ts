import { broadSector } from '@/lib/sectorMapping';

interface HasValuation {
  symbol: string;
  sector: string | null;
  ps_ratio: number | null;
  pe_ratio: number | null;
  pb_ratio: number | null;
}

// Below this many peers with real data, a "sector median" isn't trustworthy
// enough to rank against -- callers should fall back to an absolute
// benchmark instead of pretending a 2-stock median means something.
const MIN_PEERS = 4;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export interface SectorBenchmark {
  sector: string;
  peerCount: number;
  medianPS: number | null;
  medianPE: number | null;
  medianPB: number | null;
}

// One pass over every scanned stock, grouped into broad sectors, computing
// each sector's median P/S, P/E, and P/B among tracked peers that actually
// report the metric -- the real "compare it to the market" benchmark a flat
// cutoff can't provide, bounded by how many peers this app actually tracks.
export function computeSectorBenchmarks(rows: HasValuation[]): Map<string, SectorBenchmark> {
  const bySector = new Map<string, HasValuation[]>();
  for (const r of rows) {
    const s = broadSector(r.symbol, r.sector);
    if (!bySector.has(s)) bySector.set(s, []);
    bySector.get(s)!.push(r);
  }
  const out = new Map<string, SectorBenchmark>();
  for (const [sector, peers] of bySector) {
    const ps = peers.map(p => p.ps_ratio).filter((v): v is number => v !== null && v > 0);
    const pe = peers.map(p => p.pe_ratio).filter((v): v is number => v !== null && v > 0);
    const pb = peers.map(p => p.pb_ratio).filter((v): v is number => v !== null && v > 0);
    out.set(sector, {
      sector,
      peerCount: peers.length,
      medianPS: ps.length >= MIN_PEERS ? median(ps) : null,
      medianPE: pe.length >= MIN_PEERS ? median(pe) : null,
      medianPB: pb.length >= MIN_PEERS ? median(pb) : null,
    });
  }
  return out;
}

function clamp(n: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, n)); }

// Scored relative to the stock's own sector median rather than one flat
// number applied to every industry alike: trading right at the sector
// median scores 50; half the sector's typical multiple (cheap even for its
// own industry) scores 100; 1.5x the sector's typical multiple scores 0.
export function relativeScore(value: number | null, sectorMedian: number | null): number | null {
  if (value === null || value <= 0 || sectorMedian === null || sectorMedian <= 0) return null;
  const ratio = value / sectorMedian;
  return clamp(50 - (ratio - 1) * 100, 0, 100);
}
