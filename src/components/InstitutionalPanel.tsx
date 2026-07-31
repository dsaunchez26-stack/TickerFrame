import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Building2, TrendingUp, TrendingDown, Star } from 'lucide-react';
import { useStockDetail } from '@/context/StockDetailContext';

interface Holding {
  filer_name: string;
  symbol: string;
  shares: number | null;
  market_value: number | null;
  shares_change: number | null;
  pct_change: number | null;
  action: string;
  period_end: string;
  is_priority: boolean;
  source_url: string | null;
}

const fmtMoney = (n: number | null) => {
  if (!n) return '—';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
};

const actionStyles: Record<string, string> = {
  new: 'text-signal-buy bg-signal-buy/10',
  added: 'text-signal-buy bg-signal-buy/5',
  reduced: 'text-signal-hold bg-signal-hold/10',
  exited: 'text-signal-sell bg-signal-sell/10',
  hold: 'text-muted-foreground bg-secondary/40',
};

export const InstitutionalPanel = () => {
  const { open } = useStockDetail();

  const { data: priority = [] } = useQuery<Holding[]>({
    queryKey: ['institutional', 'jane-street'],
    queryFn: async () => {
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from('institutional_holdings')
        .select('*')
        .eq('is_priority', true)
        .gte('period_end', since)
        .neq('action', 'hold')
        .order('period_end', { ascending: false })
        .order('market_value', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as Holding[];
    },
    refetchInterval: 5 * 60_000,
  });

  const { data: peers = [] } = useQuery<Holding[]>({
    queryKey: ['institutional', 'peers'],
    queryFn: async () => {
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from('institutional_holdings')
        .select('*')
        .eq('is_priority', false)
        .neq('action', 'hold')
        .gte('period_end', since)
        .order('period_end', { ascending: false })
        .order('market_value', { ascending: false })
        .limit(15);
      if (error) throw error;
      return (data ?? []) as Holding[];
    },
    refetchInterval: 5 * 60_000,
  });

  const { data: topMoves = [] } = useQuery<Holding[]>({
    queryKey: ['institutional', 'jane-street-top-6mo'],
    queryFn: async () => {
      const since = new Date(Date.now() - 182 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from('institutional_holdings')
        .select('*')
        .eq('is_priority', true)
        .in('action', ['new', 'added'])
        .gte('period_end', since)
        .order('market_value', { ascending: false })
        .limit(50);
      if (error) throw error;
      const rows = (data ?? []) as Holding[];
      return rows
        .sort((a, b) => {
          const pa = a.pct_change ?? (a.action === 'new' ? 100 : 0);
          const pb = b.pct_change ?? (b.action === 'new' ? 100 : 0);
          if (pb !== pa) return pb - pa;
          return (b.market_value ?? 0) - (a.market_value ?? 0);
        })
        .slice(0, 10);
    },
    refetchInterval: 15 * 60_000,
  });

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <Building2 className="h-4 w-4 text-primary" />
        <h3 className="font-heading text-sm font-semibold">Institutional Tracker</h3>
        <span className="ml-auto text-[10px] text-muted-foreground">7-day moves · 6-mo top picks</span>
      </div>

      <div className="border-b border-border">
        <div className="flex items-center gap-1.5 px-4 py-2 bg-primary/5">
          <Star className="h-3 w-3 fill-primary text-primary" />
          <span className="font-heading text-xs font-bold uppercase tracking-wider text-primary">Jane Street — Last 7 Days</span>
        </div>
        {priority.length === 0 ? (
          <div className="px-4 py-6 text-center text-xs text-muted-foreground">
            No new Jane Street trades in the last 7 days.
          </div>
        ) : (
          <ul className="max-h-64 divide-y divide-border overflow-y-auto">
            {priority.map((h, i) => (
              <li
                key={`${h.symbol}-${i}`}
                onClick={() => open(h.symbol)}
                className="flex cursor-pointer items-center gap-2 px-4 py-2 text-xs hover:bg-secondary/40"
              >
                <span className="font-heading w-14 font-bold text-foreground">{h.symbol}</span>
                <span className={`rounded px-1.5 py-0.5 text-[10px] uppercase font-bold ${actionStyles[h.action] ?? actionStyles.hold}`}>
                  {h.action}
                </span>
                <span className="text-muted-foreground">{fmtMoney(h.market_value)}</span>
                {h.pct_change !== null && h.action !== 'new' && (
                  <span className={`flex items-center gap-0.5 ${h.pct_change >= 0 ? 'text-signal-buy' : 'text-signal-sell'}`}>
                    {h.pct_change >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {Math.abs(h.pct_change).toFixed(0)}%
                  </span>
                )}
                <span className="ml-auto text-[10px] text-muted-foreground">{h.period_end}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-b border-border">
        <div className="flex items-center gap-1.5 px-4 py-2 bg-primary/5">
          <TrendingUp className="h-3 w-3 text-primary" />
          <span className="font-heading text-xs font-bold uppercase tracking-wider text-primary">Jane Street — Top Moves · 6 Months</span>
        </div>
        {topMoves.length === 0 ? (
          <div className="px-4 py-4 text-center text-xs text-muted-foreground">No top conviction moves in the last 6 months.</div>
        ) : (
          <ul className="max-h-64 divide-y divide-border overflow-y-auto">
            {topMoves.map((h, i) => (
              <li
                key={`top-${h.symbol}-${i}`}
                onClick={() => open(h.symbol)}
                className="flex cursor-pointer items-center gap-2 px-4 py-2 text-xs hover:bg-secondary/40"
              >
                <span className="w-5 text-center text-[10px] font-bold text-muted-foreground">{i + 1}</span>
                <span className="font-heading w-14 font-bold text-foreground">{h.symbol}</span>
                <span className={`rounded px-1.5 py-0.5 text-[10px] uppercase font-bold ${actionStyles[h.action] ?? actionStyles.hold}`}>
                  {h.action}
                </span>
                <span className="text-muted-foreground">{fmtMoney(h.market_value)}</span>
                {(h.pct_change !== null || h.action === 'new') && (
                  <span className="flex items-center gap-0.5 text-signal-buy">
                    <TrendingUp className="h-3 w-3" />
                    {h.action === 'new' ? 'NEW' : `+${Math.abs(h.pct_change ?? 0).toFixed(0)}%`}
                  </span>
                )}
                <span className="ml-auto text-[10px] text-muted-foreground">{h.period_end}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <div className="px-4 py-2 bg-secondary/30">
          <span className="font-heading text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Citadel · Renaissance · Two Sigma
          </span>
        </div>
        {peers.length === 0 ? (
          <div className="px-4 py-4 text-center text-xs text-muted-foreground">No recent moves.</div>
        ) : (
          <ul className="max-h-48 divide-y divide-border overflow-y-auto">
            {peers.map((h, i) => (
              <li
                key={`peer-${h.symbol}-${i}`}
                onClick={() => open(h.symbol)}
                className="flex cursor-pointer items-center gap-2 px-4 py-2 text-xs hover:bg-secondary/40"
              >
                <span className="font-heading w-14 font-bold text-foreground">{h.symbol}</span>
                <span className={`rounded px-1.5 py-0.5 text-[10px] uppercase font-bold ${actionStyles[h.action] ?? actionStyles.hold}`}>
                  {h.action}
                </span>
                <span className="text-muted-foreground">{fmtMoney(h.market_value)}</span>
                <span className="ml-auto truncate text-[10px] text-muted-foreground" title={h.filer_name}>
                  {h.filer_name.split(' ')[0]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
