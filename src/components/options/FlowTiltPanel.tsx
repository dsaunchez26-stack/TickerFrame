import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export interface FlowAgg {
  ticker: string;
  callDollarFlow: number;
  putDollarFlow: number;
}

export const FlowTiltPanel = ({ flowAggs }: { flowAggs: FlowAgg[] }) => {
  if (!flowAggs.length) return null;
  const top = [...flowAggs].sort((a, b) => (b.callDollarFlow + b.putDollarFlow) - (a.callDollarFlow + a.putDollarFlow)).slice(0, 8);

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm font-semibold">Flow Tilt by Ticker</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {top.map(a => {
          const total = a.callDollarFlow + a.putDollarFlow || 1;
          const callPct = Math.round((a.callDollarFlow / total) * 100);
          return (
            <div key={a.ticker} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold">{a.ticker}</span>
                <span className="text-muted-foreground">{callPct}% calls</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-signal-sell/30">
                <div className="h-full bg-signal-buy" style={{ width: `${callPct}%` }} />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
