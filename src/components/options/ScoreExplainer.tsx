import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const FACTORS = [
  { name: 'Liquidity', weight: '25 pts', desc: 'Based on contract volume — thinly traded contracts score lower.' },
  { name: 'Flow', weight: '30 pts', desc: 'Volume-to-open-interest ratio and total dollar flow through the contract.' },
  { name: 'Gamma / price', weight: '25 pts', desc: 'Gamma exposure per dollar of premium — higher leverage scores higher.' },
  { name: 'IV rank', weight: '10 pts', desc: 'Cheaper implied volatility (relative to its own range) scores higher.' },
  { name: 'Chart pattern', weight: '±5 pts', desc: "A small nudge based on the underlying's own detected chart pattern — a call paired with a bullish pattern (or a put with a bearish one) gets a bonus; a contract fighting the pattern gets a penalty. Click any ticker to see the chart this is based on." },
];

export const ScoreExplainer = () => (
  <Card>
    <CardHeader><CardTitle className="text-sm font-semibold">How the Score Is Calculated</CardTitle></CardHeader>
    <CardContent className="space-y-2">
      {FACTORS.map(f => (
        <div key={f.name} className="flex items-start justify-between gap-3 border-b border-border/50 pb-2 last:border-0 last:pb-0">
          <div>
            <span className="text-xs font-semibold">{f.name}</span>
            <p className="text-[11px] text-muted-foreground">{f.desc}</p>
          </div>
          <span className="whitespace-nowrap text-xs font-semibold text-primary">{f.weight}</span>
        </div>
      ))}
    </CardContent>
  </Card>
);
