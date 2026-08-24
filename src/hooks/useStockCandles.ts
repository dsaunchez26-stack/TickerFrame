import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { bucketCandles, dailyClosesToCandles, type Candle } from '@/lib/candles';

export type Timeframe = '1D' | '3D' | '1W' | '1M' | '3M' | '1Y';

export const TIMEFRAMES: { key: Timeframe; label: string }[] = [
  { key: '1D', label: '1D' },
  { key: '3D', label: '3D' },
  { key: '1W', label: '1W' },
  { key: '1M', label: '1M' },
  { key: '3M', label: '3M' },
  { key: '1Y', label: '1Y' },
];

// 1D/3D/1W come from stock_price_history (real 5-min samples, 7-day
// retention) at progressively coarser buckets. 1M/3M/1Y come from
// daily_closes instead -- Finnhub's free tier has no historical daily
// candles to backfill with, so that table only started accumulating the
// day this feature shipped. Those longer views will be sparse for a
// while and fill in for real as more days pass; there's no fabricated or
// estimated data standing in for what hasn't been collected yet.
const CONFIG: Record<Timeframe, { source: 'intraday' | 'daily'; lookbackDays: number; bucketMinutes?: number }> = {
  '1D': { source: 'intraday', lookbackDays: 1, bucketMinutes: 5 },
  '3D': { source: 'intraday', lookbackDays: 3, bucketMinutes: 30 },
  '1W': { source: 'intraday', lookbackDays: 7, bucketMinutes: 60 },
  '1M': { source: 'daily', lookbackDays: 31 },
  '3M': { source: 'daily', lookbackDays: 92 },
  '1Y': { source: 'daily', lookbackDays: 366 },
};

const PAGE_SIZE = 1000;

export function useStockCandles(symbol: string | null, timeframe: Timeframe) {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!symbol) { setCandles([]); return; }
    let cancelled = false;
    setLoading(true);

    const cfg = CONFIG[timeframe];
    const cutoff = new Date(Date.now() - cfg.lookbackDays * 86400_000).toISOString();

    const run = async () => {
      if (cfg.source === 'intraday') {
        // 7 days of 5-min samples (24/7 collection) can run past 1000 rows,
        // which PostgREST silently caps at regardless of an explicit
        // .limit() -- paginate with .range() the same way the scanners do
        // for this exact table, capped a little above the theoretical max
        // for this window so nothing gets truncated.
        const target = Math.ceil(cfg.lookbackDays * 300);
        const points: Array<{ price: number; recordedAt: string }> = [];
        for (let offset = 0; offset < target; offset += PAGE_SIZE) {
          const { data: page } = await supabase
            .from('stock_price_history')
            .select('price, recorded_at')
            .eq('symbol', symbol)
            .gte('recorded_at', cutoff)
            .order('recorded_at', { ascending: false })
            .range(offset, Math.min(offset + PAGE_SIZE, target) - 1);
          if (!page || page.length === 0) break;
          points.push(...page.map(r => ({ price: Number(r.price), recordedAt: r.recorded_at })));
          if (page.length < PAGE_SIZE) break;
        }
        if (cancelled) return;
        points.reverse();
        setCandles(bucketCandles(points, cfg.bucketMinutes!, cfg.lookbackDays > 1));
      } else {
        const { data: rows } = await supabase
          .from('daily_closes')
          .select('trade_date, close_price')
          .eq('symbol', symbol)
          .gte('trade_date', cutoff.slice(0, 10))
          .order('trade_date', { ascending: true });
        if (cancelled) return;
        setCandles(dailyClosesToCandles(
          (rows ?? []).map(r => ({ tradeDate: r.trade_date, closePrice: Number(r.close_price) })),
        ));
      }
      if (!cancelled) setLoading(false);
    };
    run();
    return () => { cancelled = true; };
  }, [symbol, timeframe]);

  return { candles, loading };
}
