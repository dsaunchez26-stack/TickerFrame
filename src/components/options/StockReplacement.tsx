import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DiagonalRow } from '@/lib/spreads';
import { useStockDetail } from '@/context/StockDetailContext';

interface Props {
  diagonals: DiagonalRow[];
}

const MAX_PER_TICKER = 2;

function pickBest(pool: DiagonalRow[], count: number) {
  const sorted = [...pool].sort((a, b) => {
    const aBeyond = a.withinExpectedMove === false ? 1 : 0;
    const bBeyond = b.withinExpectedMove === false ? 1 : 0;
    if (aBeyond !== bBeyond) return bBeyond - aBeyond;
    return (b.maxGainApprox / b.netDebit) - (a.maxGainApprox / a.netDebit);
  });
  // A single high-priced ticker (more strike increments to combine) can
  // otherwise fill every slot with near-duplicate variations of the same
  // long leg -- capping per-ticker keeps this an actual cross-section of
  // opportunities instead of one stock's strike ladder.
  const perTicker = new Map<string, number>();
  const out: DiagonalRow[] = [];
  for (const r of sorted) {
    const used = perTicker.get(r.ticker) ?? 0;
    if (used >= MAX_PER_TICKER) continue;
    out.push(r);
    perTicker.set(r.ticker, used + 1);
    if (out.length >= count) break;
  }
  return out;
}

const Row = ({ r }: { r: DiagonalRow }) => {
  const { open } = useStockDetail();
  return (
  <tr className="border-b last:border-0">
    <td className="py-2 pr-3">
      <button onClick={() => open(r.ticker)} className="font-semibold hover:text-primary hover:underline">{r.ticker}</button>
    </td>
    <td className="py-2 pr-3">${r.stockPrice.toFixed(2)}</td>
    <td className="py-2 pr-3">
      Long ${r.longStrike} <span className="text-muted-foreground">(Δ{r.longDelta.toFixed(2)}, {r.longExpiration})</span>
    </td>
    <td className="py-2 pr-3">
      Short ${r.shortStrike} <span className="text-muted-foreground">(Δ{r.shortDelta.toFixed(2)}, {r.shortExpiration})</span>
    </td>
    <td className="py-2 pr-3 text-signal-sell">${r.netDebit.toFixed(2)}</td>
    <td className="py-2 pr-3 text-muted-foreground">${r.maxGainApprox.toFixed(2)} approx.</td>
    <td className="py-2 pr-3">{((r.maxGainApprox / r.netDebit) * 100).toFixed(0)}%</td>
    <td className="py-2 pr-3">
      {r.withinExpectedMove === null || r.withinExpectedMove === undefined ? (
        <span className="text-muted-foreground">—</span>
      ) : r.withinExpectedMove ? (
        <span className="text-signal-hold">Within ±{r.expectedMovePct?.toFixed(1)}%</span>
      ) : (
        <span className="text-signal-buy">Beyond ±{r.expectedMovePct?.toFixed(1)}%</span>
      )}
    </td>
  </tr>
  );
};

const HEADER = (
  <tr>
    <th className="py-2 pr-3">Ticker</th>
    <th className="py-2 pr-3">Stock</th>
    <th className="py-2 pr-3">Long Leg (stock stand-in)</th>
    <th className="py-2 pr-3">Short Leg (income)</th>
    <th className="py-2 pr-3">Net Debit (max loss)</th>
    <th className="py-2 pr-3">Max Gain</th>
    <th className="py-2 pr-3">Return on Debit</th>
    <th className="py-2 pr-3">Short vs Expected Move</th>
  </tr>
);

export const StockReplacement = ({ diagonals }: Props) => {
  const calls = useMemo(() => pickBest(diagonals.filter(d => d.strategy === 'poor_mans_covered_call'), 5), [diagonals]);
  const puts = useMemo(() => pickBest(diagonals.filter(d => d.strategy === 'poor_mans_cash_secured_put'), 5), [diagonals]);

  if (!calls.length && !puts.length) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">Stock Replacement (Poor Man's Covered Call / Put)</CardTitle>
        <p className="text-[10px] text-muted-foreground">
          A deep-in-the-money LEAPS option (the "Long Leg") stands in for owning 100 shares — it moves almost dollar-for-dollar with
          the stock but costs a fraction of the capital. A near-term, out-of-the-money option (the "Short Leg") is sold against it for
          income, same idea as a covered call or cash-secured put. Unlike a naked position, the max loss here is capped at the "Net
          Debit" — what you paid to enter — because the long leg can only ever lose what you paid for it, and there's no naked side.
          "Max Gain" is an approximation (roughly the value if the stock sits at the short strike when it expires), not a full pricing
          model — the long leg still carries real time value that isn't modeled precisely here.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {calls.length > 0 && (
          <div>
            <div className="mb-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">Poor Man's Covered Call</div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="border-b text-left text-muted-foreground">{HEADER}</thead>
                <tbody>{calls.map(r => <Row key={r.id} r={r} />)}</tbody>
              </table>
            </div>
          </div>
        )}
        {puts.length > 0 && (
          <div>
            <div className="mb-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">Poor Man's Cash-Secured Put</div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="border-b text-left text-muted-foreground">{HEADER}</thead>
                <tbody>{puts.map(r => <Row key={r.id} r={r} />)}</tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
