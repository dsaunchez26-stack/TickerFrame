import { describe, expect, it } from 'vitest';
import { signalFactors, formatPoints } from '@/lib/signalBreakdown';
import { signalLabel } from '@/lib/signalLabel';
import type { Stock } from '@/lib/mockData';

const base: Stock = {
  symbol: 'TEST', name: 'Test Co', price: 100, change: 0, changePercent: 0, volume: 0, signal: 'hold', entry: 100, exit: 100,
  rsi: 50, macd: 0, sma20: 100, ema9: 100, macdHistogram: 0, bollingerPctB: 0.5,
};
const total = (s: Stock) => signalFactors(s).reduce((sum, f) => sum + (f.points ?? 0), 0);

describe('signalFactors (mirrors the scanner\'s points rule)', () => {
  it('scores a flat stock at zero', () => {
    expect(total(base)).toBe(0);
  });

  it('matches the live AAPL example: above trend, momentum building, neutral RSI = +5', () => {
    const aapl: Stock = { ...base, price: 333.69, sma20: 332.19, ema9: 333, rsi: 67.2, macdHistogram: 0.3, bollingerPctB: 0.74 };
    expect(total(aapl)).toBe(5);
    expect(Math.round((total(aapl) / 8) * 100)).toBe(63);
  });

  it('maxes out at +8 and -8, so the score spans -100 to +100', () => {
    expect(total({ ...base, price: 110, ema9: 108, sma20: 100, macdHistogram: 1, rsi: 25, bollingerPctB: 0.01 })).toBe(8);
    expect(total({ ...base, price: 90, ema9: 92, sma20: 100, macdHistogram: -1, rsi: 75, bollingerPctB: 0.99 })).toBe(-8);
  });

  it('treats overbought as a negative even in an uptrend', () => {
    const hot = { ...base, price: 110, ema9: 108, sma20: 100, macdHistogram: 1, rsi: 80, bollingerPctB: 0.99 };
    expect(total(hot)).toBe(2);
  });

  it('leaves MACD and Bollinger unscored (null) when their inputs are missing', () => {
    const f = signalFactors({ ...base, macdHistogram: null, bollingerPctB: null });
    expect(f.find((x) => x.key === 'macd')?.points).toBeNull();
    expect(f.find((x) => x.key === 'bb')?.points).toBeNull();
  });

  it('formats points with a sign', () => {
    expect(formatPoints(2)).toBe('+2');
    expect(formatPoints(-1)).toBe('-1');
    expect(formatPoints(0)).toBe('0');
    expect(formatPoints(null)).toBe('-');
  });
});

describe('signalLabel', () => {
  it('shows readings, never instructions', () => {
    expect(signalLabel('buy')).toBe('Bullish');
    expect(signalLabel('sell')).toBe('Bearish');
    expect(signalLabel('hold')).toBe('Neutral');
  });
});
