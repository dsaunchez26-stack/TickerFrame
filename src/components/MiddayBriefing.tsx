import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Sun, RefreshCw, TrendingUp, Newspaper, UserCheck, Landmark, Loader2, ArrowDownRight, ArrowUpRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStockDetail } from '@/context/StockDetailContext';

interface Briefing {
  briefing_date: string;
  portfolio_summary: any;
  new_top_picks: any[];
  breaking_news: any[];
  insider_activity: any[];
  government_activity: any[];
  generated_at: string;
  reassessment?: {
    counts?: { downgrades: number; upgrades: number; confirmed: number; new_opportunities: number; am_snapshot_size: number };
    downgrades?: any[];
    upgrades?: any[];
    new_opportunities?: any[];
    confirmed_buys?: any[];
    top_pm_buys?: any[];
    data_caveat?: string | null;
  };
}

export const MiddayBriefing = () => {
  const qc = useQueryClient();
  const { open } = useStockDetail();

  const { data: briefing, isLoading } = useQuery<Briefing | null>({
    queryKey: ['midday-briefing'],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await supabase.from('midday_briefings').select('*').eq('briefing_date', today).maybeSingle();
      return (data ?? null) as Briefing | null;
    },
    refetchInterval: 5 * 60_000,
  });

  const regenerate = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke('generate-midday-briefing');
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['midday-briefing'] }),
  });

  const summary = briefing?.portfolio_summary ?? {};
  const buckets: Array<['day_trade' | 'long_term' | 'watchlist', string]> = [
    ['day_trade', 'Day Trade'],
    ['long_term', 'Long-Term'],
    ['watchlist', 'Watchlist'],
  ];

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Sun className="h-4 w-4 text-primary" />
          <h3 className="font-heading text-sm font-semibold">Midday Briefing</h3>
          {briefing && <span className="text-[10px] text-muted-foreground">{new Date(briefing.generated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
        </div>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => regenerate.mutate()} disabled={regenerate.isPending}>
          {regenerate.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          <span className="ml-1">Refresh</span>
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : !briefing ? (
        <div className="px-4 py-6 text-center text-xs text-muted-foreground">
          No briefing yet today. Generated automatically at 12 PM ET — or click Refresh.
        </div>
      ) : (
      <>
        {briefing.reassessment && (
          <div className="border-b border-border bg-secondary/20 px-4 py-3">
            <h4 className="mb-2 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
              <Sparkles className="h-3 w-3" />Midday Reassessment
              {briefing.reassessment.counts && (
                <span className="ml-auto text-[10px] font-normal text-muted-foreground">
                  ↓{briefing.reassessment.counts.downgrades} ↑{briefing.reassessment.counts.upgrades} ✦{briefing.reassessment.counts.new_opportunities}
                </span>
              )}
            </h4>
            {briefing.reassessment.data_caveat && (
              <p className="mb-2 text-[10px] text-muted-foreground italic">{briefing.reassessment.data_caveat}</p>
            )}
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase text-signal-sell">
                  <ArrowDownRight className="h-3 w-3" />Sell / Exit
                </div>
                {(briefing.reassessment.downgrades ?? []).length === 0 ? (
                  <p className="text-[11px] text-muted-foreground">None</p>
                ) : (
                  <div className="space-y-1">
                    {briefing.reassessment.downgrades!.map((d: any) => (
                      <button key={d.symbol} onClick={() => open(d.symbol)} className="flex w-full items-center justify-between rounded px-1 py-0.5 text-[11px] hover:bg-secondary/50">
                        <span className="font-bold">{d.symbol}</span>
                        <span className="text-muted-foreground truncate max-w-[110px]">{d.reason}</span>
                        <span className="text-signal-sell uppercase font-semibold">{d.action}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase text-signal-buy">
                  <ArrowUpRight className="h-3 w-3" />New Buys (Upgraded)
                </div>
                {(briefing.reassessment.upgrades ?? []).length === 0 ? (
                  <p className="text-[11px] text-muted-foreground">None</p>
                ) : (
                  <div className="space-y-1">
                    {briefing.reassessment.upgrades!.map((u: any) => (
                      <button key={u.symbol} onClick={() => open(u.symbol)} className="flex w-full items-center justify-between rounded px-1 py-0.5 text-[11px] hover:bg-secondary/50">
                        <span className="font-bold">{u.symbol}</span>
                        <span className="text-signal-buy">+{Number(u.changePercent).toFixed(2)}%</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase text-primary">
                  <Sparkles className="h-3 w-3" />Fresh Opportunities
                </div>
                {(briefing.reassessment.new_opportunities ?? []).length === 0 ? (
                  <p className="text-[11px] text-muted-foreground">None</p>
                ) : (
                  <div className="space-y-1">
                    {briefing.reassessment.new_opportunities!.map((n: any) => (
                      <button key={n.symbol} onClick={() => open(n.symbol)} className="flex w-full items-center justify-between rounded px-1 py-0.5 text-[11px] hover:bg-secondary/50">
                        <span className="font-bold">{n.symbol}</span>
                        <span className="text-signal-buy">+{Number(n.changePercent).toFixed(2)}%</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-0 divide-y divide-border md:grid-cols-2 md:divide-x md:divide-y-0">
          <div className="p-4">
            <h4 className="mb-2 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"><TrendingUp className="h-3 w-3" />Portfolio Recap</h4>
            <div className="space-y-1.5">
              {buckets.map(([key, label]) => {
                const b = summary[key] ?? { count: 0, pnl: 0, invested: 0 };
                const pct = b.invested > 0 ? (b.pnl / b.invested) * 100 : 0;
                return (
                  <div key={key} className="flex items-center justify-between text-xs">
                    <span className="text-foreground">{label} <span className="text-muted-foreground">({b.count})</span></span>
                    <span className={b.pnl >= 0 ? 'text-signal-buy font-semibold' : 'text-signal-sell font-semibold'}>
                      {b.pnl >= 0 ? '+' : ''}${(b.pnl ?? 0).toFixed(2)} ({pct.toFixed(1)}%)
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-4">
            <h4 className="mb-2 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"><TrendingUp className="h-3 w-3" />New Top Picks</h4>
            {briefing.new_top_picks.length === 0 ? <p className="text-xs text-muted-foreground">None this morning</p> : (
              <div className="space-y-1">
                {briefing.new_top_picks.slice(0, 5).map((p: any) => (
                  <button key={p.symbol} onClick={() => open(p.symbol)} className="flex w-full items-center justify-between rounded px-1 py-0.5 text-xs hover:bg-secondary/50">
                    <span className="font-bold">{p.symbol}</span>
                    <span className="text-signal-buy">+{Number(p.changePercent).toFixed(2)}%</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="p-4">
            <h4 className="mb-2 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"><Newspaper className="h-3 w-3" />Breaking News</h4>
            {briefing.breaking_news.length === 0 ? <p className="text-xs text-muted-foreground">Quiet morning</p> : (
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {briefing.breaking_news.slice(0, 6).map((n: any, i: number) => (
                  <a key={i} href={n.url ?? '#'} target="_blank" rel="noreferrer" className="block text-xs hover:underline">
                    <span className="font-bold text-foreground">{n.symbol}</span> — <span className="text-muted-foreground">{n.headline}</span>
                  </a>
                ))}
              </div>
            )}
          </div>

          <div className="p-4">
            <h4 className="mb-2 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"><UserCheck className="h-3 w-3" />Insider / Gov Activity</h4>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {briefing.insider_activity.slice(0, 3).map((i: any, idx: number) => (
                <button key={`ins-${idx}`} onClick={() => open(i.symbol)} className="flex w-full items-center justify-between text-xs hover:bg-secondary/50 px-1 rounded">
                  <span><span className="font-bold">{i.symbol}</span> <span className="text-muted-foreground">{i.insider_role}</span></span>
                  <span className={i.transaction_type?.toLowerCase().includes('p') ? 'text-signal-buy' : 'text-signal-sell'}>{i.transaction_type}</span>
                </button>
              ))}
              {briefing.government_activity.slice(0, 3).map((g: any, idx: number) => (
                <button key={`gov-${idx}`} onClick={() => open(g.symbol)} className="flex w-full items-center justify-between text-xs hover:bg-secondary/50 px-1 rounded">
                  <span className="flex items-center gap-1"><Landmark className="h-3 w-3 text-primary" /><span className="font-bold">{g.symbol}</span> <span className="text-muted-foreground truncate max-w-[100px]">{g.politician_name}</span></span>
                  {g.suspicious_flag && <span className="text-signal-sell text-[10px] font-bold">⚠ FLAG</span>}
                </button>
              ))}
              {briefing.insider_activity.length === 0 && briefing.government_activity.length === 0 && (
                <p className="text-xs text-muted-foreground">No new filings</p>
              )}
            </div>
          </div>
        </div>
      </>
      )}
    </div>
  );
};
