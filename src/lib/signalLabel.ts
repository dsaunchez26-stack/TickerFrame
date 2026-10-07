import type { Stock } from '@/lib/mockData';

// The stored values stay buy/hold/sell (database + scoring code), but what the
// site shows are descriptive readings, not instructions: the rule measures
// whether trend and momentum lean up or down, it doesn't tell anyone what to do.
export const signalLabel = (signal: Stock['signal']) =>
  signal === 'buy' ? 'Bullish' : signal === 'sell' ? 'Bearish' : 'Neutral';
