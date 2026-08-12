import { useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CheckCircle2, XCircle, MinusCircle } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';
import { broadSector } from '@/lib/sectorMapping';
import { computeSectorBenchmarks } from '@/lib/sectorRelativeValuation';

type FundamentalsRow = Database['public']['Tables']['stock_fundamentals']['Row'];
interface EpsQuarter { period: string; actual: number; estimate: number; surprisePct: number }

interface Props {
  row: FundamentalsRow | null;
  allRows: FundamentalsRow[];
  onClose: () => void;
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

// market_cap is stored in millions of dollars (Finnhub's own unit).
function fmtMarketCap(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}T`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}B`;
  return `$${v.toFixed(0)}M`;
}

// Where this stock's raw number ranks against every other scanned stock that
// has a value for the same metric -- real peer comparison, not a guess.
function percentileRank(allRows: FundamentalsRow[], key: keyof FundamentalsRow, value: number | null, higherIsBetter: boolean): number | null {
  if (value === null) return null;
  const values = allRows.map(r => r[key]).filter((v): v is number => typeof v === 'number');
  if (values.length < 2) return null;
  const better = values.filter(v => (higherIsBetter ? v < value : v > value)).length;
  return Math.round((better / values.length) * 100);
}

const factorRow = (label: string, raw: string, pct: number | null, count: number) => (
  <div className="flex items-center justify-between rounded-md border border-border/40 px-3 py-2 text-xs">
    <div>
      <div className="font-semibold">{label}</div>
      <div className="text-muted-foreground">{raw}</div>
    </div>
    <div className="text-right">
      {pct === null ? (
        <span className="text-muted-foreground">no peer data</span>
      ) : (
        <span className={pct >= 60 ? 'text-signal-buy' : pct <= 40 ? 'text-signal-sell' : 'text-signal-hold'}>
          better than {pct}% of {count} scanned
        </span>
      )}
    </div>
  </div>
);

export const ValueRadarDetail = ({ row, allRows, onClose }: Props) => {
  const stats = useMemo(() => {
    if (!row) return null;
    const peerCount = allRows.length;
    const debtPct = percentileRank(allRows, 'debt_to_equity', row.debt_to_equity, false);
    const currentPct = percentileRank(allRows, 'current_ratio', row.current_ratio, true);
    const marginPct = percentileRank(allRows, 'net_margin', row.net_margin, true);
    const revGrowthPct = percentileRank(allRows, 'revenue_growth_yoy', row.revenue_growth_yoy, true);
    const epsGrowthPct = percentileRank(allRows, 'eps_growth_yoy', row.eps_growth_yoy, true);
    const surprisePct = percentileRank(allRows, 'avg_eps_surprise_pct', row.avg_eps_surprise_pct, true);

    // Recompute the same sub-scores the scanner used, so the breakdown here
    // always matches the score shown in the table.
    const bsParts: number[] = [];
    if (row.debt_to_equity !== null) bsParts.push(clamp(100 - row.debt_to_equity * 40, 0, 100));
    if (row.current_ratio !== null) bsParts.push(clamp((row.current_ratio / 2) * 100, 0, 100));
    if (row.net_margin !== null) bsParts.push(clamp(50 + row.net_margin * 2.5, 0, 100));

    const gParts: number[] = [];
    if (row.revenue_growth_yoy !== null) gParts.push(clamp(50 + row.revenue_growth_yoy * 2.5, 0, 100));
    if (row.eps_growth_yoy !== null) gParts.push(clamp(50 + row.eps_growth_yoy * 1.5, 0, 100));
    if (row.avg_eps_surprise_pct !== null) gParts.push(clamp(50 + row.avg_eps_surprise_pct * 4, 0, 100));

    const epsHistory = (Array.isArray(row.eps_surprise_history) ? row.eps_surprise_history : []) as unknown as EpsQuarter[];

    const sector = broadSector(row.symbol, row.sector);
    const benchmark = computeSectorBenchmarks(allRows).get(sector);

    return {
      peerCount, debtPct, currentPct, marginPct, revGrowthPct, epsGrowthPct, surprisePct, epsHistory,
      sector, sectorMedianPE: benchmark?.medianPE ?? null, sectorMedianPB: benchmark?.medianPB ?? null, sectorMedianPS: benchmark?.medianPS ?? null,
    };
  }, [row, allRows]);

  return (
    <Dialog open={!!row} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        {row && stats && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <span>{row.symbol}</span>
                <span className="text-sm font-normal text-muted-foreground">${row.price.toFixed(2)}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {stats.sector && `${stats.sector} · `}
                  {row.dividend_yield !== null && `Yield ${row.dividend_yield.toFixed(2)}% · `}
                  {row.pe_ratio !== null && `P/E ${row.pe_ratio.toFixed(1)}${stats.sectorMedianPE !== null ? ` (sector ${stats.sectorMedianPE.toFixed(1)})` : ''} · `}
                  {row.pb_ratio !== null && `P/B ${row.pb_ratio.toFixed(2)}${stats.sectorMedianPB !== null ? ` (sector ${stats.sectorMedianPB.toFixed(2)})` : ''} · `}
                  {row.ps_ratio !== null && `P/S ${row.ps_ratio.toFixed(2)}x${stats.sectorMedianPS !== null ? ` (sector ${stats.sectorMedianPS.toFixed(2)}x)` : ''}`}
                  {row.market_cap !== null && ` · ${fmtMarketCap(row.market_cap)} cap`}
                </span>
              </DialogTitle>
            </DialogHeader>

            <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2.5 text-[11px] text-amber-200/90">
              Everything below reflects {row.name}'s most recently reported financials, compared against the other {stats.peerCount} stocks
              this scan tracks. It is not a projection of future earnings or price, and not a recommendation to buy or sell.
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border p-3 text-center">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Balance Sheet Strength</div>
                <div className="font-heading text-2xl font-bold">{row.balance_sheet_score}<span className="text-xs text-muted-foreground">/100</span></div>
              </div>
              <div className="rounded-lg border border-border p-3 text-center">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Growth & Momentum</div>
                <div className="font-heading text-2xl font-bold">{row.growth_score}<span className="text-xs text-muted-foreground">/100</span></div>
              </div>
            </div>

            <div>
              <div className="mb-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">Balance sheet — what's behind the score</div>
              <div className="space-y-1.5">
                {factorRow('Debt / Equity (lower is safer)', row.debt_to_equity === null ? 'not reported' : row.debt_to_equity.toFixed(2), stats.debtPct, stats.peerCount)}
                {factorRow('Current Ratio (higher is safer)', row.current_ratio === null ? 'not reported' : row.current_ratio.toFixed(2), stats.currentPct, stats.peerCount)}
                {factorRow('Net Margin', row.net_margin === null ? 'not reported' : `${row.net_margin.toFixed(1)}%`, stats.marginPct, stats.peerCount)}
              </div>
            </div>

            <div>
              <div className="mb-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">Growth — what's behind the score</div>
              <div className="space-y-1.5">
                {factorRow('Revenue Growth YoY', row.revenue_growth_yoy === null ? 'not reported' : `${row.revenue_growth_yoy.toFixed(1)}%`, stats.revGrowthPct, stats.peerCount)}
                {factorRow('EPS Growth YoY', row.eps_growth_yoy === null ? 'not reported' : `${row.eps_growth_yoy.toFixed(1)}%`, stats.epsGrowthPct, stats.peerCount)}
                {factorRow('Avg. Earnings Surprise (last 4Q)', row.avg_eps_surprise_pct === null ? 'not reported' : `${row.avg_eps_surprise_pct.toFixed(1)}%`, stats.surprisePct, stats.peerCount)}
              </div>
            </div>

            {stats.epsHistory.length > 0 && (
              <div>
                <div className="mb-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">Last {stats.epsHistory.length} quarters: actual vs. estimate EPS</div>
                <div className="space-y-1">
                  {stats.epsHistory.map((q, i) => {
                    const beat = q.surprisePct > 1;
                    const miss = q.surprisePct < -1;
                    return (
                      <div key={i} className="flex items-center justify-between rounded-md border border-border/40 px-3 py-1.5 text-xs">
                        <span className="text-muted-foreground">{q.period}</span>
                        <span>${q.actual.toFixed(2)} actual vs ${q.estimate.toFixed(2)} est.</span>
                        <span className={`flex items-center gap-1 font-semibold ${beat ? 'text-signal-buy' : miss ? 'text-signal-sell' : 'text-muted-foreground'}`}>
                          {beat ? <CheckCircle2 className="h-3 w-3" /> : miss ? <XCircle className="h-3 w-3" /> : <MinusCircle className="h-3 w-3" />}
                          {q.surprisePct >= 0 ? '+' : ''}{q.surprisePct.toFixed(1)}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <p className="text-[10px] italic text-muted-foreground/70">
              52-week range: {row.week52_low && row.week52_high ? `$${row.week52_low.toFixed(2)} – $${row.week52_high.toFixed(2)}` : 'not reported'}.
              Balance Sheet and Growth scores are each an average of only the factors above that this company actually reports —
              a missing figure is left out, not guessed at. Data updates a few times a day.
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
