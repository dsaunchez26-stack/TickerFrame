import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { parseHistory, type HistoryPoint, type LongRange } from '@/lib/longHistory';

// Old prices don't change, so a session-level cache avoids refetching when the
// user flips between ranges or reopens the same stock.
const cache = new Map<string, { points: HistoryPoint[]; interval: 'week' | 'month' }>();

export function useStockHistory(symbol: string | null, range: LongRange | null) {
  const [points, setPoints] = useState<HistoryPoint[]>([]);
  const [interval, setInterval] = useState<'week' | 'month'>('month');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!symbol || !range) { setPoints([]); setLoading(false); setError(null); return; }
    const key = `${symbol}:${range}`;
    const hit = cache.get(key);
    if (hit) { setPoints(hit.points); setInterval(hit.interval); setLoading(false); setError(null); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    supabase.functions.invoke('stock-history', { body: { symbol, range } }).then(({ data, error: err }) => {
      if (cancelled) return;
      const parsed = parseHistory(data);
      if (err || data?.error || parsed.length < 2) {
        setPoints([]);
        setError(data?.error ?? 'Long-term history is not available for this symbol.');
      } else {
        const iv = data.interval === 'week' ? 'week' : 'month';
        cache.set(key, { points: parsed, interval: iv });
        setPoints(parsed);
        setInterval(iv);
      }
      setLoading(false);
    }).catch(() => {
      if (cancelled) return;
      setPoints([]);
      setError('Long-term history is not available right now.');
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [symbol, range]);

  return { points, interval, loading, error };
}
