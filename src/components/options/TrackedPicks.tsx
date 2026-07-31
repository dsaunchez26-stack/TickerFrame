import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, X } from 'lucide-react';
import type { OptionRow } from '@/lib/optionsMockData';
import type { TrackedPick } from '@/lib/optionPicks';

interface Props {
  picks: TrackedPick[];
  liveRows: OptionRow[];
  pickQuotes: Record<string, number>;
  pickPrevCloses: Record<string, number>;
  onChange: (next: TrackedPick[]) => void;
  onRemove: (id: string) => void;
  onRefresh: () => void;
}

export const TrackedPicks = ({ picks, pickQuotes, onChange, onRemove, onRefresh }: Props) => {
  if (!picks.length) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-semibold">Tracked Picks ({picks.length})</CardTitle>
        <Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" onClick={onRefresh}>
          <RefreshCw className="mr-1 h-3 w-3" /> Refresh quotes
        </Button>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {picks.map(p => {
          const symbol = p.id.replace(/-\d+$/, '');
          const current = pickQuotes[p.id] ?? p.row.price;
          const pl = current - p.entryPrice;
          const plPct = p.entryPrice ? (pl / p.entryPrice) * 100 : 0;
          return (
            <div key={p.id} className="flex items-center justify-between rounded border border-border/60 px-3 py-2 text-xs">
              <div>
                <span className="font-semibold">{p.row.ticker} {p.row.cp}{p.row.strike}</span>
                <span className="ml-2 text-muted-foreground">entry ${p.entryPrice.toFixed(2)}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className={pl >= 0 ? 'text-signal-buy' : 'text-signal-sell'}>{pl >= 0 ? '+' : ''}{plPct.toFixed(1)}%</span>
                <Button
                  size="sm" variant="ghost" className="h-6 w-6 p-0"
                  onClick={() => { onChange(picks.filter(x => x.id !== p.id)); onRemove(p.id); }}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
