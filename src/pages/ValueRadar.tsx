import { useMemo, useState } from 'react';
import { Loader2, Shield, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Disclaimer } from '@/components/Disclaimer';
import { ValueRadarDetail } from '@/components/ValueRadarDetail';
import { ValueRadarPageHeader } from '@/components/ValueRadarPageHeader';
import { useValueRadar } from '@/context/ValueRadarContext';
import type { Database } from '@/integrations/supabase/types';

type FundamentalsRow = Database['public']['Tables']['stock_fundamentals']['Row'];

const fmtPct = (v: number | null, digits = 1) => (v === null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(digits)}%`);
const fmtRatio = (v: number | null) => (v === null ? '—' : v.toFixed(2));
const scoreColor = (score: number) => (score >= 65 ? 'text-signal-buy' : score >= 40 ? 'text-signal-hold' : 'text-signal-sell');

const ValueRadar = () => {
  const { rows, oldestUpdate, loading, scanning, runScan } = useValueRadar();
  const [minBalance, setMinBalance] = useState(55);
  const [minGrowth, setMinGrowth] = useState(55);
  const [selected, setSelected] = useState<FundamentalsRow | null>(null);

  // Ranks by the sum of both scores -- a genuine combination of every metric
  // this screen tracks, not just one axis, so the single best all-around
  // stock (not just the best balance sheet, or just the best growth) sits
  // at the top.
  const candidates = useMemo(
    () => rows
      .filter(r => r.balance_sheet_score >= minBalance && r.growth_score >= minGrowth)
      .sort((a, b) => (b.balance_sheet_score + b.growth_score) - (a.balance_sheet_score + a.growth_score)),
    [rows, minBalance, minGrowth],
  );

  return (
    <div className="min-h-screen bg-background">
      <ValueRadarPageHeader
        title="Value Radar"
        subtitle="Screens for a strong balance sheet (limited downside) paired with real revenue/earnings growth (upside potential) — the same objective criteria applied to every stock, shown to every user."
        scanning={scanning}
        onRefresh={runScan}
      />
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        <Disclaimer />
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-200/90">
          <strong className="text-amber-300">"Little downside, big upside" is a framing, not a guarantee.</strong>{' '}
          A strong balance sheet reduces (it doesn't eliminate) the odds of permanent capital loss, and past growth/earnings
          beats don't guarantee future ones. Every stock here can still go down. This ranks companies by objective, publicly
          reported fundamentals — it is not a forecast of where any price is headed.
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Filters</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6 sm:grid-cols-2">
            <div>
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="flex items-center gap-1 text-muted-foreground"><Shield className="h-3 w-3" /> Min balance sheet strength</span>
                <span className="font-semibold">{minBalance}</span>
              </div>
              <Slider value={[minBalance]} onValueChange={([v]) => setMinBalance(v)} max={100} step={5} />
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="flex items-center gap-1 text-muted-foreground"><TrendingUp className="h-3 w-3" /> Min growth & momentum</span>
                <span className="font-semibold">{minGrowth}</span>
              </div>
              <Slider value={[minGrowth]} onValueChange={([v]) => setMinGrowth(v)} max={100} step={5} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">
              Candidates ({candidates.length})
              {oldestUpdate && <span className="ml-2 font-normal text-[10px] text-muted-foreground">oldest data {oldestUpdate.toLocaleString()}</span>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : rows.length === 0 ? (
              <p className="text-xs text-muted-foreground">No fundamentals data yet — click "Refresh scan" to pull it (takes about a minute).</p>
            ) : candidates.length === 0 ? (
              <p className="text-xs text-muted-foreground">No stocks currently clear both thresholds. Try lowering the filters.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="border-b text-left text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-3">Ticker</th>
                      <th className="py-2 pr-3">Price</th>
                      <th className="py-2 pr-3">52w Range</th>
                      <th className="py-2 pr-3">Debt/Equity</th>
                      <th className="py-2 pr-3">Current Ratio</th>
                      <th className="py-2 pr-3">Net Margin</th>
                      <th className="py-2 pr-3">Rev Growth YoY</th>
                      <th className="py-2 pr-3">EPS Growth YoY</th>
                      <th className="py-2 pr-3">Avg EPS Surprise</th>
                      <th className="py-2 pr-3">Balance Sheet</th>
                      <th className="py-2 pr-3">Growth</th>
                    </tr>
                  </thead>
                  <tbody>
                    {candidates.map(r => (
                      <tr key={r.symbol} onClick={() => setSelected(r)} className="cursor-pointer border-b last:border-0 hover:bg-secondary/40">
                        <td className="py-2 pr-3 font-semibold">{r.symbol}</td>
                        <td className="py-2 pr-3">${r.price.toFixed(2)}</td>
                        <td className="py-2 pr-3 text-muted-foreground">
                          {r.week52_low && r.week52_high ? `$${r.week52_low.toFixed(0)}–$${r.week52_high.toFixed(0)}` : '—'}
                        </td>
                        <td className="py-2 pr-3">{fmtRatio(r.debt_to_equity)}</td>
                        <td className="py-2 pr-3">{fmtRatio(r.current_ratio)}</td>
                        <td className="py-2 pr-3">{fmtPct(r.net_margin)}</td>
                        <td className="py-2 pr-3">{fmtPct(r.revenue_growth_yoy)}</td>
                        <td className="py-2 pr-3">{fmtPct(r.eps_growth_yoy)}</td>
                        <td className="py-2 pr-3">{fmtPct(r.avg_eps_surprise_pct)}</td>
                        <td className={`py-2 pr-3 font-bold ${scoreColor(r.balance_sheet_score)}`}>{r.balance_sheet_score}</td>
                        <td className={`py-2 pr-3 font-bold ${scoreColor(r.growth_score)}`}>{r.growth_score}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm font-semibold">How this is calculated</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-xs text-muted-foreground">
            <p><strong className="text-foreground">Balance Sheet Strength (0–100):</strong> lower debt/equity, a healthier current ratio, and positive net margins score higher — these are the factors that limit how much a company can lose before its business itself is at risk, independent of where the stock price goes.</p>
            <p><strong className="text-foreground">Growth & Momentum (0–100):</strong> real year-over-year revenue and EPS growth, plus a track record of beating (rather than missing) recent earnings estimates.</p>
            <p><strong className="text-foreground">Ranking:</strong> candidates are sorted by the sum of both scores, so the stock with the best overall combination of balance-sheet strength and growth sits at the top — not just whichever wins on a single metric.</p>
            <p>Data comes from each company's own reported financials (via Finnhub) — not a scrape of any single site, and not analyst price targets or projections. A missing data point is left out of that stock's score rather than guessed at.</p>
            <p>Click any row for a breakdown of exactly what's behind its score, compared against the rest of this scanned list.</p>
          </CardContent>
        </Card>

        <ValueRadarDetail row={selected} allRows={rows} onClose={() => setSelected(null)} />
      </main>
    </div>
  );
};

export default ValueRadar;
