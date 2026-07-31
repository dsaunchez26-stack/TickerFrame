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
export function bucketCandles(points: PricePoint[], bucketMinutes: number): Candle[] {
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
      time: new Date(bucketStart).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
      open: prices[0],
      close: prices[prices.length - 1],
      high: Math.max(...prices),
      low: Math.min(...prices),
    }));
}
