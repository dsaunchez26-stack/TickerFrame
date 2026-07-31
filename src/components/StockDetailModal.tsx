import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useStockData } from '@/hooks/useStockData';
import { supabase } from '@/integrations/supabase/client';
import { PatternBadge } from '@/components/PatternBadge';
import { CandlestickChart } from '@/components/CandlestickChart';
import { bucketCandles, type Candle } from '@/lib/candles';
import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';

interface Props {
  symbol: string | null;
  onClose: () => void;
}

export const StockDetailModal = ({ symbol, onClose }: Props) => {
  const { data } = useStockData();
  const stock = useMemo(() => data?.stocks.find(s => s.symbol === symbol) ?? null, [data, symbol]);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (!symbol) { setCandles([]); return; }
    let cancelled = false;
    setLoadingHistory(true);
    supabase
      .from('stock_price_history')
      .select('price, recorded_at')
      .eq('symbol', symbol)
      // Order descending + limit to actually get the newest samples (an
      // ascending order here would return the OLDEST surviving rows instead,
      // silently showing a stale slice from near the 7-day retention edge),
      // then reverse back to chronological order for candle bucketing.
      .order('recorded_at', { ascending: false })
      .limit(180)
      .then(({ data: rows }) => {
        if (cancelled) return;
        const points = (rows ?? [])
          .map(r => ({ price: Number(r.price), recordedAt: r.recorded_at }))
          .reverse();
        setCandles(bucketCandles(points, 15));
        setLoadingHistory(false);
      });
    return () => { cancelled = true; };
  }, [symbol]);

  return (
    <Dialog open={!!symbol} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {symbol}
            {stock?.pattern && <PatternBadge pattern={stock.pattern} confidence={stock.patternConfidence} />}
          </DialogTitle>
        </DialogHeader>
        {stock && (
          <div className="space-y-4">
            <div className="flex items-baseline gap-3">
              <span className="text-2xl font-bold">${stock.price.toFixed(2)}</span>
              <span className={stock.change >= 0 ? 'text-signal-buy' : 'text-signal-sell'}>
                {stock.change >= 0 ? '+' : ''}{stock.change.toFixed(2)} ({stock.changePercent.toFixed(2)}%)
              </span>
            </div>
            <div className="h-48">
              {loadingHistory ? (
                <div className="flex h-full items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : candles.length < 2 ? (
                <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Not enough price history yet — check back soon.</div>
              ) : (
                <CandlestickChart candles={candles} height={192} showGrid={false} tickInterval={Math.ceil(candles.length / 6)} />
              )}
            </div>
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div><div className="text-muted-foreground">RSI</div><div className="font-semibold">{stock.rsi}</div></div>
              <div><div className="text-muted-foreground">MACD</div><div className="font-semibold">{stock.macd.toFixed(3)}</div></div>
              <div><div className="text-muted-foreground">Volume</div><div className="font-semibold">{stock.volume > 0 ? `${(stock.volume / 1e6).toFixed(1)}M` : 'N/A'}</div></div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
