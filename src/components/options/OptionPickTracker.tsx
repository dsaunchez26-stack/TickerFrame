import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { OptionRow } from '@/lib/optionsMockData';
import type { TrackedPick } from '@/lib/optionPicks';

interface Props {
  picks: TrackedPick[];
  liveRows: OptionRow[];
  pickQuotes: Record<string, number>;
}

export const OptionPickTracker = ({ picks, pickQuotes }: Props) => {
  const summary = useMemo(() => {
    if (!picks.length) return null;
    let wins = 0;
    let totalPct = 0;
    for (const p of picks) {
      const current = pickQuotes[p.id] ?? p.row.price;
      const pct = p.entryPrice ? ((current - p.entryPrice) / p.entryPrice) * 100 : 0;
      if (pct >= 0) wins += 1;
      totalPct += pct;
    }
    return { count: picks.length, wins, avgPct: totalPct / picks.length };
  }, [picks, pickQuotes]);

  if (!summary) return null;

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm font-semibold">Pick Tracker Summary</CardTitle></CardHeader>
      <CardContent className="grid grid-cols-3 gap-4 text-center">
        <div>
          <div className="text-xl font-bold">{summary.count}</div>
          <div className="text-[11px] text-muted-foreground">Tracked</div>
        </div>
        <div>
          <div className="text-xl font-bold text-signal-buy">{summary.wins}/{summary.count}</div>
          <div className="text-[11px] text-muted-foreground">Currently green</div>
        </div>
        <div>
          <div className={`text-xl font-bold ${summary.avgPct >= 0 ? 'text-signal-buy' : 'text-signal-sell'}`}>
            {summary.avgPct >= 0 ? '+' : ''}{summary.avgPct.toFixed(1)}%
          </div>
          <div className="text-[11px] text-muted-foreground">Avg move</div>
        </div>
      </CardContent>
    </Card>
  );
};
