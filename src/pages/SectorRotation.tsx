import { useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw, TrendingDown, Gem } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Disclaimer } from '@/components/Disclaimer';
import { ValueRadarDetail } from '@/components/ValueRadarDetail';
import { supabase } from '@/integrations/supabase/client';
import { broadSector } from '@/lib/sectorMapping';
import type { Database } from '@/integrations/supabase/types';

type FundamentalsRow = Database['public']['Tables']['stock_fundamentals']['Row'];
type MomentumRow = Pick<Database['public']['Tables']['realized_volatility']['Row'], 'symbol' | 'price_change_pct'>;

const scoreColor = (score: number) => (score >= 65 ? 'text-signal-buy' : score >= 40 ? 'text-signal-hold' : 'text-signal-sell');
const momentumColor = (pct: number) => (pct >= 0 ? 'text-signal-buy' : pct <= -3 ? 'text-signal-sell' : 'text-signal-hold');
const fmtPct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;

// Requires an actual peer group before a sector average means anything --
// same floor the sector-relative valuation/fundamentals scoring already
// uses elsewhere on this site.
const MIN_SECTOR_PEERS = 4;
// Only worth calling out as a "quality still intact" sector once the
// average balance-sheet + growth score clears a real bar, not just
// "better than an already-bad market."
const MIN_QUALITY_FOR_CONTRARIAN = 55;

interface SectorSummary {
  sector: string;
  stocks: Array<{ row: FundamentalsRow; quality: number; momentum: number | null }>;
  avgMomentum: number | null;
  avgQuality: number;
  peerCount: number;
}

const SectorRotation = () => {
  const [rows, setRows] = useState<FundamentalsRow[]>([]);
  const [momentumBySymbol, setMomentumBySymbol] = useState<Map<string, number | null>>(new Map());
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [selectedSector, setSelectedSector] = useState<string | null>(null);
  const [selectedStock, setSelectedStock] = useState<FundamentalsRow | null>(null);

  const load = async () => {
    setLoading(true);
    const [fundamentalsRes, momentumRes] = await Promise.all([
      supabase.from('stock_fundamentals').select('*'),
      supabase.from('realized_volatility').select('symbol, price_change_pct'),
    ]);
    setRows(fundamentalsRes.data ?? []);
    setMomentumBySymbol(new Map((momentumRes.data ?? []).map((r: MomentumRow) => [r.symbol, r.price_change_pct])));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const runScan = async () => {
    setScanning(true);
    await Promise.all([
      supabase.functions.invoke('fundamentals-scanner', { body: {} }),
      supabase.functions.invoke('realized-volatility-scanner', { body: {} }),
    ]);
    await load();
    setScanning(false);
  };

  // Groups every scanned stock into a broad sector, then rolls up two
  // independent signals per sector: how the market has actually been
  // pricing it lately (average price change -- real trading behavior, not
  // an opinion), and how sound the underlying businesses still are on
  // average (balance sheet + growth, already scored sector-relative
  // elsewhere on this site). A sector can be weak on the first and strong
  // on the second at the same time -- that combination is the whole point
  // of this screen: the market rotating out of a sector broadly doesn't
  // mean every company in it got worse.
  const sectors = useMemo(() => {
    const bySector = new Map<string, FundamentalsRow[]>();
    for (const r of rows) {
      const s = broadSector(r.symbol, r.sector);
      if (!bySector.has(s)) bySector.set(s, []);
      bySector.get(s)!.push(r);
    }

    const summaries: SectorSummary[] = [];
    for (const [sector, peers] of bySector) {
      if (peers.length < MIN_SECTOR_PEERS) continue;
      const stocks = peers.map(row => ({
        row,
        quality: (row.balance_sheet_score + row.growth_score) / 2,
        momentum: momentumBySymbol.get(row.symbol) ?? null,
      }));
      const momenta = stocks.map(s => s.momentum).filter((v): v is number => v !== null);
      const avgMomentum = momenta.length ? momenta.reduce((a, b) => a + b, 0) / momenta.length : null;
      const avgQuality = stocks.reduce((a, s) => a + s.quality, 0) / stocks.length;
      summaries.push({ sector, stocks: stocks.sort((a, b) => b.quality - a.quality), avgMomentum, avgQuality, peerCount: stocks.length });
    }
    return summaries.sort((a, b) => (a.avgMomentum ?? 0) - (b.avgMomentum ?? 0));
  }, [rows, momentumBySymbol]);

  // The market-wide baseline every sector is judged against -- "out of
  // favor" only means something relative to how everything else has been
  // trading, not an absolute cutoff.
  const marketAvgMomentum = useMemo(() => {
    const withMomentum = sectors.filter(s => s.avgMomentum !== null);
    if (!withMomentum.length) return null;
    return withMomentum.reduce((a, s) => a + (s.avgMomentum ?? 0), 0) / withMomentum.length;
  }, [sectors]);

  const contrarianSectors = useMemo(
    () => sectors.filter(s =>
      s.avgMomentum !== null && marketAvgMomentum !== null && s.avgMomentum < marketAvgMomentum
      // Rounded the same way the quality score is displayed -- otherwise a
      // sector showing "55 quality" (rounded up from 54.5) could fail an
      // unrounded >= 55 check and look inconsistently excluded.
      && Math.round(s.avgQuality) >= MIN_QUALITY_FOR_CONTRARIAN),
    [sectors, marketAvgMomentum],
  );

  const selected = sectors.find(s => s.sector === selectedSector) ?? null;
  const allRowsForDetail = rows;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <div>
            <h1 className="font-heading text-lg font-bold">Sector Rotation</h1>
            <p className="text-xs text-muted-foreground">
              Sectors the market has been pricing down lately that still have strong average fundamentals underneath.
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
          <strong className="text-amber-300">A sector being out of favor doesn't mean it's cheap for a reason.</strong> Sometimes
          the market is right and the businesses in it really are deteriorating. This screen only tells you where price action
          and fundamentals currently disagree — it's a starting point for research, not a signal to buy.
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <TrendingDown className="h-4 w-4" /> Contrarian Candidates ({contrarianSectors.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {contrarianSectors.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Nothing currently qualifies — no sector is both lagging the tracked-universe average and clearing a {MIN_QUALITY_FOR_CONTRARIAN}+ average quality score.
                  </p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {contrarianSectors.map(s => (
                      <button
                        key={s.sector}
                        onClick={() => setSelectedSector(s.sector)}
                        className={`rounded-lg border p-3 text-left transition-colors hover:bg-secondary/40 ${selectedSector === s.sector ? 'border-primary bg-secondary/30' : 'border-border'}`}
                      >
                        <div className="font-semibold">{s.sector}</div>
                        <div className="mt-1 flex items-center justify-between text-xs">
                          <span className={momentumColor(s.avgMomentum!)}>{fmtPct(s.avgMomentum!)} momentum</span>
                          <span className={`font-bold ${scoreColor(s.avgQuality)}`}>{s.avgQuality.toFixed(0)} quality</span>
                        </div>
                        <div className="mt-1 text-[10px] text-muted-foreground">{s.peerCount} tracked stocks</div>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold">All Sectors ({sectors.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="border-b text-left text-muted-foreground">
                      <tr>
                        <th className="py-2 pr-3">Sector</th>
                        <th className="py-2 pr-3">Momentum</th>
                        <th className="py-2 pr-3">Avg Quality</th>
                        <th className="py-2 pr-3">Tracked Stocks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sectors.map(s => (
                        <tr
                          key={s.sector}
                          onClick={() => setSelectedSector(s.sector)}
                          className={`cursor-pointer border-b last:border-0 hover:bg-secondary/40 ${selectedSector === s.sector ? 'bg-secondary/30' : ''}`}
                        >
                          <td className="py-2 pr-3 font-semibold">{s.sector}</td>
                          <td className={`py-2 pr-3 font-bold ${s.avgMomentum !== null ? momentumColor(s.avgMomentum) : 'text-muted-foreground'}`}>
                            {s.avgMomentum !== null ? fmtPct(s.avgMomentum) : '—'}
                          </td>
                          <td className={`py-2 pr-3 font-bold ${scoreColor(s.avgQuality)}`}>{s.avgQuality.toFixed(0)}</td>
                          <td className="py-2 pr-3 text-muted-foreground">{s.peerCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-3 text-[10px] italic text-muted-foreground/70">
                  <strong className="text-foreground/80">Momentum</strong> is each sector's average price change over the
                  scanner's recent lookback window (real trading behavior). <strong className="text-foreground/80">Avg
                  Quality</strong> averages Balance Sheet Strength and Growth &amp; Momentum across the sector's tracked
                  stocks. Market-wide average momentum right now: {marketAvgMomentum !== null ? fmtPct(marketAvgMomentum) : '—'}.
                  Click any sector for its individual stocks.
                </p>
              </CardContent>
            </Card>

            {selected && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                    <Gem className="h-4 w-4" /> {selected.sector} — Best Individual Stocks
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="border-b text-left text-muted-foreground">
                        <tr>
                          <th className="py-2 pr-3">Ticker</th>
                          <th className="py-2 pr-3">Price</th>
                          <th className="py-2 pr-3">Momentum</th>
                          <th className="py-2 pr-3">Balance Sheet</th>
                          <th className="py-2 pr-3">Growth</th>
                          <th className="py-2 pr-3">Quality</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selected.stocks.map(({ row: r, quality, momentum }) => (
                          <tr key={r.symbol} onClick={() => setSelectedStock(r)} className="cursor-pointer border-b last:border-0 hover:bg-secondary/40">
                            <td className="py-2 pr-3 font-semibold">{r.symbol}</td>
                            <td className="py-2 pr-3">${r.price.toFixed(2)}</td>
                            <td className={`py-2 pr-3 ${momentum !== null ? momentumColor(momentum) : 'text-muted-foreground'}`}>
                              {momentum !== null ? fmtPct(momentum) : '—'}
                            </td>
                            <td className={`py-2 pr-3 font-bold ${scoreColor(r.balance_sheet_score)}`}>{r.balance_sheet_score}</td>
                            <td className={`py-2 pr-3 font-bold ${scoreColor(r.growth_score)}`}>{r.growth_score}</td>
                            <td className={`py-2 pr-3 font-bold ${scoreColor(quality)}`}>{quality.toFixed(0)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        <ValueRadarDetail row={selectedStock} allRows={allRowsForDetail} onClose={() => setSelectedStock(null)} />
      </main>
    </div>
  );
};

export default SectorRotation;
