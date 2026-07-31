import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Pencil, Check, X, TrendingUp, TrendingDown, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { OptionRow, CallPut } from '@/lib/optionsMockData';
import { addPick, loadCloudPicks, removeCloudPick, saveCloudPick, updatePick, TrackedPick } from '@/lib/optionPicks';

interface Props {
  portfolioName: string;
}

const emptyRow = (): OptionRow => ({
  id: '', score: 0, ticker: '', cp: 'P', stockPrice: 0, sector: 'Other', type: 'Manual',
  strike: 0, expiration: '', price: 0, bid: 0, ask: 0, delta: 0, gamma: 0, gpRatio: 0,
  ivRank: 0, volume: 0, oi: 0, voi: 0, dollarFlow: 0, printType: 'BLOCK', earningsInDays: null, squeeze: 0,
});

export const PortfolioOptions = ({ portfolioName }: Props) => {
  const [allPicks, setAllPicks] = useState<TrackedPick[]>([]);
  const [loading, setLoading] = useState(true);
  const [liveQuotes, setLiveQuotes] = useState<Record<string, number>>({});
  const [showForm, setShowForm] = useState(false);
  const [ticker, setTicker] = useState('');
  const [cp, setCp] = useState<CallPut>('P');
  const [strike, setStrike] = useState('');
  const [expiration, setExpiration] = useState('');
  const [premium, setPremium] = useState('');
  const [contracts, setContracts] = useState('1');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPremium, setEditPremium] = useState('');
  const [editContracts, setEditContracts] = useState('');

  const refresh = async () => {
    setLoading(true);
    const cloud = await loadCloudPicks();
    setAllPicks(cloud);
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  const picks = useMemo(() => allPicks.filter(p => p.portfolioName === portfolioName), [allPicks, portfolioName]);

  useEffect(() => {
    if (!picks.length) { setLiveQuotes({}); return; }
    const contractsBody = picks.map(p => ({ id: p.id, ticker: p.row.ticker, strike: p.row.strike, expiration: p.row.expiration, cp: p.row.cp }));
    supabase.functions.invoke('option-quotes', { body: { contracts: contractsBody } }).then(({ data }) => {
      const map: Record<string, number> = {};
      for (const q of (data?.quotes ?? []) as Array<{ id: string; price: number }>) {
        if (q.price > 0) map[q.id] = q.price;
      }
      setLiveQuotes(map);
    });
  }, [picks]);

  const handleAdd = async () => {
    if (!ticker || !strike || !expiration || !premium) return;
    setSaving(true);
    const strikeNum = parseFloat(strike);
    const premiumNum = parseFloat(premium);
    const qty = parseFloat(contracts) || 1;
    const row: OptionRow = {
      ...emptyRow(),
      id: `${ticker.toUpperCase()}-${expiration}-${cp}-${strikeNum}`,
      ticker: ticker.toUpperCase(),
      cp,
      strike: strikeNum,
      expiration,
      price: premiumNum,
      bid: premiumNum,
      ask: premiumNum,
    };
    const next = addPick(row, portfolioName, qty);
    const pick = next.find(p => p.id === row.id);
    if (pick) await saveCloudPick(pick);
    setTicker(''); setStrike(''); setExpiration(''); setPremium(''); setContracts('1'); setShowForm(false);
    setSaving(false);
    refresh();
  };

  const handleRemove = async (id: string) => {
    await removeCloudPick(id);
    refresh();
  };

  const startEdit = (p: TrackedPick) => {
    setEditingId(p.id);
    setEditPremium(String(p.entryPrice));
    setEditContracts(String(p.quantity ?? 1));
  };

  const cancelEdit = () => setEditingId(null);

  const saveEdit = async (pick: TrackedPick) => {
    await updatePick(pick, { entryPrice: parseFloat(editPremium) || 0, quantity: parseFloat(editContracts) || 1 });
    setEditingId(null);
    refresh();
  };

  if (loading) return null;
  if (!picks.length && !showForm) {
    return (
      <div className="mt-3 border-t border-border/40 pt-3">
        <div className="flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Options</div>
          <Button size="sm" variant="ghost" onClick={() => setShowForm(true)}><Plus className="h-3 w-3 mr-1" />Add option</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 border-t border-border/40 pt-3 space-y-1.5">
      <div className="flex items-center justify-between mb-1">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Options</div>
        <Button size="sm" variant="ghost" onClick={() => setShowForm(!showForm)}><Plus className="h-3 w-3 mr-1" />Add option</Button>
      </div>

      {showForm && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-2">
          <Input placeholder="Ticker" value={ticker} onChange={e => setTicker(e.target.value)} className="h-8 text-xs" />
          <Select value={cp} onValueChange={(v) => setCp(v as CallPut)}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="P">Put</SelectItem>
              <SelectItem value="C">Call</SelectItem>
            </SelectContent>
          </Select>
          <Input placeholder="Strike" type="number" value={strike} onChange={e => setStrike(e.target.value)} className="h-8 text-xs" />
          <Input placeholder="Expiration" type="date" value={expiration} onChange={e => setExpiration(e.target.value)} className="h-8 text-xs" />
          <Input placeholder="Premium/contract" type="number" value={premium} onChange={e => setPremium(e.target.value)} className="h-8 text-xs" />
          <Input placeholder="Contracts" type="number" value={contracts} onChange={e => setContracts(e.target.value)} className="h-8 text-xs" />
          <Button size="sm" className="h-8 text-xs col-span-2 md:col-span-1" onClick={handleAdd} disabled={saving}>
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
          </Button>
        </div>
      )}

      {picks.map(p => {
        const qty = p.quantity ?? 1;
        const cost = p.entryPrice * qty * 100;
        const currentPremium = liveQuotes[p.id] ?? p.entryPrice;
        const currentValue = currentPremium * qty * 100;
        const pnl = currentValue - cost;
        const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;
        const isExpired = new Date(p.row.expiration) < new Date();
        const isEditing = editingId === p.id;
        return (
          <div key={p.id} className="rounded-md border border-border/40 p-2 hover:bg-secondary/40">
            {isEditing ? (
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold shrink-0">{p.row.ticker} {p.row.cp === 'P' ? 'Put' : 'Call'} ${p.row.strike}</span>
                <Input placeholder="Premium/contract" type="number" value={editPremium} onChange={e => setEditPremium(e.target.value)} className="h-7 text-xs" />
                <Input placeholder="Contracts" type="number" value={editContracts} onChange={e => setEditContracts(e.target.value)} className="h-7 text-xs" />
                <button onClick={() => saveEdit(p)} className="p-1 rounded hover:bg-signal-buy/10 text-signal-buy shrink-0"><Check className="h-3.5 w-3.5" /></button>
                <button onClick={cancelEdit} className="p-1 rounded hover:bg-secondary text-muted-foreground shrink-0"><X className="h-3.5 w-3.5" /></button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-heading text-sm font-bold">{p.row.ticker} {p.row.cp === 'P' ? 'Put' : 'Call'} ${p.row.strike}</span>
                    {isExpired && <span className="text-[9px] rounded bg-muted px-1 py-0.5 text-muted-foreground">Expired</span>}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 flex flex-wrap gap-x-2">
                    <span>Entry ${p.entryPrice.toFixed(2)} × {qty} · Now ${currentPremium.toFixed(2)} · Exp {p.row.expiration}</span>
                  </div>
                </div>
                <div className="text-right mr-2">
                  <div className={`text-xs font-bold flex items-center gap-0.5 ${pnl >= 0 ? 'text-signal-buy' : 'text-signal-sell'}`}>
                    {pnl >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {pnl >= 0 ? '+' : ''}${pnl.toFixed(0)}
                  </div>
                  <div className={`text-[10px] ${pnlPct >= 0 ? 'text-signal-buy' : 'text-signal-sell'}`}>{pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%</div>
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
