import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownRight, ArrowUpRight, Loader2 } from 'lucide-react';
import { useStockData } from '@/hooks/useStockData';
import { useStockDetail } from '@/context/StockDetailContext';
import { SignalBadge } from '@/components/SignalBadge';

const CLASS_ORDER = ['Index', 'Bonds', 'Gold & Silver', 'Crypto', 'Real Estate'];

// Exchange-traded funds standing in for the asset classes beyond individual
// stocks: bonds, gold/silver, bitcoin/ethereum, real estate, and the broad
// index funds. Same live prices and technical signal as the stocks.
export const AssetClassPanel = () => {
  const { data, isLoading } = useStockData('core', 'funds');
  const { open } = useStockDetail();

  const groups = useMemo(() => {
    const byClass = new Map<string, NonNullable<typeof data>['stocks']>();
    for (const s of data?.stocks ?? []) {
      const key = s.assetClass ?? 'Other';
      byClass.set(key, [...(byClass.get(key) ?? []), s]);
    }
    return [...byClass.entries()].sort(
      (a, b) => (CLASS_ORDER.indexOf(a[0]) + 1 || 99) - (CLASS_ORDER.indexOf(b[0]) + 1 || 99),
    );
  }, [data]);

  if (isLoading) {
    return <div className="flex justify-center border-y border-border py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }
  if (!groups.length) return null;

  return (
    <div>
      <div className="pb-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Asset Classes</h3>
          <Link to="/stocks/etfs" className="text-[10px] text-muted-foreground underline hover:text-foreground">View all ETFs</Link>
        </div>
        <p className="text-[11px] text-muted-foreground">Bonds, gold, crypto, real estate and index funds - tracked through exchange-traded funds.</p>
      </div>
      <div className="grid gap-x-6 border-t border-border md:grid-cols-2 xl:grid-cols-3">
        {groups.map(([assetClass, rows]) => (
          <div key={assetClass} className="border-b border-border/60 py-3">
            <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{assetClass}</p>
            <div className="space-y-0.5">
              {rows.map((s) => (
                <button key={s.symbol} onClick={() => open(s.symbol)} className="flex w-full items-center justify-between gap-2 rounded-sm px-1 py-1 text-left transition-colors hover:bg-accent/60">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-foreground">{s.symbol}</span>
                      <SignalBadge signal={s.signal} score={s.signalScore} />
                    </div>
                    <p className="truncate text-[10px] text-muted-foreground">{s.name}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs font-medium tabular-nums text-foreground">${s.price.toFixed(2)}</p>
                    <p className={`flex items-center justify-end gap-0.5 text-[11px] tabular-nums ${s.change >= 0 ? 'text-signal-buy' : 'text-signal-sell'}`}>
                      {s.change >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                      {s.changePercent > 0 ? '+' : ''}{s.changePercent.toFixed(2)}%
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
