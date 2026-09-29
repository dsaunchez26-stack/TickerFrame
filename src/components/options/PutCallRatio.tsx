import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Scale } from 'lucide-react';

export interface PutCallRatioData {
  ratio: number;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  totalCallVolume: number;
  totalPutVolume: number;
}

// The classic put/call ratio: total put contract volume divided by total
// call contract volume, across every contract currently in the rolling
// scan (not just the top-80-by-score list shown elsewhere on this page) --
// real traded volume, the same convention CBOE's own published ratio uses.
// More calls trading than puts (ratio < 1) reads bullish -- the market's
// paying up for upside more than downside protection right now, and vice
// versa for more puts than calls.
export const PutCallRatio = ({ data }: { data: PutCallRatioData | null }) => {
  if (!data) return null;
  const { ratio, sentiment, totalCallVolume, totalPutVolume } = data;
  const Icon = sentiment === 'bullish' ? TrendingUp : sentiment === 'bearish' ? TrendingDown : Scale;
  const color = sentiment === 'bullish' ? 'text-signal-buy' : sentiment === 'bearish' ? 'text-signal-sell' : 'text-muted-foreground';
  const callPct = totalCallVolume + totalPutVolume > 0 ? (totalCallVolume / (totalCallVolume + totalPutVolume)) * 100 : 50;

  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 p-4">
        <div className="flex items-center gap-2">
          <Icon className={`h-5 w-5 ${color}`} />
          <div>
            <div className="text-sm font-semibold">
              Put/Call Ratio: <span className={color}>{ratio.toFixed(2)}</span>
              <span className={`ml-1.5 capitalize ${color}`}>({sentiment})</span>
            </div>
            <div className="text-[11px] text-muted-foreground">
              {totalCallVolume.toLocaleString()} call vol · {totalPutVolume.toLocaleString()} put vol, today's scanned contracts
            </div>
          </div>
        </div>
        <div className="h-2 w-40 overflow-hidden rounded-full bg-signal-sell/30">
          <div className="h-full bg-signal-buy" style={{ width: `${callPct}%` }} />
        </div>
      </CardContent>
    </Card>
  );
};
