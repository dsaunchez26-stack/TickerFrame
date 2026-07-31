import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Landmark, AlertTriangle, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStockDetail } from '@/context/StockDetailContext';
import { useState } from 'react';

interface GovTrade {
  id: string;
  politician_name: string;
  chamber: string | null;
  party: string | null;
  symbol: string;
  transaction_type: string;
  amount_min: number | null;
  amount_max: number | null;
  trade_date: string;
  disclosure_date: string | null;
  disclosure_lag_days: number | null;
  suspicious_flag: boolean;
  suspicion_reason: string | null;
  catalyst_type: string | null;
}

export const GovTradesPanel = () => {
  const qc = useQueryClient();
  const { open } = useStockDetail();
  const [filter, setFilter] = useState<'all' | 'flagged'>('flagged');

  const { data: trades = [], isLoading } = useQuery<GovTrade[]>({
    queryKey: ['gov-trades', filter],
    queryFn: async () => {
      let q = supabase.from('government_trades').select('*').order('trade_date', { ascending: false }).limit(30);
      if (filter === 'flagged') q = q.eq('suspicious_flag', true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as GovTrade[];
    },
    refetchInterval: 5 * 60_000,
  });

  const refresh = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke('track-government-trades');
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gov-trades'] }),
  });

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Landmark className="h-4 w-4 text-primary" />
          <h3 className="font-heading text-sm font-semibold">Government / Congress Trades</h3>
          <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold text-primary">{trades.length}</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setFilter('flagged')} className={`rounded px-2 py-0.5 text-[10px] font-medium ${filter === 'flagged' ? 'bg-signal-sell/15 text-signal-sell' : 'text-muted-foreground hover:bg-secondary'}`}>Flagged</button>
          <button onClick={() => setFilter('all')} className={`rounded px-2 py-0.5 text-[10px] font-medium ${filter === 'all' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-secondary'}`}>All</button>
          <Button variant="ghost" size="sm" className="h-6 px-1.5" onClick={() => refresh.mutate()} disabled={refresh.isPending}>
            {refresh.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
      ) : trades.length === 0 ? (
        <div className="px-4 py-6 text-center text-xs text-muted-foreground">
          {filter === 'flagged' ? 'No suspicious trades flagged. Click Refresh to pull latest STOCK Act disclosures.' : 'No trades yet — click Refresh.'}
        </div>
      ) : (
        <div className="max-h-80 overflow-y-auto divide-y divide-border">
          {trades.map(t => (
            <div key={t.id} className={`px-4 py-2.5 hover:bg-secondary/40 ${t.suspicious_flag ? 'border-l-2 border-signal-sell' : ''}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 cursor-pointer" onClick={() => open(t.symbol)}>
                  <div className="flex items-center gap-2">
                    <span className="font-heading text-sm font-bold">{t.symbol}</span>
                    <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${t.transaction_type === 'buy' ? 'bg-signal-buy/15 text-signal-buy' : t.transaction_type === 'sell' ? 'bg-signal-sell/15 text-signal-sell' : 'bg-signal-hold/15 text-signal-hold'}`}>{t.transaction_type}</span>
                    {t.suspicious_flag && <AlertTriangle className="h-3 w-3 text-signal-sell" />}
                    {t.catalyst_type && <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[9px] uppercase text-primary">{t.catalyst_type}</span>}
                  </div>
                  <div className="mt-1 text-xs text-foreground">
                    {t.politician_name} <span className="text-muted-foreground">({t.chamber}{t.party ? ` · ${t.party}` : ''})</span>
                  </div>
                  {t.suspicion_reason && <div className="mt-0.5 text-[10px] italic text-signal-sell">⚠ {t.suspicion_reason}</div>}
                </div>
                <div className="text-right text-[10px]">
                  <div className="font-semibold text-foreground">
                    ${(t.amount_min ?? 0).toLocaleString()}–${(t.amount_max ?? 0).toLocaleString()}
                  </div>
                  <div className="text-muted-foreground">{new Date(t.trade_date).toLocaleDateString()}</div>
                  {t.disclosure_lag_days !== null && (
                    <div className={t.disclosure_lag_days <= 2 ? 'text-signal-sell font-semibold' : 'text-muted-foreground'}>
                      Filed +{t.disclosure_lag_days}d
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
