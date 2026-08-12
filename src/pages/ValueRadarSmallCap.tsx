import { useMemo, useState } from 'react';
import { Loader2, Shield, TrendingUp, Gem } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Disclaimer } from '@/components/Disclaimer';
import { ValueRadarDetail } from '@/components/ValueRadarDetail';
import { ValueRadarPageHeader } from '@/components/ValueRadarPageHeader';
import { useValueRadar } from '@/context/ValueRadarContext';
import { broadSector } from '@/lib/sectorMapping';
import { computeSectorBenchmarks, relativeScore, type SectorBenchmark } from '@/lib/sectorRelativeValuation';
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

// Flat fallback for a sector with too few tracked peers to trust a median --
// same calibration as before. Used only as a last resort.
const absolutePeToScore = (pe: number) => Math.max(0, Math.min(100, 100 - pe * 2.5));
const absolutePbToScore = (pb: number) => Math.max(0, Math.min(100, 100 - pb * 20));
const absolutePsToScore = (ps: number) => Math.max(0, Math.min(100, 100 - ps * 30));

const ValueRadarSmallCap = () => {
  const { rows, loading, scanning, runScan } = useValueRadar();
  const [maxCap, setMaxCap] = useState(2000); // $M
  const [minCap, setMinCap] = useState(300); // $M
  const [minBalance, setMinBalance] = useState(40);
  const [minGrowth, setMinGrowth] = useState(30);
  const [selected, setSelected] = useState<FundamentalsRow | null>(null);

  // Benchmarked against the FULL tracked universe (not just other small
  // caps) -- a small-cap software company should be compared to every
  // tracked software company, mega-caps included, to get a meaningful
  // sector median; restricting the peer set to small-caps only would shrink
  // an already-thin sample even further.
  const sectorBenchmarks = useMemo(() => computeSectorBenchmarks(rows), [rows]);

  // Small caps get overlooked precisely because there's less analyst
  // coverage -- which cuts both ways: real bargains hide here, but so do
  // real value traps with nobody watching closely. Blending whichever
  // valuation multiples are actually reported (P/E, P/B, P/S) with the same
  // balance-sheet/growth quality gates as the other screens is what
  // separates "cheap small stock" from "cheap AND still sound." Each
  // multiple is scored against its own sector's median among tracked peers
  // rather than one flat cutoff for every industry, falling back to the
  // flat scale only when a sector has too few peers (under 4) to trust.
  const candidates = useMemo(
    () => rows
      .filter(r => r.market_cap !== null && r.market_cap >= minCap && r.market_cap <= maxCap
        && r.balance_sheet_score >= minBalance && r.growth_score >= minGrowth)
      .map(r => {
        const sector = broadSector(r.symbol, r.sector);
        const benchmark = sectorBenchmarks.get(sector);
        const valuationParts: number[] = [];
        if (r.pe_ratio !== null) valuationParts.push(relativeScore(r.pe_ratio, benchmark?.medianPE ?? null) ?? absolutePeToScore(r.pe_ratio));
        if (r.pb_ratio !== null && r.pb_ratio > 0) valuationParts.push(relativeScore(r.pb_ratio, benchmark?.medianPB ?? null) ?? absolutePbToScore(r.pb_ratio));
        if (r.ps_ratio !== null && r.ps_ratio > 0) valuationParts.push(relativeScore(r.ps_ratio, benchmark?.medianPS ?? null) ?? absolutePsToScore(r.ps_ratio));
        if (!valuationParts.length) return null;
        const valuationScore = valuationParts.reduce((a, b) => a + b, 0) / valuationParts.length;
        const composite = (valuationScore + r.balance_sheet_score + r.growth_score) / 3;
        return { row: r, sector, benchmark, composite };
      })
      .filter((v): v is { row: FundamentalsRow; sector: string; benchmark: SectorBenchmark | undefined; composite: number } => v !== null)
      .sort((a, b) => b.composite - a.composite),
    [rows, minCap, maxCap, minBalance, minGrowth, sectorBenchmarks],
  );

  return (
    <div className="min-h-screen bg-background">
      <ValueRadarPageHeader
        title="Small-Cap Value Screen"
        subtitle="Smaller companies (roughly $300M-$2B market cap) with reasonable valuation multiples and quality gates, ranked by the best overall combination."
        scanning={scanning}
        onRefresh={runScan}
      />
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        <Disclaimer />
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-200/90">
          <strong className="text-amber-300">Small-cap stocks carry real risks large-caps mostly don't</strong> — thinner
          trading volume, wider bid/ask spreads, less analyst coverage, and often more volatile earnings. A low
          valuation multiple here means the market is pricing the stock cheaply relative to its own earnings, book
          value, or sales — not that it's automatically a good investment. This ranks by objective reported financials;
          it is not a forecast or a recommendation.
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Small-Cap Filters</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Min market cap</span>
                <span className="font-semibold">{fmtMarketCap(minCap)}</span>
              </div>
              <Slider value={[minCap]} onValueChange={([v]) => setMinCap(v)} min={50} max={2000} step={50} />
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Max market cap</span>
                <span className="font-semibold">{fmtMarketCap(maxCap)}</span>
              </div>
              <Slider value={[maxCap]} onValueChange={([v]) => setMaxCap(v)} min={300} max={5000} step={100} />
            </div>
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
            <CardTitle className="flex items-center gap-2 text-sm font-semibold"><Gem className="h-4 w-4" /> Small-Cap Candidates ({candidates.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : candidates.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nothing currently clears these thresholds. Try widening the market-cap range or lowering the quality filters.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="border-b text-left text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-3">Ticker</th>
                      <th className="py-2 pr-3">Sector</th>
                      <th className="py-2 pr-3">Price</th>
                      <th className="py-2 pr-3">Market Cap</th>
                      <th className="py-2 pr-3">P/E</th>
                      <th className="py-2 pr-3">P/B</th>
                      <th className="py-2 pr-3">P/S</th>
                      <th className="py-2 pr-3">Sector Peers</th>
                      <th className="py-2 pr-3">Rev Growth YoY</th>
                      <th className="py-2 pr-3">Balance Sheet</th>
                      <th className="py-2 pr-3">Growth</th>
                      <th className="py-2 pr-3">Combined Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {candidates.map(({ row: r, sector, benchmark, composite }) => (
                      <tr key={r.symbol} onClick={() => setSelected(r)} className="cursor-pointer border-b last:border-0 hover:bg-secondary/40">
                        <td className="py-2 pr-3 font-semibold">{r.symbol}</td>
                        <td className="py-2 pr-3 text-muted-foreground">{sector}</td>
                        <td className="py-2 pr-3">${r.price.toFixed(2)}</td>
                        <td className="py-2 pr-3 text-muted-foreground">{fmtMarketCap(r.market_cap)}</td>
                        <td className="py-2 pr-3">{r.pe_ratio !== null ? r.pe_ratio.toFixed(1) : '—'}</td>
                        <td className="py-2 pr-3">{r.pb_ratio !== null ? r.pb_ratio.toFixed(2) : '—'}</td>
                        <td className="py-2 pr-3">{r.ps_ratio !== null ? `${r.ps_ratio.toFixed(2)}x` : '—'}</td>
                        <td className="py-2 pr-3 text-muted-foreground">{benchmark?.peerCount ?? 0}</td>
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
              Each multiple (P/E, P/B, P/S) is scored against its own sector's median among tracked peers — including
              large-caps, not just other small-caps — so a stock isn't penalized just for being in a structurally
              higher-multiple industry. Sectors with fewer than 4 tracked peers reporting a metric fall back to a flat
              benchmark instead of an unreliable median. <strong className="text-foreground/80">Combined Score</strong> averages
              that sector-relative valuation score (from whichever of P/E, P/B, and P/S are actually reported), Balance Sheet, and
              Growth into one 0–100 ranking. Click any row for the full breakdown.
            </p>
          </CardContent>
        </Card>

        <ValueRadarDetail row={selected} allRows={rows} onClose={() => setSelected(null)} />
      </main>
    </div>
  );
};

export default ValueRadarSmallCap;
