import { useMemo } from 'react';
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
    return <div className="flex justify-center rounded-lg border border-border bg-card py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }
  if (!groups.length) return null;

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h3 className="font-heading text-sm font-semibold text-foreground">Asset Classes</h3>
        <p className="text-[10px] text-muted-foreground">Bonds, gold, crypto, real estate and index funds - tracked through exchange-traded funds.</p>
      </div>
      <div className="grid gap-px bg-border md:grid-cols-2 xl:grid-cols-3">
        {groups.map(([assetClass, rows]) => (
          <div key={assetClass} className="bg-card p-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{assetClass}</p>
            <div className="space-y-2">
              {rows.map((s) => (
                <button key={s.symbol} onClick={() => open(s.symbol)} className="flex w-full items-center justify-between gap-2 rounded text-left transition-colors hover:bg-secondary/50">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-heading text-xs font-semibold text-foreground">{s.symbol}</span>
                      <SignalBadge signal={s.signal} score={s.signalScore} />
                    </div>
                    <p className="truncate text-[10px] text-muted-foreground">{s.name}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-heading text-xs font-semibold text-foreground">${s.price.toFixed(2)}</p>
                    <p className={`flex items-center justify-end gap-0.5 text-[10px] font-medium ${s.change >= 0 ? 'text-signal-buy' : 'text-signal-sell'}`}>
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
