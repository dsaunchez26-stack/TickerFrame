import { useMemo, useState } from 'react';
import { Loader2, Shield, TrendingDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Disclaimer } from '@/components/Disclaimer';
import { ValueRadarPageHeader } from '@/components/ValueRadarPageHeader';
import { useStockDetail } from '@/context/StockDetailContext';
import { useValueRadar } from '@/context/ValueRadarContext';
import type { Database } from '@/integrations/supabase/types';

type FundamentalsRow = Database['public']['Tables']['stock_fundamentals']['Row'];
type TechnicalsRow = Pick<Database['public']['Tables']['stock_cache']['Row'], 'symbol' | 'price' | 'bollinger_pct_b' | 'rsi' | 'pattern' | 'pattern_confidence'>;

const fmtPct = (v: number | null, digits = 1) => (v === null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(digits)}%`);
const fmtRatio = (v: number | null) => (v === null ? '—' : v.toFixed(2));
const weaknessColor = (score: number) => (score <= 35 ? 'text-signal-sell' : score <= 50 ? 'text-signal-hold' : 'text-signal-buy');

const ValueRadarShort = () => {
  const { rows, technicalsBySymbol, bestPutByTicker, putsScannedAt, loading, scanning, runScan } = useValueRadar();
  const [maxWeakBalance, setMaxWeakBalance] = useState(40);
  const [minStretchPct, setMinStretchPct] = useState(100);
  const { open: openStockDetail } = useStockDetail();

  // The inverse screen: a weak balance sheet (the same score, just read the
  // other direction) paired with a price that's technically stretched above
  // its own normal range (Bollinger %B >= 1 means trading at/above the upper
  // band). Neither signal alone means much -- a weak-fundamentals stock can
  // stay stretched for a long time, and an overextended stock can have a
  // fine balance sheet -- the combination is what's flagged here, ranked by
  // how stretched it is first and how weak its balance sheet is second.
  const shortCandidates = useMemo(
    () => rows
      .map(r => ({ fundamentals: r, technicals: technicalsBySymbol.get(r.symbol) ?? null }))
      .filter((x): x is { fundamentals: FundamentalsRow; technicals: TechnicalsRow } =>
        x.technicals !== null &&
        x.technicals.bollinger_pct_b !== null &&
        x.fundamentals.balance_sheet_score <= maxWeakBalance &&
        x.technicals.bollinger_pct_b >= minStretchPct / 100)
      .sort((a, b) => (b.technicals.bollinger_pct_b! - a.technicals.bollinger_pct_b!) || (a.fundamentals.balance_sheet_score - b.fundamentals.balance_sheet_score)),
    [rows, technicalsBySymbol, maxWeakBalance, minStretchPct],
  );

  return (
    <div className="min-h-screen bg-background">
      <ValueRadarPageHeader
        title="Short Candidates"
        subtitle="The inverse screen: a weak balance sheet paired with a price that's technically stretched above its own normal trading range (Bollinger %B) — same objective data, same criteria applied to every stock."
        scanning={scanning}
        onRefresh={runScan}
      />
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        <Disclaimer />
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-200/90 space-y-1.5">
          <p><strong className="text-red-300">Shorting is not a mirror image of buying — read this before using this list for anything.</strong></p>
          <p>
            A long position's max loss is what you paid. Shorting a stock (or buying puts) has no equivalent floor on the
            upside risk: if the stock keeps rising instead of falling, losses are not capped the way a long purchase's is.
            Weak-fundamentals stocks that are heavily shorted are also exactly the names most prone to short squeezes —
            sharp, fast rallies driven by short covering, not fundamentals — which can move against a short position
            violently and quickly.
          </p>
          <p>
            This list is a backward-looking data screen, not a signal to open a position, and it is not a recommendation
            to short anything. It reflects two objective numbers (a fundamentals score and a price-vs-its-own-range
            statistic) as of the last scan — nothing here predicts what happens next.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Short Screen Filters</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6 sm:grid-cols-2">
            <div>
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="flex items-center gap-1 text-muted-foreground"><Shield className="h-3 w-3" /> Max balance sheet strength (weaker below)</span>
                <span className="font-semibold">{maxWeakBalance}</span>
              </div>
              <Slider value={[maxWeakBalance]} onValueChange={([v]) => setMaxWeakBalance(v)} max={100} step={5} />
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="flex items-center gap-1 text-muted-foreground"><TrendingDown className="h-3 w-3" /> Min Bollinger %B (100 = at upper band)</span>
                <span className="font-semibold">{minStretchPct}</span>
              </div>
              <Slider value={[minStretchPct]} onValueChange={([v]) => setMinStretchPct(v)} min={50} max={200} step={10} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Short Candidates ({shortCandidates.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : shortCandidates.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nothing currently clears both thresholds. Try raising the max balance-sheet score or lowering the min %B.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="border-b text-left text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-3">Ticker</th>
                      <th className="py-2 pr-3">Price</th>
                      <th className="py-2 pr-3">Debt/Equity</th>
                      <th className="py-2 pr-3">Net Margin</th>
                      <th className="py-2 pr-3">Balance Sheet</th>
                      <th className="py-2 pr-3">Bollinger %B</th>
                      <th className="py-2 pr-3">RSI</th>
                      <th className="py-2 pr-3">Pattern</th>
                      <th className="py-2 pr-3">Best Put (defined-risk)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shortCandidates.map(({ fundamentals: r, technicals: t }) => {
                      const put = bestPutByTicker.get(r.symbol);
                      return (
                      <tr key={r.symbol} className="border-b last:border-0 hover:bg-secondary/40">
                        <td className="py-2 pr-3">
                          <button onClick={() => openStockDetail(r.symbol)} className="font-semibold hover:text-primary hover:underline">{r.symbol}</button>
                        </td>
                        <td className="py-2 pr-3">${t.price.toFixed(2)}</td>
                        <td className="py-2 pr-3">{fmtRatio(r.debt_to_equity)}</td>
                        <td className="py-2 pr-3">{fmtPct(r.net_margin)}</td>
                        <td className={`py-2 pr-3 font-bold ${weaknessColor(r.balance_sheet_score)}`}>{r.balance_sheet_score}</td>
                        <td className="py-2 pr-3 font-bold text-signal-sell">{t.bollinger_pct_b!.toFixed(2)}</td>
                        <td className="py-2 pr-3">{t.rsi != null ? t.rsi.toFixed(0) : '—'}</td>
                        <td className="py-2 pr-3 text-muted-foreground">{t.pattern ?? '—'}</td>
                        <td className="py-2 pr-3">
                          {put ? (
                            <span>
                              <span className="font-semibold">${put.strike}P</span>{' '}
                              <span className="text-muted-foreground">{put.expiration}</span>{' '}
                              · ${put.price.toFixed(2)}{' '}
                              <span className="text-muted-foreground">(score {put.score.toFixed(0)})</span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-3 text-[10px] italic text-muted-foreground/70">
              Bollinger %B measures where the current price sits relative to its own 20-period range: 1.00 = right at the
              upper band, 1.50 = 50% of a band-width above it. Ranked by most-stretched first, then weakest balance sheet.
              "Best Put" is the highest-scoring put contract the options scanner currently has on file for that ticker —
              buying a put has a capped max loss (what you pay for it), unlike shorting the stock itself.
              {putsScannedAt && <span> Options data as of {new Date(putsScannedAt).toLocaleString()}.</span>}
              {' '}Click any ticker to see the chart this is based on.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default ValueRadarShort;
