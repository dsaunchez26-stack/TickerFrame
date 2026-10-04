import type { Stock } from '@/lib/mockData';

// Mirrors signalPoints() in supabase/functions/fetch-stock-data/index.ts --
// keep the two in sync. The server decides the label; this recomputes the
// per-factor points from the same stored inputs purely so the UI can show the
// user the evidence behind it.
export interface SignalFactor {
  key: string;
  label: string;
  detail: string;
  points: number | null; // null = input not available yet
  max: number;
}

const sign = (n: number) => (n > 0 ? `+${n}` : `${n}`);

export const signalFactors = (s: Stock): SignalFactor[] => {
  const trendPts = s.price > s.sma20 ? 2 : s.price < s.sma20 ? -2 : 0;
  const emaPts = s.ema9 > s.sma20 ? 1 : s.ema9 < s.sma20 ? -1 : 0;
  const macdPts = s.macdHistogram == null ? null : s.macdHistogram > 0 ? 2 : s.macdHistogram < 0 ? -2 : 0;
  const rsiPts = s.rsi <= 30 ? 2 : s.rsi >= 70 ? -2 : 0;
  const b = s.bollingerPctB;
  const bbPts = b == null ? 0 : b <= 0.05 ? 1 : b >= 0.95 ? -1 : 0;

  return [
    { key: 'trend', label: 'Price vs 20-SMA', detail: `$${s.price.toFixed(2)} ${s.price >= s.sma20 ? 'above' : 'below'} $${s.sma20.toFixed(2)}`, points: trendPts, max: 2 },
    { key: 'ema', label: '9-EMA vs 20-SMA', detail: `short-term average ${s.ema9 >= s.sma20 ? 'above' : 'below'} the 20-SMA`, points: emaPts, max: 1 },
    { key: 'macd', label: 'MACD momentum', detail: s.macdHistogram == null ? 'updating on next refresh' : `histogram ${s.macdHistogram >= 0 ? 'positive - building' : 'negative - fading'}`, points: macdPts, max: 2 },
    { key: 'rsi', label: 'RSI (14)', detail: `${s.rsi.toFixed(1)} - ${s.rsi <= 30 ? 'oversold' : s.rsi >= 70 ? 'overbought' : 'neutral range'}`, points: rsiPts, max: 2 },
    { key: 'bb', label: 'Bollinger %B', detail: b == null ? 'not enough history yet' : `${b.toFixed(2)} - ${b <= 0.05 ? 'at lower band' : b >= 0.95 ? 'at upper band' : 'inside the bands'}`, points: b == null ? null : bbPts, max: 1 },
  ];
};

export const formatPoints = (p: number | null) => (p === null ? '-' : sign(p));
