import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useStockData } from '@/hooks/useStockData';
import { broadSector } from '@/lib/sectorMapping';

interface Holding { symbol: string; quantity: number; currentPrice: number }

// Order and colors for the asset classes the site tracks. Anything not found
// in the tracked universe (e.g. a stock this site doesn't scan) counts as an
// individual stock, since that's what it almost certainly is.
const CLASS_ORDER = ['Equity', 'Index', 'Bonds', 'Gold & Silver', 'Crypto', 'Real Estate'];
const CLASS_LABEL: Record<string, string> = { Equity: 'Individual stocks', Index: 'Index funds' };
const COLORS: Record<string, string> = {
  Equity: '#3b82f6', Index: '#6366f1', Bonds: '#10b981', 'Gold & Silver': '#f59e0b', Crypto: '#f97316', 'Real Estate': '#ec4899',
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
  const { data: stockData } = useStockData('all', 'all');
  const symbols = useMemo(() => holdings.map(h => h.symbol).sort(), [holdings]);

  const { data: sectorRows } = useQuery({
    queryKey: ['allocation-sectors', symbols.join(',')],
    enabled: symbols.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from('stock_fundamentals').select('symbol, sector').in('symbol', symbols);
      return new Map((data ?? []).map(r => [r.symbol, r.sector as string | null]));
    },
    staleTime: 30 * 60_000,
  });

  const analysis = useMemo(() => {
    const classBySymbol = new Map((stockData?.stocks ?? []).map(s => [s.symbol, s.assetClass ?? 'Equity']));
    const total = holdings.reduce((s, h) => s + h.currentPrice * h.quantity, 0);
    if (total <= 0) return null;

    const byClass = new Map<string, number>();
    const bySector = new Map<string, number>();
    let equityValue = 0;
    for (const h of holdings) {
      const value = h.currentPrice * h.quantity;
      const cls = classBySymbol.get(h.symbol) ?? 'Equity';
      byClass.set(cls, (byClass.get(cls) ?? 0) + value);
      if (cls === 'Equity') {
        equityValue += value;
        const sector = broadSector(h.symbol, sectorRows?.get(h.symbol) ?? null);
        bySector.set(sector, (bySector.get(sector) ?? 0) + value);
      }
    }
    const classes = [...byClass.entries()]
      .sort((a, b) => (CLASS_ORDER.indexOf(a[0]) + 1 || 99) - (CLASS_ORDER.indexOf(b[0]) + 1 || 99))
      .map(([key, value]) => ({ key, value, pct: (value / total) * 100, color: COLORS[key] ?? '#94a3b8' }));
    const sectors = [...bySector.entries()].sort((a, b) => b[1] - a[1]).map(([key, value]) => ({ key, value, pct: equityValue > 0 ? (value / equityValue) * 100 : 0 }));

    const notes: string[] = [];
    const stocksPct = (byClass.get('Equity') ?? 0) / total * 100;
    if (classes.length === 1) notes.push(`All of this portfolio is in ${(CLASS_LABEL[classes[0].key] ?? classes[0].key).toLowerCase()} - it moves with that one asset class.`);
    else if (stocksPct >= 85) notes.push(`${stocksPct.toFixed(0)}% is individual stocks, so stock-market swings drive nearly all of it.`);
    // Only worth flagging when stocks are a meaningful slice of the whole.
    if (sectors.length && sectors[0].pct >= 50 && stocksPct >= 25) notes.push(`${sectors[0].pct.toFixed(0)}% of the stock portion is ${sectors[0].key}, so that one sector's moves dominate the stock part.`);
    return { classes, sectors, notes };
  }, [holdings, stockData, sectorRows]);

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
            <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Stock sectors</p>
            <div className="space-y-1">
              {sectors.slice(0, 5).map(s => (
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
