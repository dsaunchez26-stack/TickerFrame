import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Disclaimer } from '@/components/Disclaimer';
import { Loader2, RefreshCw, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type InsiderRow = Database['public']['Tables']['insider_activity']['Row'];

const fmtUsd = (v: number) => v.toLocaleString(undefined, { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtDate = (d: string | null) => (d ? new Date(d + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—');

const InsiderActivity = () => {
  const [rows, setRows] = useState<InsiderRow[]>([]);
  const [prices, setPrices] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [minValue, setMinValue] = useState(100_000);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('insider_activity').select('*').order('filing_date', { ascending: false });
    const all = data ?? [];
    setRows(all);
    const tickers = Array.from(new Set(all.map(r => r.ticker)));
    if (tickers.length) {
      const { data: priceRows } = await supabase.from('stock_cache').select('symbol, price').in('symbol', tickers);
      setPrices(new Map((priceRows ?? []).map(p => [p.symbol, Number(p.price)])));
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const runScan = async () => {
    setScanning(true);
    await supabase.functions.invoke('insider-scanner', { body: {} });
    await load();
    setScanning(false);
  };

  const buys = useMemo(
    () => rows
      .filter(r => r.form_type === '4' && r.transaction_code === 'P' && (r.total_value ?? 0) >= minValue)
      .sort((a, b) => (b.total_value ?? 0) - (a.total_value ?? 0)),
    [rows, minValue],
  );
  const holderFilings = useMemo(
    () => rows.filter(r => r.form_type.startsWith('SCHEDULE')).sort((a, b) => b.filing_date.localeCompare(a.filing_date)),
    [rows],
  );

  // created_at is set once on first insert and never touched again by the
  // scanner's upsert (onConflict only overwrites the columns it actually
  // sends, which doesn't include created_at) -- so this is the newest row
  // any scan has ever discovered, not when the scanner itself last ran. A
  // scan that finds nothing new won't move this forward, but it's still an
  // honest "how fresh is the newest thing we've found" signal, unlike
  // taking the oldest row (which only ever gets staler-looking over time,
  // even right after a successful scan).
  const mostRecentFiling = useMemo(
    () => rows.reduce<Date | null>((max, r) => {
      const d = new Date(r.created_at);
      return !max || d > max ? d : max;
    }, null),
    [rows],
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <div>
            <h1 className="font-heading text-lg font-bold">Insider Activity</h1>
            <p className="text-xs text-muted-foreground">
              Open-market insider buys (SEC Form 4) and new 5%+ holder filings (Schedule 13D/13G), pulled directly from SEC EDGAR.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={runScan} disabled={scanning}>
            {scanning ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-1 h-3 w-3" />}
            Scan Now
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <Disclaimer />
        <p className="text-[11px] text-muted-foreground">
          Insider buying is not a signal, a recommendation, or a guarantee that a stock will rise — it's one public data
          point among many. Form 4 filings are due within 2 business days of a trade, so this can lag the actual purchase
          by that much. Schedule 13D/13G filings don't require the filer to disclose a per-share price, so those rows
          show ownership stake changes only, not what was paid.
          {mostRecentFiling && <> Newest filing on record: {mostRecentFiling.toLocaleString()}.</>}
        </p>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Insider Buys (Form 4, open-market purchases)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <span className="whitespace-nowrap text-xs text-muted-foreground">Min. purchase value: {fmtUsd(minValue)}</span>
              <Slider
                value={[minValue]}
                onValueChange={([v]) => setMinValue(v)}
                min={50_000}
                max={2_000_000}
                step={25_000}
                className="max-w-xs"
              />
            </div>
            {loading ? (
              <p className="py-6 text-center text-xs text-muted-foreground">Loading…</p>
            ) : buys.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                No open-market insider purchases at or above {fmtUsd(minValue)} in the tracked window. Try lowering the threshold, or run a new scan.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="border-b text-left text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-3">Ticker</th>
                      <th className="py-2 pr-3">Insider</th>
                      <th className="py-2 pr-3">Title</th>
                      <th className="py-2 pr-3">Date</th>
                      <th className="py-2 pr-3">Shares</th>
                      <th className="py-2 pr-3">Price Paid</th>
                      <th className="py-2 pr-3">Total Value</th>
                      <th className="py-2 pr-3">Current Price</th>
                      <th className="py-2 pr-3">Since Purchase</th>
                      <th className="py-2 pr-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {buys.map(r => {
                      const current = prices.get(r.ticker);
                      const pctSince = current && r.price_per_share ? ((current - r.price_per_share) / r.price_per_share) * 100 : null;
                      return (
                        <tr key={r.id} className="border-b last:border-0">
                          <td className="py-2 pr-3 font-semibold">{r.ticker}</td>
                          <td className="py-2 pr-3">{r.filer_name}</td>
                          <td className="py-2 pr-3 text-muted-foreground">{r.filer_title ?? '—'}</td>
                          <td className="py-2 pr-3">{fmtDate(r.transaction_date)}</td>
                          <td className="py-2 pr-3">{r.shares?.toLocaleString() ?? '—'}</td>
                          <td className="py-2 pr-3">${r.price_per_share?.toFixed(2) ?? '—'}</td>
                          <td className="py-2 pr-3 font-semibold">{r.total_value ? fmtUsd(r.total_value) : '—'}</td>
                          <td className="py-2 pr-3">{current ? `$${current.toFixed(2)}` : '—'}</td>
                          <td className={`py-2 pr-3 font-semibold ${pctSince === null ? '' : pctSince >= 0 ? 'text-signal-buy' : 'text-signal-sell'}`}>
                            {pctSince === null ? '—' : `${pctSince >= 0 ? '+' : ''}${pctSince.toFixed(1)}%`}
                          </td>
                          <td className="py-2 pr-3">
                            <a href={r.filing_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary">
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">New 5%+ Holder Filings (Schedule 13D/13G)</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="py-6 text-center text-xs text-muted-foreground">Loading…</p>
            ) : holderFilings.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">No recent 13D/13G filings on tracked tickers. Try running a new scan.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="border-b text-left text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-3">Ticker</th>
                      <th className="py-2 pr-3">Filer</th>
                      <th className="py-2 pr-3">Form</th>
                      <th className="py-2 pr-3">Filing Date</th>
                      <th className="py-2 pr-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {holderFilings.map(r => (
                      <tr key={r.id} className="border-b last:border-0">
                        <td className="py-2 pr-3 font-semibold">{r.ticker}</td>
                        <td className="py-2 pr-3">{r.filer_name}</td>
                        <td className="py-2 pr-3 text-muted-foreground">{r.form_type}</td>
                        <td className="py-2 pr-3">{fmtDate(r.filing_date)}</td>
                        <td className="py-2 pr-3">
                          <a href={r.filing_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary">
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-3 text-[10px] italic text-muted-foreground/70">
              "/A" forms are amendments to a previously filed stake (usually a routine annual update, not necessarily new buying).
              Open the filing to see the full detail — SEC doesn't publish a structured per-share price for these forms.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default InsiderActivity;
