import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { CreditSpreadRow } from '@/lib/spreads';
import { useStockDetail } from '@/context/StockDetailContext';

interface Props {
  spreads: CreditSpreadRow[];
}

const daysToExpiry = (r: CreditSpreadRow) => Math.max(1, (new Date(r.expiration).getTime() - Date.now()) / 86400_000);
// Same fairness fix as the covered-call/cash-secured-put screeners: a 30-day
// spread and an 11-month LEAPS spread aren't comparable on raw return alone.
const annualizedRor = (r: CreditSpreadRow) => r.returnOnRisk * (365 / daysToExpiry(r));

const MAX_PER_TICKER = 2;

function pickBest(pool: CreditSpreadRow[], count: number) {
  const sorted = [...pool].sort((a, b) => {
    const aBeyond = a.withinExpectedMove === false ? 1 : 0;
    const bBeyond = b.withinExpectedMove === false ? 1 : 0;
    if (aBeyond !== bBeyond) return bBeyond - aBeyond;
    return annualizedRor(b) - annualizedRor(a);
  });
  // A single high-priced ticker (more strike increments to combine) can
  // otherwise fill every slot with near-duplicate variations of the same
  // short strike -- capping per-ticker keeps this an actual cross-section
  // of tickers instead of one stock's strike ladder.
  const perTicker = new Map<string, number>();
  const out: CreditSpreadRow[] = [];
  for (const r of sorted) {
    const used = perTicker.get(r.ticker) ?? 0;
    if (used >= MAX_PER_TICKER) continue;
    out.push(r);
    perTicker.set(r.ticker, used + 1);
    if (out.length >= count) break;
  }
  return out;
}

const Row = ({ r }: { r: CreditSpreadRow }) => {
  const { open } = useStockDetail();
  return (
  <tr className="border-b last:border-0">
    <td className="py-2 pr-3">
      <button onClick={() => open(r.ticker)} className="font-semibold hover:text-primary hover:underline">{r.ticker}</button>
    </td>
    <td className="py-2 pr-3 text-muted-foreground">{r.term}</td>
    <td className="py-2 pr-3">${r.stockPrice.toFixed(2)}</td>
    <td className="py-2 pr-3">Sell ${r.shortStrike} / Buy ${r.longStrike}</td>
    <td className="py-2 pr-3 text-signal-buy">${r.netCredit.toFixed(2)}</td>
    <td className="py-2 pr-3 text-signal-sell">${r.maxLoss.toFixed(2)}</td>
    <td className="py-2 pr-3">
      <span className="text-signal-buy">{annualizedRor(r).toFixed(0)}%/yr</span>
      <span className="text-muted-foreground"> · {r.returnOnRisk.toFixed(0)}% total</span>
    </td>
    <td className="py-2 pr-3">
      {r.withinExpectedMove === null || r.withinExpectedMove === undefined ? (
        <span className="text-muted-foreground">—</span>
      ) : r.withinExpectedMove ? (
        <span className="text-signal-hold">Within ±{r.expectedMovePct?.toFixed(1)}%</span>
      ) : (
        <span className="text-signal-buy">Beyond ±{r.expectedMovePct?.toFixed(1)}%</span>
      )}
    </td>
    <td className="py-2 pr-3">{r.expiration}</td>
  </tr>
  );
};

const HEADER = (
  <tr>
    <th className="py-2 pr-3">Ticker</th>
    <th className="py-2 pr-3">Term</th>
    <th className="py-2 pr-3">Stock</th>
    <th className="py-2 pr-3">Legs</th>
    <th className="py-2 pr-3">Net Credit</th>
    <th className="py-2 pr-3">Max Loss</th>
    <th className="py-2 pr-3">Return on Risk (ann. · total)</th>
    <th className="py-2 pr-3">vs Expected Move</th>
    <th className="py-2 pr-3">Exp</th>
  </tr>
);

export const CreditSpreads = ({ spreads }: Props) => {
  const callNear = useMemo(() => pickBest(spreads.filter(s => s.strategy === 'call_credit_spread' && s.term !== 'LEAPS'), 5), [spreads]);
  const callLeaps = useMemo(() => pickBest(spreads.filter(s => s.strategy === 'call_credit_spread' && s.term === 'LEAPS'), 5), [spreads]);
  const putNear = useMemo(() => pickBest(spreads.filter(s => s.strategy === 'put_credit_spread' && s.term !== 'LEAPS'), 5), [spreads]);
  const putLeaps = useMemo(() => pickBest(spreads.filter(s => s.strategy === 'put_credit_spread' && s.term === 'LEAPS'), 5), [spreads]);

  if (!callNear.length && !callLeaps.length && !putNear.length && !putLeaps.length) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">Credit Spreads (Defined Risk)</CardTitle>
        <p className="text-[10px] text-muted-foreground">
          The capped-risk version of selling a naked option: sell one strike and buy a further-out strike in the same expiration as
          protection. Max loss is fixed at the strike width minus the credit collected — no matter how far the stock moves, this can
          never lose more than "Max Loss" shows. A bear call spread profits if the stock stays below the short strike; a bull put
          spread profits if it stays above. "vs Expected Move" and the Beyond/Within logic work exactly like the single-leg screeners:
          "Beyond" means the short strike sits outside the stock's own 1-standard-deviation expected move.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {(callNear.length > 0 || callLeaps.length > 0) && (
          <div>
            <div className="mb-1.5 text-xs font-semibold">Bear Call Spreads</div>
            {callNear.length > 0 && (
              <div className="mb-3">
                <div className="mb-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">Weekly / Monthly</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="border-b text-left text-muted-foreground">{HEADER}</thead>
                    <tbody>{callNear.map(r => <Row key={r.id} r={r} />)}</tbody>
                  </table>
                </div>
              </div>
            )}
            {callLeaps.length > 0 && (
              <div>
                <div className="mb-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">LEAPS</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="border-b text-left text-muted-foreground">{HEADER}</thead>
                    <tbody>{callLeaps.map(r => <Row key={r.id} r={r} />)}</tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
        {(putNear.length > 0 || putLeaps.length > 0) && (
          <div>
            <div className="mb-1.5 text-xs font-semibold">Bull Put Spreads</div>
            {putNear.length > 0 && (
              <div className="mb-3">
                <div className="mb-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">Weekly / Monthly</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="border-b text-left text-muted-foreground">{HEADER}</thead>
                    <tbody>{putNear.map(r => <Row key={r.id} r={r} />)}</tbody>
                  </table>
                </div>
              </div>
            )}
            {putLeaps.length > 0 && (
              <div>
                <div className="mb-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">LEAPS</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="border-b text-left text-muted-foreground">{HEADER}</thead>
                    <tbody>{putLeaps.map(r => <Row key={r.id} r={r} />)}</tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
