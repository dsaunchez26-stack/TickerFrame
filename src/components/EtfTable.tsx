import { useMemo } from 'react';
import { ArrowDownRight, ArrowUpRight, Loader2 } from 'lucide-react';
import { useStockData } from '@/hooks/useStockData';
import { useStockDetail } from '@/context/StockDetailContext';
import { SignalBadge } from '@/components/SignalBadge';

const CLASS_ORDER = ['Index', 'Bonds', 'Gold & Silver', 'Crypto', 'Real Estate'];
const CLASS_BLURB: Record<string, string> = {
  Index: 'Broad stock-market funds: S&P 500, Nasdaq 100, Dow and Russell 2000.',
  Bonds: 'Treasuries and corporate bonds, from short-duration to high yield.',
  'Gold & Silver': 'Physical-metal-backed funds.',
  Crypto: 'Spot bitcoin and ethereum funds.',
  'Real Estate': 'Funds holding real estate investment trusts (REITs).',
};

export const EtfTable = () => {
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
    return <div className="flex justify-center rounded-lg border border-border bg-card py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }
  if (!groups.length) {
    return <div className="rounded-lg border border-border bg-card p-6 text-center text-xs text-muted-foreground">No fund data yet - it fills in after the next price refresh.</div>;
  }

  return (
    <div className="space-y-4">
      {groups.map(([assetClass, rows]) => (
        <div key={assetClass} className="rounded-lg border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <h3 className="font-heading text-sm font-semibold">{assetClass}</h3>
            {CLASS_BLURB[assetClass] && <p className="text-[10px] text-muted-foreground">{CLASS_BLURB[assetClass]}</p>}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-border text-left text-muted-foreground">
                <tr>
                  <th className="px-4 py-2">Fund</th>
                  <th className="py-2 pr-3 text-right">Price</th>
                  <th className="py-2 pr-3 text-right">Today</th>
                  <th className="py-2 pr-3 text-right">RSI</th>
                  <th className="py-2 pr-4">Signal</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.symbol} onClick={() => open(s.symbol)} className="cursor-pointer border-b border-border last:border-0 hover:bg-secondary/50">
                    <td className="px-4 py-2">
                      <span className="font-heading font-semibold">{s.symbol}</span>
                      <span className="ml-2 text-muted-foreground">{s.name}</span>
                    </td>
                    <td className="py-2 pr-3 text-right font-semibold">${s.price.toFixed(2)}</td>
                    <td className="py-2 pr-3 text-right">
                      <span className={`inline-flex items-center gap-0.5 font-medium ${s.change >= 0 ? 'text-signal-buy' : 'text-signal-sell'}`}>
                        {s.change >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                        {s.changePercent > 0 ? '+' : ''}{s.changePercent.toFixed(2)}%
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-right">{s.rsi.toFixed(0)}</td>
                    <td className="py-2 pr-4"><SignalBadge signal={s.signal} score={s.signalScore} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      <p className="text-[10px] text-muted-foreground">
        Funds are scored with the same technical signal as stocks. They have no earnings or balance sheet, so they don't appear in the fundamentals screens. Not investment advice.
      </p>
    </div>
  );
};
