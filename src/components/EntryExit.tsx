import { ArrowUpRight, Target, Shield, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const PENNY_PRICE_THRESHOLD = 5;
const confidenceToPct = (c: string) => (c === 'high' ? 80 : c === 'medium' ? 60 : 40);

export const EntryExit = () => {
  const { data: signals = [], isLoading } = useQuery({
    queryKey: ['entry-exit-signals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('signal_log')
        .select('id,ticker,kind,cp,entry_price,stop_price,target_price,confidence,score,fired_at,signal_outcomes(status)')
        .order('fired_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? [])
        .filter((s: any) => {
          const o = (s.signal_outcomes ?? [])[0];
          return !o || o.status === 'open';
        })
        .slice(0, 12);
    },
    refetchInterval: 5 * 60 * 1000,
    staleTime: 2 * 60 * 1000,
  });

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h3 className="font-heading text-sm font-semibold text-foreground">Entry & Exit Signals</h3>
      </div>
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : signals.length === 0 ? (
        <div className="px-4 py-6 text-center text-xs text-muted-foreground">No open signals right now</div>
      ) : (
        <div className="divide-y divide-border">
          {signals.map((s: any) => {
            const entry = Number(s.entry_price);
            const stop = Number(s.stop_price);
            const target = Number(s.target_price);
            const isPenny = s.kind === 'stock' && entry < PENNY_PRICE_THRESHOLD;
            const isOption = s.kind === 'option';
            const conf = confidenceToPct(s.confidence);
            const rr = Math.abs(entry - stop) > 0
              ? ((target - entry) / Math.abs(entry - stop)).toFixed(2)
              : '–';
            const firedAgo = (() => {
              const mins = Math.round((Date.now() - new Date(s.fired_at).getTime()) / 60000);
              if (mins < 60) return `${mins}m`;
              if (mins < 1440) return `${Math.round(mins / 60)}h`;
              return `${Math.round(mins / 1440)}d`;
            })();
            return (
            <div key={s.id} className="px-4 py-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-signal-buy/15 text-signal-buy">
                    <ArrowUpRight className="h-3 w-3" />
                    entry
                  </span>
                   <span className="font-heading text-xs font-bold text-foreground">{s.ticker}</span>
                   {isOption && <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[9px] font-semibold text-primary">{s.cp === 'C' ? 'CALL' : 'PUT'}</span>}
                   {isPenny && <span className="rounded bg-orange-400/15 px-1.5 py-0.5 text-[9px] font-semibold text-orange-400">PENNY</span>}
                 </div>
                 <span className="text-[10px] text-muted-foreground">{firedAgo} ago</span>
              </div>
               <div className="mb-2 grid grid-cols-4 gap-2 text-[10px]">
                 <div>
                   <span className="text-muted-foreground">Entry</span>
                   <p className="font-heading font-semibold text-foreground">${entry.toFixed(2)}</p>
                 </div>
                 <div className="flex items-start gap-1">
                   <Target className="mt-0.5 h-3 w-3 text-signal-buy" />
                   <div>
                     <span className="text-muted-foreground">Target</span>
                     <p className="font-heading font-semibold text-signal-buy">${target.toFixed(2)}</p>
                   </div>
                 </div>
                 <div className="flex items-start gap-1">
                   <Shield className="mt-0.5 h-3 w-3 text-signal-sell" />
                   <div>
                     <span className="text-muted-foreground">Stop</span>
                     <p className="font-heading font-semibold text-signal-sell">${stop.toFixed(2)}</p>
                   </div>
                 </div>
                 <div>
                   <span className="text-muted-foreground">R:R</span>
                   <p className="font-heading font-semibold text-foreground">{rr}</p>
                 </div>
               </div>
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-muted-foreground">
                  {s.confidence} confidence · score {Number(s.score).toFixed(2)}
                </p>
                <div className="flex items-center gap-1">
                  <div className="h-1 w-12 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${conf}%` }} />
                  </div>
                  <span className="text-[10px] font-medium text-primary">{conf}%</span>
                </div>
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
