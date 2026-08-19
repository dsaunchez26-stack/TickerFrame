import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { OptionRow } from '@/lib/optionsMockData';
import { TrackButton } from '@/components/options/TrackButton';
import { useStockDetail } from '@/context/StockDetailContext';

interface Props {
  rows: OptionRow[];
  leapsRows: OptionRow[];
  onTrack: (row: OptionRow, portfolioName: string | null) => void;
  trackedIds: Set<string>;
}

const daysToExpiry = (r: OptionRow) => Math.max(1, (new Date(r.expiration).getTime() - Date.now()) / 86400_000);
// Raw yield (premium / strike) isn't comparable across different-length
// contracts -- an 11-month LEAPS will always show a bigger raw number than a
// 30-day put even when the 30-day one is the better annualized return.
// Annualizing puts every term on the same footing.
const annualizedYield = (r: OptionRow) => (r.price / r.strike) * (365 / daysToExpiry(r)) * 100;

const MAX_PER_TICKER = 2;

// A cash-secured put's thesis is "the stock stays flat or rises" -- a
// bullish or consolidating chart supports that; a fresh breakdown or bear
// flag argues against it, independent of how attractive the yield looks.
const CSP_FAVORABLE = new Set(['breakout', 'bull_flag', 'consolidation']);
const CSP_UNFAVORABLE = new Set(['breakdown', 'bear_flag']);
function patternAgreement(r: OptionRow): number {
  if (!r.pattern) return 0;
  if (CSP_FAVORABLE.has(r.pattern)) return 1;
  if (CSP_UNFAVORABLE.has(r.pattern)) return -1;
  return 0;
}

const IV_RV_HIGH = 1.15;
const IV_RV_LOW = 0.85;

// When current IV is running well above the stock's own realized
// volatility, premium is rich relative to what the stock is actually
// doing -- a shorter duration captures that richness via faster theta
// decay before it's likely to mean-revert. When IV is running well below
// realized vol, premium is comparatively cheap, so a longer duration
// collects more total premium before needing to be rolled rather than
// repeatedly re-entering at a discount. Near-parity (or no realized-vol
// estimate yet) doesn't favor either term.
function termAgreement(r: OptionRow): number {
  const ratio = r.ivRvRatio;
  if (ratio === null || ratio === undefined) return 0;
  if (ratio >= IV_RV_HIGH) return r.type === 'Weekly' ? 1 : r.type === 'Monthly' ? -1 : 0;
  if (ratio <= IV_RV_LOW) return r.type === 'Monthly' ? 1 : r.type === 'Weekly' ? -1 : 0;
  return 0;
}

function pickBest(pool: OptionRow[], count: number) {
  const sorted = [...pool].sort((a, b) => {
    // "Beyond" the expected move (safer) is prioritized ahead of "Within"
    // (riskier) before yield is even considered -- a higher yield inside
    // the stock's normal range of movement isn't automatically "better,"
    // it's usually just pricing in the extra assignment risk.
    const aBeyond = a.withinExpectedMove === false ? 1 : 0;
    const bBeyond = b.withinExpectedMove === false ? 1 : 0;
    if (aBeyond !== bBeyond) return bBeyond - aBeyond;
    const patternDiff = patternAgreement(b) - patternAgreement(a);
    if (patternDiff !== 0) return patternDiff;
    const termDiff = termAgreement(b) - termAgreement(a);
    if (termDiff !== 0) return termDiff;
    return annualizedYield(b) - annualizedYield(a);
  });
  // A single ticker with many strikes near the delta band could otherwise
  // fill every slot -- capping per-ticker keeps this an actual
  // cross-section of tickers rather than one stock's strike ladder.
  const perTicker = new Map<string, number>();
  const out: OptionRow[] = [];
  for (const r of sorted) {
    const used = perTicker.get(r.ticker) ?? 0;
    if (used >= MAX_PER_TICKER) continue;
    out.push(r);
    perTicker.set(r.ticker, used + 1);
    if (out.length >= count) break;
  }
  return out;
}

const Row = ({ r, tracked, onTrack }: { r: OptionRow; tracked: boolean; onTrack: (portfolioName: string | null) => void }) => {
  const { open } = useStockDetail();
  return (
  <tr className="border-b last:border-0">
    <td className="py-2 pr-3">
      <button onClick={() => open(r.ticker)} className="font-semibold hover:text-primary hover:underline">{r.ticker}</button>
    </td>
    <td className="py-2 pr-3 text-muted-foreground">
      {r.type}
      {r.ivRvRatio != null && (
        <span className="ml-1 text-[10px]" title="Current IV vs. this stock's realized volatility -- above 1x means options premium is pricing in more movement than the stock has actually been making.">
          · IV/RV {r.ivRvRatio.toFixed(1)}x
        </span>
      )}
    </td>
    <td className="py-2 pr-3">${r.strike}</td>
    <td className="py-2 pr-3">${r.stockPrice.toFixed(2)}</td>
    <td className="py-2 pr-3">${r.price.toFixed(2)}</td>
    <td className="py-2 pr-3 text-muted-foreground">${r.bid.toFixed(2)} / ${r.ask.toFixed(2)}</td>
    <td className="py-2 pr-3">
      <span className="text-signal-buy">{annualizedYield(r).toFixed(1)}%/yr</span>
      <span className="text-muted-foreground"> · {((r.price / r.strike) * 100).toFixed(2)}% total</span>
    </td>
    <td className="py-2 pr-3">{((1 - Math.abs(r.delta)) * 100).toFixed(0)}%</td>
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
    <td className="py-2 pr-3">
      <TrackButton tracked={tracked} onTrack={onTrack} />
    </td>
  </tr>
  );
};

const HEADER = (
  <tr>
    <th className="py-2 pr-3">Ticker</th>
    <th className="py-2 pr-3">Term</th>
    <th className="py-2 pr-3">Strike</th>
    <th className="py-2 pr-3">Stock</th>
    <th className="py-2 pr-3">Premium</th>
    <th className="py-2 pr-3">Bid / Ask</th>
    <th className="py-2 pr-3">Yield (ann. · total)</th>
    <th className="py-2 pr-3">Est. OTM</th>
    <th className="py-2 pr-3">vs Expected Move</th>
    <th className="py-2 pr-3">Exp</th>
    <th className="py-2 pr-3" />
  </tr>
);

export const CashSecuredPuts = ({ rows, leapsRows, onTrack, trackedIds }: Props) => {
  const nearTerm = useMemo(() => {
    const pool = rows.filter(r => r.cp === 'P' && r.delta >= -0.35 && r.delta <= -0.10 && r.strike < r.stockPrice);
    return pickBest(pool, 5);
  }, [rows]);

  const leaps = useMemo(() => {
    const pool = leapsRows.filter(r => r.cp === 'P' && r.delta >= -0.35 && r.delta <= -0.10 && r.strike < r.stockPrice);
    return pickBest(pool, 5);
  }, [leapsRows]);

  if (!nearTerm.length && !leaps.length) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">Cash-Secured Put Candidates</CardTitle>
        <p className="text-[10px] text-muted-foreground">
          Sell a put below spot, collect the premium. If the stock stays above your strike, it expires worthless and you keep it all;
          if it breaks below, you're obligated to buy at the strike. "Est. OTM" is delta-based, not a guarantee — real crashes and
          gaps happen even on stocks that "never" move. "vs Expected Move" compares this strike to the stock's own 1-standard-deviation
          move priced into the options chain (roughly a 68% chance of finishing inside that range by expiration) — "Beyond" means the
          stock would need a bigger-than-typical move to reach your strike, not that it can't happen. Both lists below prioritize
          "Beyond" candidates first, then rank by annualized yield so a short-dated and a LEAPS contract can be compared fairly.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {nearTerm.length > 0 && (
          <div>
            <div className="mb-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">Weekly / Monthly</div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="border-b text-left text-muted-foreground">{HEADER}</thead>
                <tbody>
                  {nearTerm.map(r => (
                    <Row key={r.id} r={r} tracked={trackedIds.has(r.id)} onTrack={(portfolioName) => onTrack(r, portfolioName)} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {leaps.length > 0 && (
          <div>
            <div className="mb-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">LEAPS</div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="border-b text-left text-muted-foreground">{HEADER}</thead>
                <tbody>
                  {leaps.map(r => (
                    <Row key={r.id} r={r} tracked={trackedIds.has(r.id)} onTrack={(portfolioName) => onTrack(r, portfolioName)} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
