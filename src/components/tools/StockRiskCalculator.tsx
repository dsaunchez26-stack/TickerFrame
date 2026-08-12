import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const fmtUsd = (v: number) => v.toLocaleString(undefined, { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const StockRiskCalculator = () => {
  const [ticker, setTicker] = useState('');
  const [loading, setLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [spot, setSpot] = useState<number | null>(null);

  const [entryPrice, setEntryPrice] = useState('');
  const [investment, setInvestment] = useState('1000');
  const [stopLossPct, setStopLossPct] = useState('8');
  const [targetPct, setTargetPct] = useState('20');

  const lookup = async () => {
    const sym = ticker.trim().toUpperCase();
    if (!sym) return;
    setLoading(true);
    setLookupError(null);
    const { data, error } = await supabase.functions.invoke('fetch-portfolio-quotes', { body: { symbols: [sym] } });
    setLoading(false);
    const price = data?.quotes?.[sym]?.price;
    if (error || typeof price !== 'number') {
      setLookupError(error?.message || `No quote found for ${sym}. Check the ticker and try again.`);
      setSpot(null);
      return;
    }
    setSpot(price);
    setEntryPrice(price.toFixed(2));
  };

  const entry = parseFloat(entryPrice);
  const invested = parseFloat(investment);
  const stopPct = parseFloat(stopLossPct);
  const gainPct = parseFloat(targetPct);
  const valid = entry > 0 && invested > 0;

  const shares = valid ? invested / entry : 0;
  const stopPrice = valid && !isNaN(stopPct) ? entry * (1 - stopPct / 100) : null;
  const targetPrice = valid && !isNaN(gainPct) ? entry * (1 + gainPct / 100) : null;
  const dollarRisk = valid && stopPrice !== null ? shares * (entry - stopPrice) : null;
  const dollarGain = valid && targetPrice !== null ? shares * (targetPrice - entry) : null;
  const riskRewardRatio = dollarRisk && dollarGain && dollarRisk > 0 ? dollarGain / dollarRisk : null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-sm font-semibold">1. Pick a stock</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={ticker}
              onChange={e => setTicker(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && lookup()}
              placeholder="Ticker, e.g. KMB"
              className="h-9 max-w-40"
            />
            <Button size="sm" onClick={lookup} disabled={!ticker || loading}>
              {loading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Search className="mr-1 h-3.5 w-3.5" />}
              Get Price
            </Button>
          </div>
          {lookupError && <p className="text-xs text-signal-sell">{lookupError}</p>}
          {spot !== null && <p className="text-xs text-muted-foreground">Last price: <span className="font-semibold text-foreground">${spot.toFixed(2)}</span></p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm font-semibold">2. Set your position</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Entry price ($)</Label>
            <Input type="number" value={entryPrice} onChange={e => setEntryPrice(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Amount to invest ($)</Label>
            <Input type="number" value={investment} onChange={e => setInvestment(e.target.value)} className="h-9" />
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

      {valid && (
        <Card>
          <CardHeader><CardTitle className="text-sm font-semibold">3. The math</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-border p-3">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Shares at this price</div>
                <div className="mt-1 text-lg font-bold">{shares.toFixed(shares < 10 ? 3 : 1)}</div>
                <div className="text-[10px] text-muted-foreground">{fmtUsd(shares * entry)} deployed</div>
              </div>
              <div className="rounded-lg border border-signal-sell/30 bg-signal-sell/5 p-3">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Dollar risk to stop</div>
                <div className="mt-1 text-lg font-bold text-signal-sell">{dollarRisk !== null ? fmtUsd(dollarRisk) : '—'}</div>
                <div className="text-[10px] text-muted-foreground">
                  {stopPrice !== null ? `if it hits $${stopPrice.toFixed(2)} (${stopLossPct}% down)` : 'set a stop-loss %'}
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
              <span>Worst case (stock to $0): <span className="font-semibold text-foreground">{fmtUsd(shares * entry)}</span> (100% of this position)</span>
            </div>
            <p className="text-[10px] italic text-muted-foreground/70">
              This is arithmetic based on the numbers you entered, not a prediction that the stop or target will actually
              be hit. A stop-loss order can also fill below your stop price in a fast-moving market (slippage/gaps),
              so the dollar risk shown is an estimate, not a guarantee.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
