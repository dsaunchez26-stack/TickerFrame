import type { Stock } from '@/lib/mockData';

// Mirrors signalPoints() in supabase/functions/fetch-stock-data/index.ts --
// keep the two in sync. The server decides the label; this recomputes the
// points from the same stored inputs purely so the UI can show the evidence.
// Three pillars, each -2..+2, so the total spans -6..+6 (-100..+100 on screen).
export interface SignalFactor {
  key: 'trend' | 'momentum' | 'stretch';
  label: string;
  detail: string;
  points: number | null; // null = input not available yet
  max: number;
}

export const BULLISH_AT = 4; // points

const sign = (n: number) => (n > 0 ? 1 : n < 0 ? -1 : 0);
const sgn = (n: number) => (n > 0 ? `+${n}` : `${n}`);

// Individual point values, shared with the plain-English story.
export const pillarPoints = (s: Stock) => {
  const trend = sign(s.price - s.sma20) + sign(s.ema9 - s.sma20);
  const momentum = s.macdHistogram == null ? null : s.macdHistogram > 0 ? 2 : s.macdHistogram < 0 ? -2 : 0;
  const b = s.bollingerPctB;
  const stretch = (s.rsi <= 30 ? 1 : s.rsi >= 70 ? -1 : 0) + (b == null ? 0 : b <= 0.05 ? 1 : b >= 0.95 ? -1 : 0);
  return { trend, momentum, stretch };
};

export const signalFactors = (s: Stock): SignalFactor[] => {
  const p = pillarPoints(s);
  const b = s.bollingerPctB;
  const priceSide = s.price >= s.sma20 ? 'above' : 'below';
  const fastSide = s.ema9 >= s.sma20 ? 'above' : 'below';
  const rsiText = s.rsi <= 30 ? 'oversold' : s.rsi >= 70 ? 'overbought' : 'normal range';
  const bbText = b == null ? '' : b <= 0.05 ? ', at the bottom of its range' : b >= 0.95 ? ', at the top of its range' : '';

  return [
    { key: 'trend', label: 'Trend', detail: `price $${s.price.toFixed(2)} ${priceSide} its $${s.sma20.toFixed(2)} average; latest prices ${fastSide} the older ones`, points: p.trend, max: 2 },
    { key: 'momentum', label: 'Momentum', detail: s.macdHistogram == null ? 'updating on next refresh' : `MACD ${s.macdHistogram >= 0 ? 'positive - gains building' : 'negative - gains fading'}`, points: p.momentum, max: 2 },
    { key: 'stretch', label: 'Stretch', detail: `RSI ${s.rsi.toFixed(1)} (${rsiText})${bbText}`, points: p.stretch, max: 2 },
  ];
};

export const totalPoints = (s: Stock) => signalFactors(s).reduce((sum, f) => sum + (f.points ?? 0), 0);

export const formatPoints = (p: number | null) => (p === null ? '-' : sgn(p));
