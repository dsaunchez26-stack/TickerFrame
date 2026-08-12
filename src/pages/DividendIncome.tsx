import { useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw, Shield, Percent } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Disclaimer } from '@/components/Disclaimer';
import { ValueRadarDetail } from '@/components/ValueRadarDetail';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type FundamentalsRow = Database['public']['Tables']['stock_fundamentals']['Row'];

const scoreColor = (score: number) => (score >= 65 ? 'text-signal-buy' : score >= 40 ? 'text-signal-hold' : 'text-signal-sell');
const fmtMarketCap = (v: number | null) => {
  if (v === null) return '—';
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}T`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}B`;
  return `$${v.toFixed(0)}M`;
};

// A payout ratio near or over 100% means the dividend is costing more than
// the company earns -- not sustainable indefinitely. Scored so "comfortably
// covered" (under ~50%) ranks highest and it falls off past that, going
// negative (clamped to 0) once payout crosses 100%.
const payoutSafetyScore = (payoutRatio: number) => Math.max(0, Math.min(100, 100 - payoutRatio * 0.8));

const DividendIncome = () => {
  const [rows, setRows] = useState<FundamentalsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [minYield, setMinYield] = useState(2);
  const [maxPayout, setMaxPayout] = useState(80);
  const [minBalance, setMinBalance] = useState(40);
  const [selected, setSelected] = useState<FundamentalsRow | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('stock_fundamentals').select('*');
    setRows(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const runScan = async () => {
    setScanning(true);
    await supabase.functions.invoke('fundamentals-scanner', { body: {} });
    await load();
    setScanning(false);
  };

  // This is a deliberately different lens than the rest of the site's
  // growth/momentum-heavy screens: bought for the payout itself, not price
  // appreciation, so ranking rewards a comfortably-covered yield over the
  // single highest number (an unsustainably high yield is often a warning
  // sign -- the market pricing in a future cut -- not a bargain).
  const candidates = useMemo(
    () => rows
      .filter(r => r.dividend_yield !== null && r.dividend_yield >= minYield
        && (r.payout_ratio === null || r.payout_ratio <= maxPayout)
        && r.balance_sheet_score >= minBalance)
      .map(r => {
        const safety = r.payout_ratio !== null ? payoutSafetyScore(r.payout_ratio) : 60; // unreported payout ratio -- neutral, not penalized
        const composite = (r.dividend_yield! * 8 + safety + r.balance_sheet_score) / 3;
        return { row: r, composite };
      })
      .sort((a, b) => b.composite - a.composite),
    [rows, minYield, maxPayout, minBalance],
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <div>
            <h1 className="font-heading text-lg font-bold">Dividend Income</h1>
            <p className="text-xs text-muted-foreground">
              Steady, cash-generative payers — the counterweight to the growth/momentum screens elsewhere on this site.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={runScan} disabled={scanning}>
            {scanning ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-1 h-3 w-3" />}
            Refresh scan
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <Disclaimer />
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-200/90">
          <strong className="text-amber-300">A high yield is not automatically good.</strong> Yield rises when a stock
          price falls, so an unusually high number can mean the market expects a dividend cut, not that you found a
          bargain. This screen weighs payout-ratio coverage and balance-sheet strength alongside yield specifically to
          surface sustainable payers over whichever number is simply highest — it is not a forecast or a recommendation.
        </div>

        <Card>
          <CardHeader><CardTitle className="text-sm font-semibold">Filters</CardTitle></CardHeader>
          <CardContent className="grid gap-6 sm:grid-cols-3">
            <div>
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="flex items-center gap-1 text-muted-foreground"><Percent className="h-3 w-3" /> Min dividend yield</span>
                <span className="font-semibold">{minYield.toFixed(1)}%</span>
              </div>
              <Slider value={[minYield]} onValueChange={([v]) => setMinYield(v)} min={0.5} max={8} step={0.5} />
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Max payout ratio</span>
                <span className="font-semibold">{maxPayout}%</span>
              </div>
              <Slider value={[maxPayout]} onValueChange={([v]) => setMaxPayout(v)} min={20} max={150} step={5} />
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="flex items-center gap-1 text-muted-foreground"><Shield className="h-3 w-3" /> Min balance sheet strength</span>
                <span className="font-semibold">{minBalance}</span>
              </div>
              <Slider value={[minBalance]} onValueChange={([v]) => setMinBalance(v)} max={100} step={5} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm font-semibold">Dividend Candidates ({candidates.length})</CardTitle></CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : candidates.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nothing currently clears these thresholds. Try lowering the min yield or raising the max payout ratio.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="border-b text-left text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-3">Ticker</th>
                      <th className="py-2 pr-3">Price</th>
                      <th className="py-2 pr-3">Market Cap</th>
                      <th className="py-2 pr-3">Yield</th>
                      <th className="py-2 pr-3">Payout Ratio</th>
                      <th className="py-2 pr-3">P/E</th>
                      <th className="py-2 pr-3">Balance Sheet</th>
                      <th className="py-2 pr-3">Combined Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {candidates.map(({ row: r, composite }) => (
                      <tr key={r.symbol} onClick={() => setSelected(r)} className="cursor-pointer border-b last:border-0 hover:bg-secondary/40">
                        <td className="py-2 pr-3 font-semibold">{r.symbol}</td>
                        <td className="py-2 pr-3">${r.price.toFixed(2)}</td>
                        <td className="py-2 pr-3 text-muted-foreground">{fmtMarketCap(r.market_cap)}</td>
                        <td className="py-2 pr-3 font-bold text-signal-buy">{r.dividend_yield!.toFixed(2)}%</td>
                        <td className="py-2 pr-3">{r.payout_ratio !== null ? `${r.payout_ratio.toFixed(0)}%` : 'not reported'}</td>
                        <td className="py-2 pr-3">{r.pe_ratio !== null ? r.pe_ratio.toFixed(1) : '—'}</td>
                        <td className={`py-2 pr-3 font-bold ${scoreColor(r.balance_sheet_score)}`}>{r.balance_sheet_score}</td>
                        <td className={`py-2 pr-3 font-bold ${scoreColor(composite)}`}>{composite.toFixed(0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-3 text-[10px] italic text-muted-foreground/70">
              <strong className="text-foreground/80">Combined Score</strong> blends yield, payout-ratio safety (how
              comfortably the dividend is covered by earnings), and Balance Sheet Strength into one ranking — a stock
              with the single highest yield can still rank below one with a smaller but safer, better-covered payout.
              Click any row for the full breakdown.
            </p>
          </CardContent>
        </Card>

        <ValueRadarDetail row={selected} allRows={rows} onClose={() => setSelected(null)} />
      </main>
    </div>
  );
};

export default DividendIncome;
