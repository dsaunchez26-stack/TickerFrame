import { useMemo, useState } from 'react';
import { Loader2, Shield, TrendingUp, DollarSign } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Disclaimer } from '@/components/Disclaimer';
import { ValueRadarDetail } from '@/components/ValueRadarDetail';
import { ValueRadarPageHeader } from '@/components/ValueRadarPageHeader';
import { useValueRadar } from '@/context/ValueRadarContext';
import type { Database } from '@/integrations/supabase/types';

type FundamentalsRow = Database['public']['Tables']['stock_fundamentals']['Row'];

const fmtPct = (v: number | null, digits = 1) => (v === null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(digits)}%`);
const scoreColor = (score: number) => (score >= 65 ? 'text-signal-buy' : score >= 40 ? 'text-signal-hold' : 'text-signal-sell');
const fmtMarketCap = (v: number | null) => {
  if (v === null) return '—';
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}T`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}B`;
  return `$${v.toFixed(0)}M`;
};

// Converts P/S into the same 0-100 scale as balance_sheet_score/growth_score
// so it can be blended into one composite ranking rather than only used as a
// pass/fail gate. Calibrated so the 0.5-2x slider range lands roughly in the
// 40-85 band -- cheaper still scores higher, but doesn't dominate the other
// two factors the way an unbounded ratio would.
const psToScore = (ps: number) => Math.max(0, Math.min(100, 100 - ps * 30));

const ValueRadarPriceToSales = () => {
  const { rows, loading, scanning, runScan } = useValueRadar();
  const [maxPS, setMaxPS] = useState(2);
  const [minBalancePS, setMinBalancePS] = useState(50);
  const [minGrowthPS, setMinGrowthPS] = useState(40);
  const [selected, setSelected] = useState<FundamentalsRow | null>(null);

  // Cheap relative to revenue is not the same thing as "good" -- a lot of
  // sub-2x-sales stocks are cheap because the business itself is declining
  // or structurally weak (a value trap), not because the market is
  // overlooking it. Gating on balance-sheet/growth quality is what separates
  // "cheap for a bad reason" from "cheap and still fundamentally sound";
  // ranking by a composite of all three (rather than P/S alone) is what
  // puts the single best combination -- cheap AND strong AND growing -- at
  // the top, instead of just whichever name is cheapest among qualifiers.
  const psValueCandidates = useMemo(
    () => rows
      .filter(r => r.ps_ratio !== null && r.ps_ratio > 0 && r.ps_ratio <= maxPS
        && r.balance_sheet_score >= minBalancePS && r.growth_score >= minGrowthPS)
      .map(r => ({ row: r, composite: (psToScore(r.ps_ratio!) + r.balance_sheet_score + r.growth_score) / 3 }))
      .sort((a, b) => b.composite - a.composite),
    [rows, maxPS, minBalancePS, minGrowthPS],
  );

  return (
    <div className="min-h-screen bg-background">
      <ValueRadarPageHeader
        title="Price-to-Sales Value Screen"
        subtitle="Stocks cheap relative to their own revenue, filtered to exclude cheap-for-a-bad-reason names, ranked by the best overall combination of price, balance sheet, and growth."
        scanning={scanning}
        onRefresh={runScan}
      />
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        <Disclaimer />
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-200/90">
          <strong className="text-amber-300">A low Price/Sales ratio is not automatically "undervalued."</strong>{' '}
          Revenue multiples compress for real reasons — shrinking sales, collapsing margins, a dying business model. This
          screen requires the same balance-sheet and growth quality gates as the main Quality Screen specifically to
          exclude those cases, but it can't catch everything: a business can look statistically fine here and still be
          walking into a real problem the numbers haven't shown up in yet. This ranks by objective, reported financials —
          it is not a forecast or a recommendation.
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Price-to-Sales Filters</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6 sm:grid-cols-3">
            <div>
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="flex items-center gap-1 text-muted-foreground"><DollarSign className="h-3 w-3" /> Max Price/Sales</span>
                <span className="font-semibold">{maxPS.toFixed(1)}x</span>
              </div>
              <Slider value={[maxPS]} onValueChange={([v]) => setMaxPS(v)} min={0.5} max={10} step={0.5} />
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="flex items-center gap-1 text-muted-foreground"><Shield className="h-3 w-3" /> Min balance sheet strength</span>
                <span className="font-semibold">{minBalancePS}</span>
              </div>
              <Slider value={[minBalancePS]} onValueChange={([v]) => setMinBalancePS(v)} max={100} step={5} />
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="flex items-center gap-1 text-muted-foreground"><TrendingUp className="h-3 w-3" /> Min growth & momentum</span>
                <span className="font-semibold">{minGrowthPS}</span>
              </div>
              <Slider value={[minGrowthPS]} onValueChange={([v]) => setMinGrowthPS(v)} max={100} step={5} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Price-to-Sales Candidates ({psValueCandidates.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : psValueCandidates.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nothing currently clears all three thresholds. Try raising the max P/S or lowering the quality filters.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="border-b text-left text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-3">Ticker</th>
                      <th className="py-2 pr-3">Price</th>
                      <th className="py-2 pr-3">Market Cap</th>
                      <th className="py-2 pr-3">P/S Ratio</th>
                      <th className="py-2 pr-3">Net Margin</th>
                      <th className="py-2 pr-3">Rev Growth YoY</th>
                      <th className="py-2 pr-3">Balance Sheet</th>
                      <th className="py-2 pr-3">Growth</th>
                      <th className="py-2 pr-3">Combined Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {psValueCandidates.map(({ row: r, composite }) => (
                      <tr key={r.symbol} onClick={() => setSelected(r)} className="cursor-pointer border-b last:border-0 hover:bg-secondary/40">
                        <td className="py-2 pr-3 font-semibold">{r.symbol}</td>
                        <td className="py-2 pr-3">${r.price.toFixed(2)}</td>
                        <td className="py-2 pr-3 text-muted-foreground">{fmtMarketCap(r.market_cap)}</td>
                        <td className="py-2 pr-3 font-bold text-signal-buy">{r.ps_ratio!.toFixed(2)}x</td>
                        <td className="py-2 pr-3">{fmtPct(r.net_margin)}</td>
                        <td className="py-2 pr-3">{fmtPct(r.revenue_growth_yoy)}</td>
                        <td className={`py-2 pr-3 font-bold ${scoreColor(r.balance_sheet_score)}`}>{r.balance_sheet_score}</td>
                        <td className={`py-2 pr-3 font-bold ${scoreColor(r.growth_score)}`}>{r.growth_score}</td>
                        <td className={`py-2 pr-3 font-bold ${scoreColor(composite)}`}>{composite.toFixed(0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-3 text-[10px] italic text-muted-foreground/70">
              P/S Ratio = market cap ÷ trailing-twelve-months revenue. <strong className="text-foreground/80">Combined Score</strong> averages
              a cheapness score (derived from P/S), Balance Sheet, and Growth into one 0–100 ranking, so the stock at the top is the best
              overall mix of "cheap," "financially sound," and "growing" — not just whichever is cheapest. Click any row for the full breakdown.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm font-semibold">How this is calculated</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-xs text-muted-foreground">
            <p><strong className="text-foreground">Price/Sales Ratio:</strong> market cap divided by trailing-twelve-months revenue. Says nothing about profitability on its own — a company can have a low P/S and still be losing money, or a high P/S and be highly profitable.</p>
            <p><strong className="text-foreground">Combined Score:</strong> the average of a P/S-derived cheapness score, Balance Sheet Strength, and Growth & Momentum (each 0–100) — candidates are ranked by this, not by P/S alone, so the best all-around mix rises to the top rather than just the single cheapest name that happens to clear the quality bar.</p>
            <p>Data comes from each company's own reported financials (via Finnhub) — not a scrape of any single site, and not analyst price targets or projections.</p>
          </CardContent>
        </Card>

        <ValueRadarDetail row={selected} allRows={rows} onClose={() => setSelected(null)} />
      </main>
    </div>
  );
};

export default ValueRadarPriceToSales;
