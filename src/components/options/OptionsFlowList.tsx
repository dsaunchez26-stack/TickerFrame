import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { FlowPrint } from '@/lib/optionsMockData';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

export const OptionsFlowList = ({ prints }: { prints: FlowPrint[] }) => (
  <Card>
    <CardHeader><CardTitle className="text-sm font-semibold">Live Options Flow</CardTitle></CardHeader>
    <CardContent className="max-h-96 space-y-1.5 overflow-y-auto">
      {prints.length === 0 && <p className="text-xs text-muted-foreground">No unusual prints detected yet this session.</p>}
      {prints.map(p => (
        <div key={p.id} className="flex items-center justify-between rounded border border-border/60 px-2 py-1.5 text-xs">
          <div className="flex items-center gap-2">
            {p.bullish ? <ArrowUpRight className="h-3.5 w-3.5 text-signal-buy" /> : <ArrowDownRight className="h-3.5 w-3.5 text-signal-sell" />}
            <span className="font-semibold">{p.contract}</span>
          </div>
          <div className="text-right">
            <div>{p.contracts.toLocaleString()} ctr</div>
            <div className="text-[10px] text-muted-foreground">${(p.dollarValue / 1000).toFixed(0)}k · {p.time}</div>
          </div>
        </div>
      ))}
    </CardContent>
  </Card>
);
