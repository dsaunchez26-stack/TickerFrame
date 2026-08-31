import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, Pencil, Check, X, TrendingUp, TrendingDown, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { PositionAlertBadge } from '@/components/PositionAlertBadge';
import type { Database } from '@/integrations/supabase/types';

type FuturesRow = Database['public']['Tables']['futures_positions']['Row'];

interface Props {
  portfolioName: string;
}

interface LiveFuture { last: number | null; multiplier: number | null }

// Futures P&L needs the real per-point dollar multiplier (a Gold contract's
// $1 move is worth $100/contract, a 10-Year Note's is worth ~$1,000/contract)
// -- unlike stocks, quantity x price alone isn't dollars. Fetched once per
// mount from the same live scan the Futures page itself uses, matched by
// product code rather than the exact (expiring) contract symbol held.
function useLiveFutures() {
  const [bySymbol, setBySymbol] = useState<Record<string, LiveFuture>>({});
  useEffect(() => {
    supabase.functions.invoke('futures-scanner', { body: {} }).then(({ data }) => {
      const map: Record<string, LiveFuture> = {};
      for (const r of (data?.rows ?? []) as Array<{ code: string; last: number | null; notionalMultiplier: number | null; contractSize: number | null }>) {
        map[r.code] = { last: r.last, multiplier: r.notionalMultiplier ?? r.contractSize ?? null };
      }
      setBySymbol(map);
    });
  }, []);
  return bySymbol;
}

export const PortfolioFutures = ({ portfolioName }: Props) => {
  const { user } = useAuth();
  const [positions, setPositions] = useState<FuturesRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [productCode, setProductCode] = useState('');
  const [productName, setProductName] = useState('');
  const [contractSymbol, setContractSymbol] = useState('');
  const [entryPrice, setEntryPrice] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editEntry, setEditEntry] = useState('');
  const [editQty, setEditQty] = useState('');
  const [editTarget, setEditTarget] = useState('');
  const [editStop, setEditStop] = useState('');

  const live = useLiveFutures();

  const refresh = async () => {
    if (!user) { setPositions([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from('futures_positions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setPositions(data ?? []);
    setLoading(false);
  };

  useEffect(() => { refresh(); }, [user]);

  const rows = useMemo(() => positions.filter(p => p.portfolio_name === portfolioName), [positions, portfolioName]);

  const handleAdd = async () => {
    if (!user || !productCode || !entryPrice) return;
    setSaving(true);
    await supabase.from('futures_positions').insert({
      user_id: user.id,
      product_code: productCode.toUpperCase(),
      product_name: productName || productCode.toUpperCase(),
      contract_symbol: contractSymbol || productCode.toUpperCase(),
      entry_price: parseFloat(entryPrice) || 0,
      quantity: parseInt(quantity, 10) || 1,
      portfolio_name: portfolioName,
    });
    setProductCode(''); setProductName(''); setContractSymbol(''); setEntryPrice(''); setQuantity('1'); setShowForm(false);
    setSaving(false);
    refresh();
  };

  const handleRemove = async (id: string) => {
    await supabase.from('futures_positions').delete().eq('id', id);
    refresh();
  };

  const startEdit = (p: FuturesRow) => {
    setEditingId(p.id);
    setEditEntry(String(p.entry_price));
    setEditQty(String(p.quantity));
    setEditTarget(p.target_gain_pct != null ? String(p.target_gain_pct) : '');
    setEditStop(p.stop_loss_pct != null ? String(p.stop_loss_pct) : '');
  };

  const cancelEdit = () => setEditingId(null);

  const saveEdit = async (p: FuturesRow) => {
    await supabase.from('futures_positions').update({
      entry_price: parseFloat(editEntry) || 0,
      quantity: parseInt(editQty, 10) || 1,
      target_gain_pct: editTarget.trim() ? parseFloat(editTarget) : null,
      stop_loss_pct: editStop.trim() ? parseFloat(editStop) : null,
    }).eq('id', p.id);
    setEditingId(null);
    refresh();
  };

  if (loading) return null;
  if (!rows.length && !showForm) {
    return (
      <div className="mt-3 border-t border-border/40 pt-3">
        <div className="flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Futures</div>
          <Button size="sm" variant="ghost" onClick={() => setShowForm(true)}><Plus className="h-3 w-3 mr-1" />Add future</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 border-t border-border/40 pt-3 space-y-1.5">
      <div className="flex items-center justify-between mb-1">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Futures</div>
        <Button size="sm" variant="ghost" onClick={() => setShowForm(!showForm)}><Plus className="h-3 w-3 mr-1" />Add future</Button>
      </div>

      {showForm && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-2">
          <Input placeholder="Code (e.g. ES)" value={productCode} onChange={e => setProductCode(e.target.value)} className="h-8 text-xs" title="The product code from the Futures page, e.g. ES, CL, GC" />
          <Input placeholder="Name (optional)" value={productName} onChange={e => setProductName(e.target.value)} className="h-8 text-xs" />
          <Input placeholder="Contract symbol (optional)" value={contractSymbol} onChange={e => setContractSymbol(e.target.value)} className="h-8 text-xs" />
          <Input placeholder="Entry price" type="number" value={entryPrice} onChange={e => setEntryPrice(e.target.value)} className="h-8 text-xs" />
          <Input placeholder="Contracts" type="number" value={quantity} onChange={e => setQuantity(e.target.value)} className="h-8 text-xs" />
          <Button size="sm" className="h-8 text-xs col-span-2 md:col-span-1" onClick={handleAdd} disabled={saving}>
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
          </Button>
        </div>
      )}

      {rows.map(p => {
        const liveInfo = live[p.product_code];
        const currentPrice = liveInfo?.last ?? p.entry_price;
        const multiplier = liveInfo?.multiplier;
        const priceDiff = currentPrice - Number(p.entry_price);
        const pnl = multiplier != null ? priceDiff * p.quantity * multiplier : null;
        const pnlPct = Number(p.entry_price) > 0 ? (priceDiff / Number(p.entry_price)) * 100 : 0;
        const isEditing = editingId === p.id;
        return (
          <div key={p.id} className="rounded-md border border-border/40 p-2 hover:bg-secondary/40">
            {isEditing ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold shrink-0">{p.product_code} {p.product_name}</span>
                <Input placeholder="Entry price" type="number" value={editEntry} onChange={e => setEditEntry(e.target.value)} className="h-7 w-24 text-xs" />
                <Input placeholder="Contracts" type="number" value={editQty} onChange={e => setEditQty(e.target.value)} className="h-7 w-16 text-xs" />
                <Input placeholder="Target %" type="number" value={editTarget} onChange={e => setEditTarget(e.target.value)} className="h-7 w-20 text-xs" title="Alert me when up this much (optional, your own number)" />
                <Input placeholder="Stop %" type="number" value={editStop} onChange={e => setEditStop(e.target.value)} className="h-7 w-20 text-xs" title="Alert me when down this much (optional, your own number)" />
                <button onClick={() => saveEdit(p)} className="p-1 rounded hover:bg-signal-buy/10 text-signal-buy shrink-0"><Check className="h-3.5 w-3.5" /></button>
                <button onClick={cancelEdit} className="p-1 rounded hover:bg-secondary text-muted-foreground shrink-0"><X className="h-3.5 w-3.5" /></button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-heading text-sm font-bold">{p.product_code} {p.product_name}</span>
                    <PositionAlertBadge pnlPct={pnlPct} targetGainPct={p.target_gain_pct} stopLossPct={p.stop_loss_pct} size="xs" />
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 flex flex-wrap gap-x-2">
                    <span>Entry ${Number(p.entry_price).toFixed(2)} × {p.quantity} · Now ${currentPrice.toFixed(2)}{multiplier == null && ' · $ P&L unavailable (no contract multiplier reported)'}</span>
                  </div>
                </div>
                <div className="text-right mr-2">
                  {pnl !== null ? (
                    <>
                      <div className={`text-xs font-bold flex items-center gap-0.5 ${pnl >= 0 ? 'text-signal-buy' : 'text-signal-sell'}`}>
                        {pnl >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {pnl >= 0 ? '+' : ''}${pnl.toFixed(0)}
                      </div>
                      <div className={`text-[10px] ${pnlPct >= 0 ? 'text-signal-buy' : 'text-signal-sell'}`}>{pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%</div>
                    </>
                  ) : (
                    <div className={`text-[10px] ${pnlPct >= 0 ? 'text-signal-buy' : 'text-signal-sell'}`}>{pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%</div>
                  )}
                </div>
                <button onClick={() => startEdit(p)} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground">
                  <Pencil className="h-3 w-3" />
                </button>
                <button onClick={() => handleRemove(p.id)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
