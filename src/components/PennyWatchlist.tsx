import { useMemo } from 'react';
import { Loader2, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { useStockData } from '@/hooks/useStockData';
import { useStockDetail } from '@/context/StockDetailContext';

export const PennyWatchlist = () => {
  const { data, isLoading } = useStockData();
  const { open } = useStockDetail();

  const pennyStocks = useMemo(() => {
    // Buy signals lead, then hold, then sell; biggest movers first within each tier.
    const signalTier = (s: string) => (s === 'buy' ? 0 : s === 'hold' ? 1 : 2);
    return (data?.stocks ?? [])
      .filter(s => s.price < 5)
      .sort((a, b) => {
        const tierDiff = signalTier(a.signal) - signalTier(b.signal);
        if (tierDiff !== 0) return tierDiff;
        return Math.abs(b.changePercent) - Math.abs(a.changePercent);
      });
  }, [data]);

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h3 className="font-heading text-sm font-semibold text-foreground">Penny Stock Watchlist</h3>
        <p className="text-[10px] text-muted-foreground">Sub-$5 names with the biggest moves.</p>
      </div>
      {isLoading ? (
        <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : pennyStocks.length === 0 ? (
        <p className="px-4 py-6 text-center text-xs text-muted-foreground">No sub-$5 stocks in range right now.</p>
      ) : (
        <div className="divide-y divide-border">
          {pennyStocks.slice(0, 10).map(s => (
            <div key={s.symbol} className="flex cursor-pointer items-center justify-between px-4 py-2.5 hover:bg-secondary/50" onClick={() => open(s.symbol)}>
              <div>
                <span className="font-heading text-xs font-semibold text-foreground">{s.symbol}</span>
                <p className="truncate text-[10px] text-muted-foreground">{s.name}</p>
              </div>
              <div className="text-right">
                <p className="font-heading text-xs font-semibold text-foreground">${s.price.toFixed(2)}</p>
                <p className={`flex items-center justify-end gap-0.5 text-[10px] font-medium ${s.change >= 0 ? 'text-signal-buy' : 'text-signal-sell'}`}>
                  {s.change >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  {s.changePercent > 0 ? '+' : ''}{s.changePercent.toFixed(2)}%
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
