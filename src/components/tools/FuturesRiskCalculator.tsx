import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const fmtUsd = (v: number) => v.toLocaleString(undefined, { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface FutureRow { code: string; name: string; last: number | null; tickSize: number | null; contractSize: number | null; notionalMultiplier: number | null }

// A future's dollar risk isn't quantity x price the way a stock's is -- each
// product has its own exchange-defined multiplier (a Gold contract's $1
// move is worth $100/contract, a 10-Year Note's is worth roughly
// $1,000/contract). Getting this from a real lookup rather than assuming
// "1 point = $1" is the whole reason this needs its own calculator instead
// of just reusing the stock one with a different label.
export const FuturesRiskCalculator = () => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [matched, setMatched] = useState<FutureRow | null>(null);

  const [entryPrice, setEntryPrice] = useState('');
  const [contracts, setContracts] = useState('1');
  const [stopLossPct, setStopLossPct] = useState('2');
  const [targetPct, setTargetPct] = useState('4');

  const lookup = async () => {
    const c = code.trim().toUpperCase();
    if (!c) return;
    setLoading(true);
    setLookupError(null);
    const { data, error } = await supabase.functions.invoke('futures-scanner', { body: {} });
    setLoading(false);
    const rows: FutureRow[] = Array.isArray(data?.rows) ? data.rows : [];
    const row = rows.find(r => r.code === c);
    if (error || !row) {
      setLookupError(error?.message || `No contract found for "${c}". Check the product code on the Futures page (e.g. ES, CL, GC).`);
      setMatched(null);
      return;
    }
    setMatched(row);
    if (row.last !== null) setEntryPrice(row.last.toFixed(2));
  };

  const multiplier = matched?.notionalMultiplier ?? matched?.contractSize ?? null;
  const tickSize = matched?.tickSize ?? null;

  const entry = parseFloat(entryPrice);
  const qty = parseFloat(contracts);
  const stopPct = parseFloat(stopLossPct);
  const gainPct = parseFloat(targetPct);
  const valid = entry > 0 && qty > 0 && multiplier !== null;

  const stopPrice = valid && !isNaN(stopPct) ? entry * (1 - stopPct / 100) : null;
  const targetPrice = valid && !isNaN(gainPct) ? entry * (1 + gainPct / 100) : null;
  const dollarRisk = valid && stopPrice !== null ? qty * multiplier! * (entry - stopPrice) : null;
  const dollarGain = valid && targetPrice !== null ? qty * multiplier! * (targetPrice - entry) : null;
  const riskRewardRatio = dollarRisk && dollarGain && dollarRisk > 0 ? dollarGain / dollarRisk : null;
  const notional = valid ? qty * multiplier! * entry : null;
  const riskInTicks = dollarRisk !== null && tickSize !== null && multiplier !== null && tickSize > 0
    ? Math.abs(dollarRisk) / (tickSize * multiplier * qty)
    : null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-sm font-semibold">1. Pick a future</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && lookup()}
              placeholder="Product code, e.g. ES"
              className="h-9 max-w-48"
            />
            <Button size="sm" onClick={lookup} disabled={!code || loading}>
              {loading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Search className="mr-1 h-3.5 w-3.5" />}
              Get Contract
            </Button>
          </div>
          {lookupError && <p className="text-xs text-signal-sell">{lookupError}</p>}
          {matched && (
            <p className="text-xs text-muted-foreground">
              {matched.code} — {matched.name}. {matched.last !== null ? <>Last price: <span className="font-semibold text-foreground">${matched.last.toFixed(2)}</span>.</> : 'Live price unavailable right now — enter one manually below.'}
              {multiplier !== null && <> Contract multiplier: <span className="font-semibold text-foreground">${multiplier}</span>/point.</>}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm font-semibold">2. Set your position</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Entry price</Label>
            <Input type="number" value={entryPrice} onChange={e => setEntryPrice(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Contracts</Label>
            <Input type="number" value={contracts} onChange={e => setContracts(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Stop-loss, below entry (%)</Label>
            <Input type="number" value={stopLossPct} onChange={e => setStopLossPct(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Target gain, above entry (%)</Label>
            <Input type="number" value={targetPct} onChange={e => setTargetPct(e.target.value)} className="h-9" />
          </div>
        </CardContent>
      </Card>

      {!valid && matched && multiplier === null && (
        <p className="text-xs text-signal-sell">This product didn't report a contract multiplier — the math below needs it to convert a price move into a real dollar amount, so it can't be shown for this contract.</p>
      )}

      {valid && (
        <Card>
          <CardHeader><CardTitle className="text-sm font-semibold">3. The math</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-border p-3">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Total notional exposure</div>
                <div className="mt-1 text-lg font-bold">{notional !== null ? fmtUsd(notional) : '—'}</div>
                <div className="text-[10px] text-muted-foreground">{qty} contract{qty === 1 ? '' : 's'} × ${multiplier}/pt × ${entry.toFixed(2)}</div>
              </div>
              <div className="rounded-lg border border-signal-sell/30 bg-signal-sell/5 p-3">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Dollar risk to stop</div>
                <div className="mt-1 text-lg font-bold text-signal-sell">{dollarRisk !== null ? fmtUsd(dollarRisk) : '—'}</div>
                <div className="text-[10px] text-muted-foreground">
                  {stopPrice !== null ? `if it hits $${stopPrice.toFixed(2)} (${stopLossPct}% down)${riskInTicks !== null ? ` — ${riskInTicks.toFixed(0)} ticks` : ''}` : 'set a stop-loss %'}
                </div>
              </div>
              <div className="rounded-lg border border-signal-buy/30 bg-signal-buy/5 p-3">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Dollar gain to target</div>
                <div className="mt-1 text-lg font-bold text-signal-buy">{dollarGain !== null ? fmtUsd(dollarGain) : '—'}</div>
                <div className="text-[10px] text-muted-foreground">
                  {targetPrice !== null ? `if it hits $${targetPrice.toFixed(2)} (${targetPct}% up)` : 'set a target %'}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              <span>Risk/reward ratio: <span className="font-semibold text-foreground">{riskRewardRatio !== null ? `1 : ${riskRewardRatio.toFixed(2)}` : '—'}</span></span>
              {tickSize !== null && multiplier !== null && <span>Tick value: <span className="font-semibold text-foreground">{fmtUsd(tickSize * multiplier)}</span> per contract</span>}
            </div>
            <p className="text-[10px] italic text-muted-foreground/70">
              This is arithmetic based on the numbers you entered and this contract's real exchange-defined multiplier —
              not a prediction the stop or target will be hit. Futures are leveraged: a relatively small price move can
              produce a large dollar gain or loss versus the margin actually posted, and this doesn't account for margin
              requirements, overnight/maintenance margin calls, or slippage in a fast market.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
