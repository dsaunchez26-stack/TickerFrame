import type { Stock } from '@/lib/mockData';
import { SignalBadge } from '@/components/SignalBadge';
import { formatPoints, signalFactors } from '@/lib/signalBreakdown';

const pointColor = (p: number | null) => (p === null ? 'text-muted-foreground' : p > 0 ? 'text-signal-buy' : p < 0 ? 'text-signal-sell' : 'text-muted-foreground');

// The algorithm's call next to the evidence behind it: the user sees the same
// RSI, trend and momentum readings the score is built from and can overrule it.
export const SignalBreakdown = ({ stock }: { stock: Stock }) => {
  const factors = signalFactors(stock);
  const rsiPct = Math.min(Math.max(stock.rsi, 0), 100);

  return (
    <div className="rounded-lg border border-border bg-secondary/20 p-3 text-xs">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-semibold">Why this reading</span>
        <SignalBadge signal={stock.signal} score={stock.signalScore} />
      </div>

      <div className="mb-3">
        <div className="mb-1 flex justify-between text-[10px] text-muted-foreground">
          <span>RSI {stock.rsi.toFixed(1)}</span>
          <span>oversold &lt; 30 · overbought &gt; 70</span>
        </div>
        <div className="relative h-2 overflow-hidden rounded-full bg-muted">
          <div className="absolute inset-y-0 left-0 w-[30%] bg-signal-buy/30" />
          <div className="absolute inset-y-0 right-0 w-[30%] bg-signal-sell/30" />
          <div className="absolute top-0 h-2 w-1 -translate-x-1/2 rounded bg-foreground" style={{ left: `${rsiPct}%` }} />
        </div>
      </div>

      <div className="space-y-1.5">
        {factors.map(f => (
          <div key={f.key} className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="font-medium">{f.label}</span>
              <span className="ml-1.5 text-muted-foreground">{f.detail}</span>
            </div>
            <span className={`shrink-0 font-semibold tabular-nums ${pointColor(f.points)}`}>{formatPoints(f.points)}</span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground">
        Points add up to the score ({stock.signal === 'buy' ? '5 or more reads Bullish' : stock.signal === 'sell' ? '-5 or fewer reads Bearish' : 'between -5 and 5 reads Neutral'}). It summarizes these indicators - it is not a prediction or a recommendation. Weigh them yourself.
      </p>
    </div>
  );
};
