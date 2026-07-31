import { Activity } from 'lucide-react';

export interface MarketRegime {
  label: string;
  trend: 'risk-on' | 'risk-off' | 'neutral';
  vix?: number;
  description?: string;
}

export const MarketRegimeBar = ({ regime }: { regime: MarketRegime | null }) => {
  if (!regime) return null;
  const color = regime.trend === 'risk-on' ? 'text-signal-buy border-signal-buy/30 bg-signal-buy/10'
    : regime.trend === 'risk-off' ? 'text-signal-sell border-signal-sell/30 bg-signal-sell/10'
    : 'text-muted-foreground border-border bg-muted/30';

  return (
    <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${color}`}>
      <Activity className="h-3.5 w-3.5" />
      <span className="font-semibold">{regime.label}</span>
      {regime.vix !== undefined && <span>· VIX {regime.vix.toFixed(1)}</span>}
      {regime.description && <span className="text-muted-foreground">· {regime.description}</span>}
    </div>
  );
};
