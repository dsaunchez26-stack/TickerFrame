export interface PricePoint {
  price: number;
  recordedAt: string;
}

export interface Candle {
  timestamp: number;
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

// We only have point-in-time price snapshots (no exchange OHLC ticks), so each
// candle is synthesized from whatever samples landed in its bucket: open/close
// are the first/last sample, high/low are the extremes seen. `points` must
// already be in chronological (ascending) order for open/close to come out right.
// `includeDate` labels each bucket with its date, not just time-of-day --
// needed once a view spans more than one calendar day, where "3:30 PM"
// alone would be ambiguous about which day it belongs to.
export function bucketCandles(points: PricePoint[], bucketMinutes: number, includeDate = false): Candle[] {
  if (!points.length) return [];
  const bucketMs = bucketMinutes * 60_000;
  const buckets = new Map<number, number[]>();
  for (const p of points) {
    const t = new Date(p.recordedAt).getTime();
    const bucketStart = Math.floor(t / bucketMs) * bucketMs;
    const list = buckets.get(bucketStart);
    if (list) list.push(p.price);
    else buckets.set(bucketStart, [p.price]);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a - b)
    .map(([bucketStart, prices]) => ({
      timestamp: bucketStart,
      time: includeDate
        ? new Date(bucketStart).toLocaleDateString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
        : new Date(bucketStart).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
      open: prices[0],
      close: prices[prices.length - 1],
      high: Math.max(...prices),
      low: Math.min(...prices),
    }));
}

export interface DailyClosePoint {
  tradeDate: string;
  closePrice: number;
}

// One real closing (well, last-observed) price per day -- no intraday
// open/high/low exists for these, so each "candle" is necessarily flat
// (O=H=L=C). Still useful plotted as a line or thin ticks; not a
// fabrication, just an honest reflection of what a single daily sample
// actually is.
export function dailyClosesToCandles(points: DailyClosePoint[]): Candle[] {
  return points.map(p => {
    const d = new Date(`${p.tradeDate}T00:00:00`);
    return {
      timestamp: d.getTime(),
      time: d.toLocaleDateString([], { month: 'short', day: 'numeric' }),
      open: p.closePrice,
      high: p.closePrice,
      low: p.closePrice,
      close: p.closePrice,
    };
  });
}
