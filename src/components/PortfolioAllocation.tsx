import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useHoldingClasses } from '@/hooks/useHoldingClasses';
import { UNCLASSIFIED } from '@/lib/classify';

interface Holding { symbol: string; quantity: number; currentPrice: number }

// Order and colors for the asset classes. Funds are placed by what they hold (a semiconductor
// ETF counts as technology stocks, a bond fund as bonds); stocks and stock funds share one
// "Equity" class, broken down by sector below it.
const CLASS_ORDER = ['Equity', 'Index', 'Bonds', 'Gold & Silver', 'Crypto', 'Real Estate', 'Commodities'];
const CLASS_LABEL: Record<string, string> = { Equity: 'Stocks & stock funds', Index: 'Broad index funds' };
const COLORS: Record<string, string> = {
  Equity: '#3b82f6', Index: '#6366f1', Bonds: '#10b981', 'Gold & Silver': '#f59e0b', Crypto: '#f97316', 'Real Estate': '#ec4899', Commodities: '#a3a3a3',
};

const Bar = ({ parts }: { parts: Array<{ key: string; pct: number; color: string }> }) => (
  <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
    {parts.map(p => <div key={p.key} style={{ width: `${p.pct}%`, backgroundColor: p.color }} />)}
  </div>
);

// How a portfolio is spread across asset classes (stocks, bonds, gold,
// crypto, real estate) and, within the stock part, across sectors. Plain
// facts about the mix and where it's concentrated -- not advice on what to hold.
export const PortfolioAllocation = ({ holdings }: { holdings: Holding[] }) => {
  const symbols = useMemo(() => holdings.map(h => h.symbol), [holdings]);
  const { classes: holdingClasses } = useHoldingClasses(symbols);

  const analysis = useMemo(() => {
    const total = holdings.reduce((s, h) => s + h.currentPrice * h.quantity, 0);
    if (total <= 0) return null;

    const byClass = new Map<string, number>();
    const bySector = new Map<string, number>();
    let equityValue = 0;
    for (const h of holdings) {
      const value = h.currentPrice * h.quantity;
      const hc = holdingClasses.get(h.symbol.toUpperCase()) ?? { assetClass: 'Equity', sector: UNCLASSIFIED };
      byClass.set(hc.assetClass, (byClass.get(hc.assetClass) ?? 0) + value);
      if (hc.assetClass === 'Equity') {
        equityValue += value;
        bySector.set(hc.sector, (bySector.get(hc.sector) ?? 0) + value);
      }
    }
    const classes = [...byClass.entries()]
      .sort((a, b) => (CLASS_ORDER.indexOf(a[0]) + 1 || 99) - (CLASS_ORDER.indexOf(b[0]) + 1 || 99))
      .map(([key, value]) => ({ key, value, pct: (value / total) * 100, color: COLORS[key] ?? '#94a3b8' }));
    // "Not classified" always sorts last so a real sector is never hidden behind it.
    const sectors = [...bySector.entries()]
      .sort((a, b) => (a[0] === UNCLASSIFIED ? 1 : 0) - (b[0] === UNCLASSIFIED ? 1 : 0) || b[1] - a[1])
      .map(([key, value]) => ({ key, value, pct: equityValue > 0 ? (value / equityValue) * 100 : 0 }));

    const notes: string[] = [];
    const stocksPct = (byClass.get('Equity') ?? 0) / total * 100;
    if (classes.length === 1) notes.push(`All of this portfolio is in ${(CLASS_LABEL[classes[0].key] ?? classes[0].key).toLowerCase()} - it moves with that one asset class.`);
    else if (stocksPct >= 85) notes.push(`${stocksPct.toFixed(0)}% is stocks and stock funds, so stock-market swings drive nearly all of it.`);
    // Only worth flagging when stocks are a meaningful slice of the whole, and only for a real sector.
    const topSector = sectors.find(s => s.key !== UNCLASSIFIED);
    if (topSector && topSector.pct >= 50 && stocksPct >= 25) notes.push(`${topSector.pct.toFixed(0)}% of the stock portion is ${topSector.key}, so that one sector's moves dominate the stock part.`);
    return { classes, sectors, notes };
  }, [holdings, holdingClasses]);

  if (!analysis) return null;
  const { classes, sectors, notes } = analysis;

  return (
    <Card className="mb-3">
      <CardHeader className="pb-2"><CardTitle className="text-xs font-semibold">Asset allocation</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-xs">
        <div className="space-y-1.5">
          <Bar parts={classes} />
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {classes.map(c => (
              <span key={c.key} className="flex items-center gap-1 text-muted-foreground">
                <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />
                {CLASS_LABEL[c.key] ?? c.key} <span className="font-semibold text-foreground">{c.pct.toFixed(0)}%</span>
              </span>
            ))}
          </div>
        </div>
        {sectors.length > 0 && (
          <div>
            <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Sectors (stocks and stock funds)</p>
            <div className="space-y-1">
              {sectors.slice(0, 8).map(s => (
                <div key={s.key} className="flex items-center gap-2">
                  <span className="w-32 shrink-0 truncate text-muted-foreground">{s.key}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary/70" style={{ width: `${s.pct}%` }} /></div>
                  <span className="w-8 text-right font-semibold">{s.pct.toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {notes.map(n => <p key={n} className="text-[11px] text-muted-foreground">{n}</p>)}
      </CardContent>
    </Card>
  );
};
