import { describe, expect, it } from 'vitest';
import { erasWithin, historyStats, parseHistory } from '@/lib/longHistory';

const day = 86400;

describe('parseHistory', () => {
  it('converts seconds to ms and skips bad rows', () => {
    const pts = parseHistory({ t: [1, 2, 3], c: [10, NaN, 12], a: [5, 6, 0] });
    expect(pts).toEqual([
      { t: 1000, close: 10, adj: 5 },
      { t: 3000, close: 12, adj: 12 },
    ]);
  });
  it('returns [] for empty or malformed input', () => {
    expect(parseHistory(null)).toEqual([]);
    expect(parseHistory({})).toEqual([]);
  });
});

describe('historyStats', () => {
  const start = Date.UTC(2000, 0, 1) / 1000;
  const mk = (closes: number[], adj = closes) => parseHistory({
    t: closes.map((_, i) => start + i * 365.25 * day),
    c: closes,
    a: adj,
  });

  it('computes change, CAGR and max drawdown', () => {
    const s = historyStats(mk([100, 200, 100, 400]))!;
    expect(s.priceChangePct).toBeCloseTo(300);
    expect(s.years).toBeCloseTo(3, 1);
    expect(s.cagrPct).toBeCloseTo((Math.pow(4, 1 / 3) - 1) * 100, 1);
    expect(s.maxDrawdown.pct).toBeCloseTo(-50);
  });
  it('uses the dividend-adjusted series for total return', () => {
    const s = historyStats(mk([100, 100], [50, 100]))!;
    expect(s.priceChangePct).toBeCloseTo(0);
    expect(s.totalReturnPct).toBeCloseTo(100);
  });
  it('returns null with fewer than two points and no CAGR under a year', () => {
    expect(historyStats(mk([1]))).toBeNull();
    const short = parseHistory({ t: [start, start + 30 * day], c: [1, 2] });
    expect(historyStats(short)!.cagrPct).toBeNull();
  });
});

describe('erasWithin', () => {
  it('keeps overlapping eras clipped to the window', () => {
    const a = Date.UTC(2008, 0, 1);
    const b = Date.UTC(2021, 0, 1);
    const labels = erasWithin(a, b).map(e => e.label);
    expect(labels).toEqual(['Financial crisis', 'COVID crash']);
    expect(erasWithin(a, b)[0].from).toBe(a);
  });
});
