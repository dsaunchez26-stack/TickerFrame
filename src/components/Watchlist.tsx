import { useStockData } from '@/hooks/useStockData';
import type { Stock } from '@/lib/mockData';
import { ArrowUpRight, ArrowDownRight, Loader2, Flame, Clock, Check, ChevronDown } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useStockDetail } from '@/context/StockDetailContext';
import { usePortfolio } from '@/hooks/usePortfolio';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

const SignalBadge = ({ signal }: { signal: Stock['signal'] }) => {
  const styles = { buy: 'bg-signal-buy/15 text-signal-buy', sell: 'bg-signal-sell/15 text-signal-sell', hold: 'bg-signal-hold/15 text-signal-hold' };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${styles[signal]}`}>{signal}</span>;
};

export const Watchlist = () => {
  const { data, isLoading } = useStockData();
  const { open } = useStockDetail();
  const { data: portfolio, addStock, removeStock } = usePortfolio();
  const [editing, setEditing] = useState<string | null>(null);
  const [qty, setQty] = useState('1');
  const [buyPrice, setBuyPrice] = useState('');
  const [ptype, setPtype] = useState<'day_trade' | 'long_term' | 'watchlist'>('long_term');
  const INITIAL = 15;
  const STEP = 10;
  const [visible, setVisible] = useState(INITIAL);

  const ownedMap = useMemo(() => {
    const m = new Map<string, Set<string>>();
    (portfolio ?? []).forEach(p => {
      if (!m.has(p.symbol)) m.set(p.symbol, new Set());
      m.get(p.symbol)!.add(p.portfolio_type);
    });
    return m;
  }, [portfolio]);

  const sortedStocks = useMemo(() => {
    if (!data?.stocks?.length) return [];
    // Buy signals lead, then hold, then sell -- within each tier, biggest
    // movers first. A big sell-signal drop should never outrank an actual
    // buy pick just because its percentage move happens to be larger.
    const signalTier = (s: Stock['signal']) => (s === 'buy' ? 0 : s === 'hold' ? 1 : 2);
    return [...data.stocks].sort((a, b) => {
      const tierDiff = signalTier(a.signal) - signalTier(b.signal);
      if (tierDiff !== 0) return tierDiff;
      return Math.abs(b.changePercent) - Math.abs(a.changePercent);
    });
  }, [data]);
  const shown = sortedStocks.slice(0, visible);
  const hasMore = visible < sortedStocks.length;
  const canCollapse = visible > INITIAL;

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-heading text-sm font-semibold text-foreground">Top Bullish Picks</h3>
          <span className="text-[9px] text-muted-foreground italic">✓ to track</span>
        </div>
        {data?.fetchedAt && <span className="text-[9px] text-muted-foreground">Updated {new Date(data.fetchedAt).toLocaleTimeString()}</span>}
      </div>
      {isLoading ? (
        <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="divide-y divide-border">
          {shown.map((s) => {
            const isBigMover = Math.abs(s.changePercent) >= 3;
            const owned = ownedMap.get(s.symbol);
            const isOwned = !!owned && owned.size > 0;
            const isEditing = editing === s.symbol;
            return (
              <div key={s.symbol} className={`px-4 py-2.5 transition-colors hover:bg-secondary/50 ${isBigMover ? 'bg-primary/5' : ''}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Checkbox
                      checked={isOwned || isEditing}
                      onCheckedChange={(checked) => {
                        if (checked && !isOwned) { setEditing(s.symbol); setBuyPrice(s.price.toFixed(2)); setQty('1'); setPtype('long_term'); }
                        else if (isOwned) { owned!.forEach(pt => removeStock.mutate({ symbol: s.symbol, portfolio_type: pt })); }
                        else { setEditing(null); }
                      }}
                    />
                    <div className="min-w-0 cursor-pointer flex-1" onClick={() => open(s.symbol)}>
                      <div className="flex items-center gap-2">
                        {isBigMover && <Flame className="h-3 w-3 text-orange-400" />}
                        <span className="font-heading text-xs font-semibold text-foreground">{s.symbol}</span>
                        <SignalBadge signal={s.signal} />
                        {isOwned && <span className="rounded-full bg-signal-buy/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-signal-buy">✓</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="truncate text-[10px] text-muted-foreground">{isBigMover ? '🔥 Big mover — trade opportunity' : s.name}</p>
                        {s.holdDuration && <span className="flex items-center gap-0.5 text-[9px] text-primary/80 whitespace-nowrap"><Clock className="h-2.5 w-2.5" />{s.holdDuration}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="text-right cursor-pointer" onClick={() => open(s.symbol)}>
                    <p className="font-heading text-xs font-semibold text-foreground">${s.price.toFixed(2)}</p>
                    <p className={`flex items-center justify-end gap-0.5 text-[10px] font-medium ${s.change >= 0 ? 'text-signal-buy' : 'text-signal-sell'}`}>
                      {s.change >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                      {s.changePercent > 0 ? '+' : ''}{s.changePercent.toFixed(2)}%
                    </p>
                  </div>
                </div>

                {isEditing && !isOwned && (
                  <div className="mt-2 rounded border border-primary/30 bg-primary/5 p-2 space-y-2">
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
                      <Button size="sm" className="h-7 px-2" onClick={() => {
                        addStock.mutate({ symbol: s.symbol, buy_price: parseFloat(buyPrice) || s.price, quantity: parseFloat(qty) || 1, portfolio_type: ptype }, { onSuccess: () => { setEditing(null); toast.success(`${s.symbol} added`); } });
                      }}><Check className="h-3 w-3" /></Button>
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setEditing(null)}>✕</Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {!isLoading && (hasMore || canCollapse) && (
        <div className="border-t border-border p-2 flex items-center justify-center gap-2">
          {hasMore && <Button size="sm" variant="outline" onClick={() => setVisible(v => v + STEP)} className="h-7 text-xs"><ChevronDown className="h-3 w-3 mr-1" /> Show {Math.min(STEP, sortedStocks.length - visible)} more · {sortedStocks.length - visible} hidden</Button>}
          {canCollapse && <Button size="sm" variant="ghost" onClick={() => setVisible(INITIAL)} className="h-7 text-xs">Show less</Button>}
        </div>
      )}
    </div>
  );
};
