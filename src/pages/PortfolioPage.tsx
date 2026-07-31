import { useState, useMemo, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Trash2, Pencil, Check, X, TrendingUp, TrendingDown, Briefcase, Loader2 } from 'lucide-react';
import { usePortfolio, PortfolioEntry } from '@/hooks/usePortfolio';
import { useStockData } from '@/hooks/useStockData';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Disclaimer } from '@/components/Disclaimer';
import { PatternBadge } from '@/components/PatternBadge';
import { PortfolioRating } from '@/components/PortfolioRating';
import { PortfolioTrend } from '@/components/PortfolioTrend';
import { PortfolioOptions } from '@/components/PortfolioOptions';

type ViewMode = 'compare' | 'single';

function usePortfolioEnriched(name: string) {
  const { user } = useAuth();
  const { data: portfolio, isLoading, addStock, removeStock } = usePortfolio(undefined, name);
  const { data: stockData } = useStockData('all');
  const cached = useMemo(() => new Set((stockData?.stocks ?? []).map(s => s.symbol)), [stockData]);
  const missing = useMemo(() => (portfolio ?? []).map(p => p.symbol).filter(s => !cached.has(s)), [portfolio, cached]);
  const { data: extra } = useQuery<Record<string, any>>({
    queryKey: ['pq', name, [...missing].sort().join(',')],
    enabled: missing.length > 0,
    // The edge function has occasionally come back with an empty quotes
    // object on a cold start even though the request itself succeeded --
    // React Query treats that as a completed, cacheable result and won't
    // retry on its own since nothing threw. Treating an unexpectedly-empty
    // response as a retryable failure (instead of silently caching it)
    // keeps a bad first attempt from permanently stranding every untracked
    // holding at its cost basis until something else changes the query key.
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('fetch-portfolio-quotes', { body: { symbols: missing } });
      if (error) throw error;
      const quotes = (data?.quotes ?? {}) as Record<string, any>;
      if (Object.keys(quotes).length === 0) throw new Error('fetch-portfolio-quotes returned no quotes');
      return quotes;
    },
    retry: 2,
  });
  const enriched = useMemo(() => {
    if (!portfolio?.length) return [];
    const map = new Map((stockData?.stocks ?? []).map(s => [s.symbol, s]));
    return portfolio.map(p => {
      const live = map.get(p.symbol);
      const ex = extra?.[p.symbol] ?? null;
      const cur = live?.price ?? ex?.price ?? p.buy_price;
      const prev = live?.prevClose ?? ex?.prevClose ?? cur;
      const changePct = live?.changePercent ?? ex?.changePercent ?? 0;
      const todayDollar = (cur - prev) * p.quantity;
      const pnl = (cur - p.buy_price) * p.quantity;
      const pnlPct = ((cur - p.buy_price) / p.buy_price) * 100;
      return { ...p, currentPrice: cur, prevClose: prev, changePct, todayDollar, pnl, pnlPct, signal: live?.signal ?? 'hold', pattern: live?.pattern ?? null, patternConfidence: live?.patternConfidence };
    });
  }, [portfolio, stockData, extra]);
  const totals = useMemo(() => {
    const inv = enriched.reduce((s, e) => s + e.buy_price * e.quantity, 0);
    const cur = enriched.reduce((s, e) => s + e.currentPrice * e.quantity, 0);
    const prev = enriched.reduce((s, e) => s + e.prevClose * e.quantity, 0);
    const today = cur - prev;
    const todayPct = prev > 0 ? (today / prev) * 100 : 0;
    const pnl = cur - inv;
    const wins = enriched.filter(e => e.pnl > 0).length;
    return {
      invested: inv, current: cur, pnl, pnlPct: inv > 0 ? (pnl / inv) * 100 : 0,
      today, todayPct,
      positions: enriched.length, winners: wins,
      winRate: enriched.length > 0 ? (wins / enriched.length) * 100 : 0,
    };
  }, [enriched]);

  // Record at most one snapshot per portfolio per day -- this is the only
  // way trend comparisons ("vs 7 days ago") and the pace illustration can
  // ever have real data to work from, since we've never stored historical
  // portfolio value before now.
  //
  // Guard against snapshotting before live prices have actually loaded: on
  // first render, every position's currentPrice falls back to its own
  // buy_price (see the enriched useMemo above), which would silently record
  // a bogus "break-even" snapshot and permanently corrupt the very baseline
  // every future comparison is measured against. Tracked-universe symbols
  // (via useStockData) and untracked ones (via the separate fetch-portfolio-
  // quotes query) resolve at different times, so requiring just one position
  // to have live data isn't enough for portfolios mixing both -- require
  // every position to, so a still-loading untracked stock can't slip a
  // partially-stale snapshot through.
  const hasLiveData = enriched.length > 0 && enriched.every(e => e.currentPrice !== e.buy_price);
  const snapshotAttempted = useRef(false);
  useEffect(() => {
    if (!user || totals.positions === 0 || !hasLiveData || snapshotAttempted.current) return;
    snapshotAttempted.current = true;
    (async () => {
      const dayStart = new Date();
      dayStart.setUTCHours(0, 0, 0, 0);
      const { data: existing } = await supabase
        .from('portfolio_snapshots')
        .select('id')
        .eq('user_id', user.id)
        .eq('portfolio_name', name)
        .gte('captured_at', dayStart.toISOString())
        .limit(1)
        .maybeSingle();
      if (existing) return;
      await supabase.from('portfolio_snapshots').insert({
        user_id: user.id,
        portfolio_type: 'combined',
        portfolio_name: name,
        total_value: totals.current,
        total_invested: totals.invested,
        pnl_pct: totals.pnlPct,
      });
    })();
  }, [user, name, totals.positions, hasLiveData]);

  return { enriched, totals, isLoading, addStock, removeStock };
}

const Kpi = ({ label, value, sub, positive }: { label: string; value: string; sub?: string; positive?: boolean | null }) => (
  <div className="rounded-md border border-border/60 p-3">
    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
    <div className={`mt-1 font-heading text-lg font-bold ${positive === true ? 'text-signal-buy' : positive === false ? 'text-signal-sell' : ''}`}>{value}</div>
    {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
  </div>
);

const PortfolioPanel = ({ name, accent }: { name: string; accent: string }) => {
  const { user } = useAuth();
  const { enriched, totals, isLoading, addStock, removeStock } = usePortfolioEnriched(name);
  const [showForm, setShowForm] = useState(false);
  const [sym, setSym] = useState(''); const [bp, setBp] = useState(''); const [qty, setQty] = useState('1');
  const [editingSymbol, setEditingSymbol] = useState<string | null>(null);
  const [editBp, setEditBp] = useState(''); const [editQty, setEditQty] = useState('');

  const handleAdd = () => {
    if (!sym) return;
    addStock.mutate({ symbol: sym, buy_price: parseFloat(bp) || 0, quantity: parseFloat(qty) || 1, portfolio_type: 'long_term', portfolio_name: name });
    setSym(''); setBp(''); setQty('1'); setShowForm(false);
  };

  const startEdit = (e: { symbol: string; buy_price: number; quantity: number }) => {
    setEditingSymbol(e.symbol);
    setEditBp(String(e.buy_price));
    setEditQty(String(e.quantity));
  };

  const saveEdit = (e: Pick<PortfolioEntry, 'symbol' | 'portfolio_type'>) => {
    addStock.mutate({ symbol: e.symbol, buy_price: parseFloat(editBp) || 0, quantity: parseFloat(editQty) || 1, portfolio_type: e.portfolio_type, portfolio_name: name });
    setEditingSymbol(null);
  };

  return (
    <Card className="p-4 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full" style={{ background: accent }} />
          <h3 className="font-heading text-base font-bold">{name}</h3>
        </div>
        <Button size="sm" variant="ghost" onClick={() => setShowForm(!showForm)}><Plus className="h-3 w-3 mr-1" />Add</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        <Kpi label="Value" value={`$${totals.current.toFixed(0)}`} sub={`Invested $${totals.invested.toFixed(0)}`} />
        <Kpi label="Today" value={`${totals.today >= 0 ? '+' : ''}$${totals.today.toFixed(0)}`} sub={`${totals.todayPct >= 0 ? '+' : ''}${totals.todayPct.toFixed(2)}%`} positive={totals.today >= 0} />
        <Kpi label="All-time" value={`${totals.pnl >= 0 ? '+' : ''}$${totals.pnl.toFixed(0)}`} sub={`${totals.pnlPct >= 0 ? '+' : ''}${totals.pnlPct.toFixed(2)}%`} positive={totals.pnl >= 0} />
        <Kpi label="Win Rate" value={`${totals.winRate.toFixed(0)}%`} sub={`${totals.winners}/${totals.positions} winners`} />
      </div>

      {showForm && (
        <div className="grid grid-cols-4 gap-2 mb-3">
          <Input placeholder="Symbol" value={sym} onChange={e => setSym(e.target.value)} className="h-8 text-xs" />
          <Input placeholder="Buy $" type="number" value={bp} onChange={e => setBp(e.target.value)} className="h-8 text-xs" />
          <Input placeholder="Qty" type="number" value={qty} onChange={e => setQty(e.target.value)} className="h-8 text-xs" />
          <Button size="sm" className="h-8 text-xs" onClick={handleAdd}>{addStock.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}</Button>
        </div>
      )}

      {!isLoading && enriched.length > 0 && (
        <>
          <PortfolioRating enriched={enriched} totalValue={totals.current} pnlPct={totals.pnlPct} winRate={totals.winRate} />
          {user && <PortfolioTrend userId={user.id} portfolioName={name} />}
        </>
      )}

      <div className="flex-1 overflow-auto space-y-1.5">
        {isLoading && <div className="text-center py-4"><Loader2 className="h-4 w-4 animate-spin mx-auto text-muted-foreground" /></div>}
        {!isLoading && enriched.length === 0 && <div className="text-xs text-center text-muted-foreground py-6">No positions yet.</div>}
        {enriched.map(e => {
          const isEditing = editingSymbol === e.symbol;
          return (
          <div key={e.id} className="rounded-md border border-border/40 p-2 hover:bg-secondary/40">
            {isEditing ? (
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold shrink-0">{e.symbol}</span>
                <Input placeholder="Buy $" type="number" value={editBp} onChange={ev => setEditBp(ev.target.value)} className="h-7 text-xs" />
                <Input placeholder="Qty" type="number" value={editQty} onChange={ev => setEditQty(ev.target.value)} className="h-7 text-xs" />
                <button onClick={() => saveEdit(e)} className="p-1 rounded hover:bg-signal-buy/10 text-signal-buy shrink-0"><Check className="h-3.5 w-3.5" /></button>
                <button onClick={() => setEditingSymbol(null)} className="p-1 rounded hover:bg-secondary text-muted-foreground shrink-0"><X className="h-3.5 w-3.5" /></button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-heading text-sm font-bold">{e.symbol}</span>
                    {e.pattern && <PatternBadge pattern={e.pattern} confidence={e.patternConfidence} size="xs" />}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 flex flex-wrap gap-x-2">
                    <span>Buy ${e.buy_price.toFixed(2)} × {e.quantity} · Now ${e.currentPrice.toFixed(2)}</span>
                    <span className={e.todayDollar >= 0 ? 'text-signal-buy' : 'text-signal-sell'}>
                      Today {e.todayDollar >= 0 ? '+' : ''}${e.todayDollar.toFixed(2)} ({e.changePct >= 0 ? '+' : ''}{e.changePct.toFixed(2)}%)
                    </span>
                  </div>
                </div>
                <div className="text-right mr-2">
                  <div className={`text-xs font-bold flex items-center gap-0.5 ${e.pnl >= 0 ? 'text-signal-buy' : 'text-signal-sell'}`}>
                    {e.pnl >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {e.pnl >= 0 ? '+' : ''}${e.pnl.toFixed(0)}
                  </div>
                  <div className={`text-[10px] ${e.pnlPct >= 0 ? 'text-signal-buy' : 'text-signal-sell'}`}>{e.pnlPct >= 0 ? '+' : ''}{e.pnlPct.toFixed(1)}%</div>
                </div>
                <button onClick={() => startEdit(e)} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground">
                  <Pencil className="h-3 w-3" />
                </button>
                <button onClick={() => removeStock.mutate({ symbol: e.symbol, portfolio_name: name })} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        );})}
      </div>

      <PortfolioOptions portfolioName={name} />
    </Card>
  );
};

const PortfolioPage = () => {
  const [view, setView] = useState<ViewMode>('compare');
  return (
    <div className="mx-auto max-w-[1600px] space-y-6 px-4 py-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15">
            <Briefcase className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-heading text-2xl font-bold">Portfolio Hub</h1>
            <p className="text-xs text-muted-foreground mt-1">Compare two portfolios side by side — track different strategies in real time.</p>
          </div>
        </div>
        <Tabs value={view} onValueChange={(v) => setView(v as ViewMode)}>
          <TabsList>
            <TabsTrigger value="compare">Compare</TabsTrigger>
            <TabsTrigger value="single">Single</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <Disclaimer />
      {view === 'compare' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <PortfolioPanel name="Portfolio A" accent="hsl(var(--signal-buy))" />
          <PortfolioPanel name="Portfolio B" accent="hsl(var(--primary))" />
        </div>
      ) : (
        <PortfolioPanel name="Portfolio A" accent="hsl(var(--signal-buy))" />
      )}
    </div>
  );
};

export default PortfolioPage;
