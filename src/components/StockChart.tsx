import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useStockData } from '@/hooks/useStockData';
import { CandlestickChart } from '@/components/CandlestickChart';
import { useStockCandles, TIMEFRAMES, type Timeframe } from '@/hooks/useStockCandles';
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
  const [timeframe, setTimeframe] = useState<Timeframe>('1D');
  const { candles, loading } = useStockCandles(symbol || null, timeframe);

  useEffect(() => {
    if (!symbol && stocks.length) setSymbol(stocks[0].symbol);
  }, [stocks, symbol]);

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
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-3" style={{ backgroundColor: '#f0b429' }} />moving average</span>
            <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-3 border-t border-dashed border-muted-foreground" />last close</span>
          </div>
          <div className="flex items-center gap-0.5 rounded-md border border-border p-0.5 text-[10px]">
            {TIMEFRAMES.map(tf => (
              <button
                key={tf.key}
                onClick={() => setTimeframe(tf.key)}
                className={`rounded px-1.5 py-0.5 ${timeframe === tf.key ? 'bg-secondary font-semibold' : 'text-muted-foreground'}`}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>
        <div className="h-64">
          {loading ? (
            <div className="flex h-full items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : candles.length < 2 ? (
            <div className="flex h-full flex-col items-center justify-center gap-1 text-center text-xs text-muted-foreground">
              <span>Not enough price history yet for this range.</span>
              {(timeframe === '1M' || timeframe === '3M' || timeframe === '1Y') && (
                <span className="text-[10px] text-muted-foreground/70">Longer views fill in as more days of data are collected — try 1D/3D/1W for now.</span>
              )}
            </div>
          ) : (
            <CandlestickChart candles={candles} height={256} tickInterval={Math.ceil(candles.length / 8)} />
          )}
        </div>
      </CardContent>
    </Card>
  );
};
