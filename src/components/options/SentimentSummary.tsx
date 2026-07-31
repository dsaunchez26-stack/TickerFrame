import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import type { OptionRow } from '@/lib/optionsMockData';
import { TrendingUp, TrendingDown, Scale } from 'lucide-react';

export const SentimentSummary = ({ rows }: { rows: OptionRow[] }) => {
  const stats = useMemo(() => {
    const calls = rows.filter(r => r.cp === 'C').length;
    const puts = rows.filter(r => r.cp === 'P').length;
    const total = calls + puts;
    const callPct = total ? Math.round((calls / total) * 100) : 50;
    return { calls, puts, callPct };
  }, [rows]);

  const tilt = stats.callPct > 55 ? 'bullish' : stats.callPct < 45 ? 'bearish' : 'neutral';
  const Icon = tilt === 'bullish' ? TrendingUp : tilt === 'bearish' ? TrendingDown : Scale;
  const color = tilt === 'bullish' ? 'text-signal-buy' : tilt === 'bearish' ? 'text-signal-sell' : 'text-muted-foreground';

  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 p-4">
        <div className="flex items-center gap-2">
          <Icon className={`h-5 w-5 ${color}`} />
          <div>
            <div className="text-sm font-semibold capitalize">{tilt} tilt</div>
            <div className="text-[11px] text-muted-foreground">{stats.calls} calls · {stats.puts} puts scanned</div>
          </div>
        </div>
        <div className="h-2 w-40 overflow-hidden rounded-full bg-signal-sell/30">
          <div className="h-full bg-signal-buy" style={{ width: `${stats.callPct}%` }} />
        </div>
      </CardContent>
    </Card>
  );
};
