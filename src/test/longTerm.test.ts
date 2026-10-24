import { describe, expect, it } from 'vitest';
import { longTermContext, yearReturn, type DailyBar } from '@/lib/longTerm';
import { buildReadingStory } from '@/lib/readingStory';
import type { Stock } from '@/lib/mockData';

const series = (n: number, from: number, to: number): DailyBar[] =>
  Array.from({ length: n }, (_, i) => { const c = from + ((to - from) * i) / (n - 1); return { t: `2026-01-01T00:00:00Z`, o: c, h: c * 1.01, l: c * 0.99, c }; });

describe('longTermContext', () => {
  it('needs enough history', () => {
    expect(longTermContext(series(60, 100, 110))).toBeNull();
    expect(longTermContext(undefined)).toBeNull();
  });

  it('computes the year return, distance from the high, and the 200-day gap', () => {
    const c = longTermContext(series(253, 100, 150), series(253, 100, 120))!;
    expect(c.return12m).toBeCloseTo(50, 5);
    expect(c.marketReturn12m).toBeCloseTo(20, 5);
    expect(c.fromHigh).toBeLessThan(0);
    expect(c.fromHigh!).toBeGreaterThan(-2); // closing at the top; high is 1% above the last close
    expect(c.vs200!).toBeGreaterThan(0);
  });

  it('refuses a "12 month" return from a short window', () => {
    expect(yearReturn(series(150, 100, 120))).toBeNull();
  });
});

describe('story past-year section', () => {
  const stock: Stock = {
    symbol: 'TEST', name: 'Test', price: 150, change: 0, changePercent: 0, volume: 0, signal: 'buy', signalScore: 67, entry: 150, exit: 150,
    rsi: 55, macd: 0, sma20: 145, ema9: 148, macdHistogram: 1, bollingerPctB: 0.6,
  };
  it('describes the year in plain words, with the market as a yardstick', () => {
    const lt = longTermContext(series(253, 100, 150), series(253, 100, 120))!;
    const s = buildReadingStory(stock, null, lt)!;
    expect(s.pastYear?.[0]).toContain('up 50.0%');
    expect(s.pastYear?.[0]).toContain('S&P 500');
    expect(JSON.stringify(s)).not.toMatch(/\b(should|buy now|sell now)\b/i);
  });
  it('omits the section when there is no yearly data', () => {
    expect(buildReadingStory(stock, null, null)!.pastYear).toBeNull();
  });
});
