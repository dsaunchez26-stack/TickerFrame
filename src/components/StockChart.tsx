import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useStockData } from '@/hooks/useStockData';
import { supabase } from '@/integrations/supabase/client';
import { CandlestickChart } from '@/components/CandlestickChart';
import { bucketCandles, type Candle } from '@/lib/candles';
import { Loader2 } from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

interface Props {
  // Optionally controlled so a parent page can keep another component (e.g.
  // Indicators) in sync with whatever symbol this chart is showing, instead
  // of each independently picking its own stock.
  symbol?: string;
  onSymbolChange?: (symbol: string) => void;
}

export const StockChart = ({ symbol: controlledSymbol, onSymbolChange }: Props = {}) => {
  const { data } = useStockData();
  const stocks = data?.stocks ?? [];
  const [localSymbol, setLocalSymbol] = useState('');
  const symbol = controlledSymbol ?? localSymbol;
  const setSymbol = onSymbolChange ?? setLocalSymbol;
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!symbol && stocks.length) setSymbol(stocks[0].symbol);
  }, [stocks, symbol]);

  useEffect(() => {
    if (!symbol) return;
    let cancelled = false;
    setLoading(true);
    supabase
      .from('stock_price_history')
      .select('price, recorded_at')
      .eq('symbol', symbol)
      // Descending + limit gets the newest samples; ascending + limit here
      // used to silently return the OLDEST surviving rows instead (a stale
      // slice from near the 7-day retention edge). Reversed back to
      // chronological order below before bucketing into candles.
      .order('recorded_at', { ascending: false })
      .limit(180)
      .then(({ data: rows }) => {
        if (cancelled) return;
        const points = (rows ?? [])
          .map(r => ({ price: Number(r.price), recordedAt: r.recorded_at }))
          .reverse();
        setCandles(bucketCandles(points, 15));
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [symbol]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-semibold">Price Chart</CardTitle>
        <Select value={symbol} onValueChange={setSymbol}>
          <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {stocks.map(s => <SelectItem key={s.symbol} value={s.symbol} className="text-xs">{s.symbol}</SelectItem>)}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        <div className="mb-1.5 flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-3" style={{ backgroundColor: '#f0b429' }} />moving average</span>
          <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-3 border-t border-dashed border-muted-foreground" />last close</span>
        </div>
        <div className="h-64">
          {loading ? (
            <div className="flex h-full items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : candles.length < 2 ? (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Not enough price history yet — check back soon.</div>
          ) : (
            <CandlestickChart candles={candles} height={256} tickInterval={Math.ceil(candles.length / 8)} />
          )}
        </div>
      </CardContent>
    </Card>
  );
};
