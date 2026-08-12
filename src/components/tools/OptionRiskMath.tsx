import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EarningsBadge } from '@/components/EarningsBadge';
import { useEarningsCalendar } from '@/hooks/useEarningsCalendar';

const fmtUsd = (v: number) => v.toLocaleString(undefined, { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Target-price scenarios (% move from spot) shown in the payoff table --
// covers both directions since a long put profits on the down side.
const SCENARIO_MOVES = [-40, -30, -20, -10, -5, 0, 5, 10, 20, 30, 50];

interface Props {
  ticker: string;
  cp: 'C' | 'P';
  strike: number;
  spot: number;
  premium: number;
  expiration: string;
  /** Card section titles -- callers embedding this inline (with their own
   * "1. Pick a contract" step before it) vs. in a standalone popup want
   * different framing. */
  titles?: { position: string; math: string };
}

// Shared by the full Risk Calculator page (after a manual chain lookup) and
// the per-row popup opened directly from an options table -- both already
// know ticker/strike/premium/spot by the time this renders, so this only
// owns the "how much to invest" input and the resulting risk/payoff math.
export const OptionRiskMath = ({ ticker, cp, strike, spot, premium, expiration, titles }: Props) => {
  const { earningsBySymbol } = useEarningsCalendar();
  const earnings = earningsBySymbol.get(ticker);
  const [investment, setInvestment] = useState('1000');

  const invested = parseFloat(investment);
  const contracts = premium > 0 && invested > 0 ? Math.floor(invested / (premium * 100)) : 0;
  const actualCost = contracts * premium * 100;

  const dte = Math.max(1, Math.round((new Date(expiration).getTime() - Date.now()) / 86400_000));
  const breakeven = cp === 'C' ? strike + premium : strike - premium;
  const breakevenMovePct = spot > 0 ? ((breakeven - spot) / spot) * 100 : null;

  const scenarios = useMemo(() => {
    if (contracts <= 0) return [];
    return SCENARIO_MOVES.map(pct => {
      const targetPrice = spot * (1 + pct / 100);
      const intrinsic = cp === 'C' ? Math.max(0, targetPrice - strike) : Math.max(0, strike - targetPrice);
      const totalValue = intrinsic * 100 * contracts;
      const profit = totalValue - actualCost;
      return { pct, targetPrice, profit, profitPct: actualCost > 0 ? (profit / actualCost) * 100 : 0 };
    });
  }, [contracts, actualCost, spot, strike, cp]);

  return (
    <div className="space-y-4">
      <EarningsBadge earnings={earnings} referenceDate={expiration} size="sm" />
      <Card>
        <CardHeader><CardTitle className="text-sm font-semibold">{titles?.position ?? 'Set your position'}</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Amount to invest ($)</Label>
            <Input type="number" value={investment} onChange={e => setInvestment(e.target.value)} className="h-9" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{ticker} {strike}{cp} · premium used</Label>
            <Input value={`$${premium.toFixed(2)} × 100 per contract`} readOnly className="h-9 bg-muted/40" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm font-semibold">{titles?.math ?? 'The math'}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {contracts <= 0 ? (
            <p className="text-xs text-signal-sell">
              That investment amount doesn't cover even one contract (${(premium * 100).toFixed(2)} each). Increase the amount to see the breakdown.
            </p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="rounded-lg border border-border p-3">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Contracts</div>
                  <div className="mt-1 text-lg font-bold">{contracts}</div>
                  <div className="text-[10px] text-muted-foreground">{fmtUsd(actualCost)} actual cost</div>
                </div>
                <div className="rounded-lg border border-signal-sell/30 bg-signal-sell/5 p-3">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Max loss</div>
                  <div className="mt-1 text-lg font-bold text-signal-sell">{fmtUsd(actualCost)}</div>
                  <div className="text-[10px] text-muted-foreground">100% if worthless at expiration</div>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Breakeven</div>
                  <div className="mt-1 text-lg font-bold">${breakeven.toFixed(2)}</div>
                  <div className="text-[10px] text-muted-foreground">{breakevenMovePct !== null ? `${breakevenMovePct >= 0 ? '+' : ''}${breakevenMovePct.toFixed(1)}% from spot` : '—'}</div>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Days to expiration</div>
                  <div className="mt-1 text-lg font-bold">{dte}</div>
                  <div className="text-[10px] text-muted-foreground">{expiration}</div>
                </div>
              </div>

              <div>
                <div className="mb-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">Profit/loss at expiration by stock price</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="border-b text-left text-muted-foreground">
                      <tr>
                        <th className="py-1.5 pr-3">Stock move</th>
                        <th className="py-1.5 pr-3">Stock price</th>
                        <th className="py-1.5 pr-3">P/L</th>
                        <th className="py-1.5 pr-3">P/L %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scenarios.map(s => (
                        <tr key={s.pct} className={`border-b last:border-0 ${s.pct === 0 ? 'bg-secondary/20' : ''}`}>
                          <td className="py-1.5 pr-3">{s.pct >= 0 ? '+' : ''}{s.pct}%</td>
                          <td className="py-1.5 pr-3">${s.targetPrice.toFixed(2)}</td>
                          <td className={`py-1.5 pr-3 font-semibold ${s.profit >= 0 ? 'text-signal-buy' : 'text-signal-sell'}`}>
                            {s.profit >= 0 ? '+' : ''}{fmtUsd(s.profit)}
                          </td>
                          <td className={`py-1.5 pr-3 ${s.profit >= 0 ? 'text-signal-buy' : 'text-signal-sell'}`}>
                            {s.profitPct >= 0 ? '+' : ''}{s.profitPct.toFixed(0)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <p className="text-[10px] italic text-muted-foreground/70">
                Assumes the contracts are held to expiration and the stock lands exactly at each scenario price — real
                option prices before expiration also move with time decay and implied volatility, not just the stock
                price. "Stock move" is relative to the current spot price, not a prediction of where it's headed.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
