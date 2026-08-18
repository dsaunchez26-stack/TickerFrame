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

interface LiveQuote { price: number; prevClose: number; changePercent: number }

export const StockDetailModal = ({ symbol, onClose }: Props) => {
  const { data } = useStockData();
  const stock = useMemo(() => data?.stocks.find(s => s.symbol === symbol) ?? null, [data, symbol]);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // For a ticker outside the ~114 we actively track, there's no cached
  // price/history to fall back on -- reuse the same on-demand Finnhub quote
  // fetch already used for untracked portfolio holdings, so search isn't
  // limited to only the names this app happens to scan.
  const [liveQuote, setLiveQuote] = useState<LiveQuote | null>(null);
  const [liveQuoteError, setLiveQuoteError] = useState<string | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);

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

  useEffect(() => {
    setLiveQuote(null);
    setLiveQuoteError(null);
    if (!symbol || stock) return; // already have rich tracked data, no need for a fallback quote
    let cancelled = false;
    setLoadingQuote(true);
    supabase.functions.invoke('fetch-portfolio-quotes', { body: { symbols: [symbol] } }).then(({ data, error }) => {
      if (cancelled) return;
      setLoadingQuote(false);
      const q = data?.quotes?.[symbol];
      if (error || !q) { setLiveQuoteError(`No data found for ${symbol} — check the ticker and try again.`); return; }
      setLiveQuote(q as LiveQuote);
    });
    return () => { cancelled = true; };
  }, [symbol, stock]);

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
            {!loadingHistory && candles.length >= 2 && (
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-3" style={{ backgroundColor: '#f0b429' }} />moving average</span>
                <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-3 border-t border-dashed border-muted-foreground" />last close</span>
              </div>
            )}
            <div className="h-48">
              {loadingHistory ? (
                <div className="flex h-full items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : candles.length < 2 ? (
                <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Not enough price history yet — check back soon.</div>
              ) : (
                <CandlestickChart candles={candles} height={192} tickInterval={Math.ceil(candles.length / 6)} />
              )}
            </div>
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div><div className="text-muted-foreground">RSI</div><div className="font-semibold">{stock.rsi}</div></div>
              <div><div className="text-muted-foreground">MACD</div><div className="font-semibold">{stock.macd.toFixed(3)}</div></div>
              <div><div className="text-muted-foreground">Volume</div><div className="font-semibold">{stock.volume > 0 ? `${(stock.volume / 1e6).toFixed(1)}M` : 'N/A'}</div></div>
            </div>
          </div>
        )}
        {!stock && loadingQuote && (
          <div className="flex h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        )}
        {!stock && !loadingQuote && liveQuoteError && (
          <p className="py-6 text-center text-xs text-muted-foreground">{liveQuoteError}</p>
        )}
        {!stock && !loadingQuote && liveQuote && (
          <div className="space-y-2">
            <div className="flex items-baseline gap-3">
              <span className="text-2xl font-bold">${liveQuote.price.toFixed(2)}</span>
              <span className={liveQuote.changePercent >= 0 ? 'text-signal-buy' : 'text-signal-sell'}>
                {liveQuote.changePercent >= 0 ? '+' : ''}{liveQuote.changePercent.toFixed(2)}%
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {symbol} isn't part of this site's actively-tracked list, so there's no chart, RSI/MACD, or pattern detection for it here — just a live price.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
