import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { OptionRow } from '@/lib/optionsMockData';
import { PatternBadge } from '@/components/PatternBadge';
import { OptionRiskDialogButton } from '@/components/tools/OptionRiskDialogButton';
import { EarningsBadge } from '@/components/EarningsBadge';
import { useEarningsCalendar } from '@/hooks/useEarningsCalendar';

export const BestTradeCards = ({ rows }: { rows: OptionRow[] }) => {
  const { earningsBySymbol } = useEarningsCalendar();
  const top = useMemo(() => [...rows].sort((a, b) => b.score - a.score).slice(0, 3), [rows]);

  if (!top.length) return null;

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm font-semibold">Top-Scored Setups</CardTitle></CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-3">
        {top.map(r => (
          <div key={r.id} className="rounded-lg border border-border p-3">
            <div className="flex items-center justify-between">
              <span className="font-heading text-sm font-semibold">{r.ticker} {r.cp}{r.strike}</span>
              <span className="text-xs font-bold text-primary">{r.score}</span>
            </div>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Exp {r.expiration} · Δ{r.delta.toFixed(2)}</p>
            <div className="mt-1"><EarningsBadge earnings={earningsBySymbol.get(r.ticker)} referenceDate={r.expiration} size="xs" /></div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs font-semibold">${r.price.toFixed(2)}</span>
              <div className="flex items-center gap-1">
                {r.pattern && <PatternBadge pattern={r.pattern} confidence={r.patternConfidence} size="xs" />}
                <OptionRiskDialogButton
                  ticker={r.ticker}
                  cp={r.cp}
                  strike={r.strike}
                  spot={r.stockPrice}
                  premium={r.ask > 0 ? r.ask : r.price}
                  expiration={r.expiration}
                />
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
