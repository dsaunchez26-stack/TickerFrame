import { describe, expect, it } from 'vitest';
import { buildReadingStory } from '@/lib/readingStory';
import type { Stock } from '@/lib/mockData';

const base: Stock = {
  symbol: 'TEST', name: 'Test Co', price: 100, change: 0, changePercent: 0, volume: 0, signal: 'hold', signalScore: 0, entry: 100, exit: 100,
  rsi: 50, macd: 0, sma20: 100, ema9: 100, macdHistogram: 0, bollingerPctB: 0.5,
};
const strong = { ...base, price: 105, ema9: 103, sma20: 100, macdHistogram: 1, rsi: 60, bollingerPctB: 0.8, signal: 'buy' as const, signalScore: 67 };
const fund = { balance_sheet_score: 80, growth_score: 70, pe_ratio: 25.4, week52_low: 80, week52_high: 120, dividend_yield: 1.2, revenue_growth_yoy: 10, net_margin: 20 };

describe('buildReadingStory', () => {
  it('returns null when there is no reading yet', () => {
    expect(buildReadingStory({ ...base, signalScore: null })).toBeNull();
  });

  it('describes a bullish stock in plain words', () => {
    const s = buildReadingStory(strong)!;
    expect(s.tone).toBe('bullish');
    expect(s.headline).toContain('trending up');
    expect(s.shortTerm[0]).toContain('5.0% above');
    expect(s.shortTerm.join(' ')).toContain('Momentum is positive');
  });

  it('flags an overbought run in the headline', () => {
    const s = buildReadingStory({ ...strong, rsi: 78 })!;
    expect(s.tone).toBe('neutral');
    expect(s.headline).toContain('risen fast');
    expect(s.shortTerm.join(' ')).toContain('overbought');
  });

  it('says when trend and momentum disagree', () => {
    const s = buildReadingStory({ ...base, price: 101, sma20: 100, ema9: 100, macdHistogram: -1 })!;
    expect(s.tone).toBe('neutral');
    expect(s.headline).toContain('momentum is fading');
  });

  it('lists what would change the reading, and only changes that matter', () => {
    const s = buildReadingStory(strong)!;
    expect(s.flips.length).toBeGreaterThan(0);
    expect(s.flips.every((f) => /Neutral|Bearish/.test(f))).toBe(true);
  });

  it('explains a conflict between weak price action and healthy financials', () => {
    const bear = { ...base, price: 90, ema9: 92, sma20: 100, macdHistogram: -1, rsi: 45, bollingerPctB: 0.1, signal: 'sell' as const, signalScore: -67 };
    const s = buildReadingStory(bear, fund)!;
    expect(s.conflict).toContain('financials are healthy');
    expect(s.longTerm?.[0]).toContain('strong (80/100)');
  });

  it('never gives instructions', () => {
    const text = JSON.stringify(buildReadingStory(strong, fund));
    expect(text).not.toMatch(/\b(should|buy now|sell now|you must)\b/i);
  });
});
