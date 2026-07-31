import { useStockData } from '@/hooks/useStockData';
import { ArrowDownRight, Target, Shield, Loader2, Flame, TrendingUp, Clock, Check } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useStockDetail } from '@/context/StockDetailContext';
import { usePortfolio } from '@/hooks/usePortfolio';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

export const TopMovers = () => {
  const { data, isLoading } = useStockData();
  const { open } = useStockDetail();
  const { data: portfolio, addStock, removeStock } = usePortfolio();
  const [editing, setEditing] = useState<string | null>(null);
  const [qty, setQty] = useState('1');
  const [buyPrice, setBuyPrice] = useState('');
  const [ptype, setPtype] = useState<'day_trade' | 'long_term' | 'watchlist'>('day_trade');

  const ownedMap = useMemo(() => {
    const m = new Map<string, Set<string>>();
    (portfolio ?? []).forEach(p => { if (!m.has(p.symbol)) m.set(p.symbol, new Set()); m.get(p.symbol)!.add(p.portfolio_type); });
    return m;
  }, [portfolio]);

  const movers = useMemo(() => {
    if (!data?.stocks?.length) return [];
    return [...data.stocks].sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent)).slice(0, 4).map((s) => {
      const isBullish = s.changePercent > 0;
      const risk = Math.abs(s.changePercent) > 5 ? 'High' : Math.abs(s.changePercent) > 2 ? 'Medium' : 'Low';
      const potentialGain = isBullish ? ((s.exit - s.price) / s.price * 100).toFixed(1) : ((s.price - s.entry) / s.price * 100).toFixed(1);
      return { symbol: s.symbol, price: s.price, changePercent: s.changePercent, direction: isBullish ? 'Long' as const : 'Short' as const, entry: s.price, target: isBullish ? s.exit : s.entry, stopLoss: isBullish ? s.entry : s.exit, risk, potentialGain, volume: s.volume, signal: s.signal, holdDuration: s.holdDuration || 'Swing' };
    });
  }, [data]);

  if (isLoading) return <div className="rounded-lg border border-border bg-card p-6 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (!movers.length) return null;

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="border-b border-border px-4 py-3 flex items-center gap-2">
        <Flame className="h-4 w-4 text-orange-400" />
        <h3 className="font-heading text-sm font-semibold text-foreground">Top Movers — Trade Setups</h3>
        <span className="ml-auto text-[10px] text-muted-foreground">Check ✓ to add to portfolio</span>
      </div>
      <div className="grid gap-0 divide-y divide-border sm:grid-cols-2 sm:divide-y-0 sm:divide-x">
        {movers.map((m) => {
          const owned = ownedMap.get(m.symbol);
          const isOwned = !!owned && owned.size > 0;
          const isEditing = editing === m.symbol;
          return (
            <div key={m.symbol} className="p-4 hover:bg-secondary/30 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Checkbox checked={isOwned || isEditing} onCheckedChange={(checked) => {
                    if (checked && !isOwned) { setEditing(m.symbol); setBuyPrice(m.entry.toFixed(2)); setQty('1'); setPtype(m.direction === 'Long' ? 'day_trade' : 'watchlist'); }
                    else if (isOwned) { owned!.forEach(pt => { removeStock.mutate({ symbol: m.symbol, portfolio_type: pt }); }); }
                    else { setEditing(null); }
                  }} />
                  <span className="font-heading text-base font-bold text-foreground cursor-pointer" onClick={() => open(m.symbol)}>{m.symbol}</span>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${m.direction === 'Long' ? 'bg-signal-buy/15 text-signal-buy' : 'bg-signal-sell/15 text-signal-sell'}`}>
                    {m.direction === 'Long' ? <TrendingUp className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}{m.direction}
                  </span>
                  {isOwned && <span className="rounded-full bg-signal-buy/15 px-2 py-0.5 text-[9px] font-bold uppercase text-signal-buy">In {Array.from(owned!)[0].replace('_',' ')}</span>}
                </div>
                <span className={`font-heading text-sm font-bold ${m.changePercent >= 0 ? 'text-signal-buy' : 'text-signal-sell'}`}>{m.changePercent > 0 ? '+' : ''}{m.changePercent.toFixed(2)}%</span>
              </div>

              {isEditing && !isOwned && (
                <div className="mb-3 rounded border border-primary/30 bg-primary/5 p-2 space-y-2">
                  <Tabs value={ptype} onValueChange={(v) => setPtype(v as any)}>
                    <TabsList className="grid w-full grid-cols-3 h-7">
                      <TabsTrigger value="day_trade" className="text-[10px]">Day</TabsTrigger>
                      <TabsTrigger value="long_term" className="text-[10px]">Long</TabsTrigger>
                      <TabsTrigger value="watchlist" className="text-[10px]">Watch</TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-1">
                    <Input value={buyPrice} onChange={e => setBuyPrice(e.target.value)} placeholder="Price" type="number" step="0.01" className="h-7 text-xs" />
                    <Input value={qty} onChange={e => setQty(e.target.value)} placeholder="Qty" type="number" className="h-7 text-xs" />
                    <Button size="sm" className="h-7 text-xs px-2" onClick={() => {
                      addStock.mutate({ symbol: m.symbol, buy_price: parseFloat(buyPrice) || m.entry, quantity: parseFloat(qty) || 1, portfolio_type: ptype }, { onSuccess: () => { setEditing(null); toast.success(`${m.symbol} added`); } });
                    }}><Check className="h-3 w-3" /></Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={() => setEditing(null)}>✕</Button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2 mb-3 text-[10px] cursor-pointer" onClick={() => open(m.symbol)}>
                <div className="rounded bg-secondary/50 p-2"><span className="text-muted-foreground block">Entry</span><p className="font-heading font-semibold text-foreground">${m.entry.toFixed(2)}</p></div>
                <div className="rounded bg-signal-buy/10 p-2"><div className="flex items-center gap-1 text-muted-foreground"><Target className="h-3 w-3 text-signal-buy" /> Target</div><p className="font-heading font-semibold text-signal-buy">${m.target.toFixed(2)}</p></div>
                <div className="rounded bg-signal-sell/10 p-2"><div className="flex items-center gap-1 text-muted-foreground"><Shield className="h-3 w-3 text-signal-sell" /> Stop</div><p className="font-heading font-semibold text-signal-sell">${m.stopLoss.toFixed(2)}</p></div>
              </div>

              <div className="flex items-center justify-between text-[10px]">
                <span className={`font-medium ${m.risk === 'High' ? 'text-signal-sell' : m.risk === 'Medium' ? 'text-signal-hold' : 'text-signal-buy'}`}>{m.risk} Risk</span>
                <span className="flex items-center gap-0.5 text-primary/80 font-medium"><Clock className="h-3 w-3" />{m.holdDuration}</span>
                <span className="text-signal-buy font-semibold">+{m.potentialGain}% potential</span>
                <span className="text-muted-foreground">{m.volume > 0 ? `${formatVolume(m.volume)} vol` : 'vol n/a'}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

function formatVolume(vol: number): string {
  if (vol >= 1_000_000_000) return (vol / 1_000_000_000).toFixed(1) + 'B';
  if (vol >= 1_000_000) return (vol / 1_000_000).toFixed(1) + 'M';
  if (vol >= 1_000) return (vol / 1_000).toFixed(1) + 'K';
  return vol.toString();
}
