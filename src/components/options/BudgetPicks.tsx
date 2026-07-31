import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { OptionRow } from '@/lib/optionsMockData';
import { PatternBadge } from '@/components/PatternBadge';
import { useStockDetail } from '@/context/StockDetailContext';

const MAX_PER_TICKER = 2;
const PER_BAND = 3;
// Grouped by price band (rather than a flat "N cheapest") so a mid-range spot
// like "around $1" doesn't get crowded out of the list entirely just because
// several even-cheaper contracts happened to exist that day -- a flat top-N
// sort would otherwise fill every slot from the very bottom of the range.
const BANDS: Array<{ label: string; max: number }> = [
  { label: 'Under $1', max: 1 },
  { label: '$1 - $2', max: 2 },
  { label: '$2 - $5', max: 5 },
];

// Cheapest-to-enter from the same (already probability-filtered) pool as
// Top-Scored Setups, banded by price instead of one flat cheapest-N sort, so
// a small account can see what's actually affordable across the whole
// sub-$5 range without wading back into unfiltered far-OTM lottery tickets,
// which are cheap for the opposite reason (low odds, not just low price).
export const BudgetPicks = ({ rows }: { rows: OptionRow[] }) => {
  const { open } = useStockDetail();

  const bands = useMemo(() => {
    const withLiquidity = rows.filter(r => r.price > 0 && (r.volume > 0 || r.oi > 0));
    const perTicker = new Map<string, number>();
    let lowerBound = 0;
    const result = BANDS.map(band => {
      const pool = withLiquidity
        .filter(r => r.price > lowerBound && r.price <= band.max)
        .sort((a, b) => b.score - a.score);
      const picks: OptionRow[] = [];
      for (const r of pool) {
        const used = perTicker.get(r.ticker) ?? 0;
        if (used >= MAX_PER_TICKER) continue;
        picks.push(r);
        perTicker.set(r.ticker, used + 1);
        if (picks.length >= PER_BAND) break;
      }
      lowerBound = band.max;
      return { label: band.label, picks };
    });
    return result.filter(b => b.picks.length > 0);
  }, [rows]);

  if (!bands.length) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">Cheapest Contracts</CardTitle>
        <p className="text-[10px] text-muted-foreground">
          Same filtered pool as Top-Scored Setups (same probability floor from the filters above), grouped by price band
          so a range like "around $1" isn't crowded out by even-cheaper contracts. Price shown is per share -- a
          contract covers 100 shares, so a $1.00 premium costs $100 to open, not $1.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {bands.map(band => (
          <div key={band.label}>
            <div className="mb-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">{band.label}</div>
            <div className="grid gap-3 sm:grid-cols-3">
              {band.picks.map(r => (
                <div key={r.id} className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between">
                    <button onClick={() => open(r.ticker)} className="font-heading text-sm font-semibold hover:text-primary hover:underline">{r.ticker} {r.cp}{r.strike}</button>
                    <span className="text-xs font-bold text-primary">{r.score}</span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">Exp {r.expiration} · Δ{r.delta.toFixed(2)}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs font-semibold">
                      ${r.price.toFixed(2)} <span className="font-normal text-muted-foreground">(${(r.price * 100).toFixed(0)}/contract)</span>
                    </span>
                    {r.pattern && <PatternBadge pattern={r.pattern} confidence={r.patternConfidence} size="xs" />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
