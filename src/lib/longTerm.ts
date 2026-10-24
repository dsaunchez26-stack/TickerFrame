// Longer-term price context from a year of daily bars. Purely descriptive:
// where the stock sits against its own past year (and against the S&P 500),
// not a score and not part of the Bullish/Neutral/Bearish reading.
export interface DailyBar { t: string; o: number; h: number; l: number; c: number; v?: number }

export interface LongTermContext {
  bars: number;
  return12m: number | null;   // % change over the available year (null if under ~11 months of data)
  return3m: number | null;    // % change over the last ~63 trading days
  fromHigh: number | null;    // % below the 52-week high (<= 0)
  fromLow: number | null;     // % above the 52-week low (>= 0)
  vs200: number | null;       // % above/below the 200-day average
  marketReturn12m: number | null; // same-length return for the benchmark, when supplied
}

const pct = (a: number, b: number) => (b > 0 ? (a / b - 1) * 100 : null);

export function yearReturn(bars: DailyBar[]): number | null {
  if (bars.length < 230) return null;
  return pct(bars[bars.length - 1].c, bars[Math.max(0, bars.length - 253)].c);
}

export function longTermContext(bars: DailyBar[] | undefined, benchmark?: DailyBar[]): LongTermContext | null {
  if (!bars || bars.length < 120) return null;
  const last = bars[bars.length - 1].c;
  const year = bars.slice(-253);
  const high = Math.max(...year.map((b) => b.h));
  const low = Math.min(...year.map((b) => b.l));
  const sma200 = bars.length >= 200 ? bars.slice(-200).reduce((s, b) => s + b.c, 0) / 200 : null;
  return {
    bars: bars.length,
    return12m: yearReturn(bars),
    return3m: bars.length > 63 ? pct(last, bars[bars.length - 64].c) : null,
    fromHigh: pct(last, high),
    fromLow: pct(last, low),
    vs200: sma200 ? pct(last, sma200) : null,
    marketReturn12m: benchmark ? yearReturn(benchmark) : null,
  };
}
