import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Disclaimer } from '@/components/Disclaimer';

interface FutureRow {
  code: string;
  name: string;
  sector: string;
  symbol: string;
  exchange: string;
  expiration: string;
  tickSize: number | null;
  contractSize: number | null;
  notionalMultiplier: number | null;
  last: number | null;
  bid: number | null;
  ask: number | null;
  prevClose: number | null;
  change: number | null;
  changePercent: number | null;
  updatedAt: string | null;
}

interface ScanResponse {
  rows: FutureRow[];
  quotesError: string | null;
  missingProducts: string[];
  source: string;
  fetchedAt: string;
  error?: string;
}

const fmt = (v: number | null, digits = 2) => (v === null ? '—' : v.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits }));

const Futures = () => {
  const [data, setData] = useState<ScanResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    const { data: res, error: invokeError } = await supabase.functions.invoke('futures-scanner', { body: {} });
    if (invokeError) {
      setError(invokeError.message || 'Futures scan request failed');
      setLoading(false);
      return;
    }
    if (res?.error) {
      setError(String(res.error));
      setLoading(false);
      return;
    }
    setData(res as ScanResponse);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const bySector = useMemo(() => {
    const rows = data?.rows ?? [];
    const groups = new Map<string, FutureRow[]>();
    for (const r of rows) {
      const list = groups.get(r.sector) ?? [];
      list.push(r);
      groups.set(r.sector, list);
    }
    return [...groups.entries()];
  }, [data]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <div className="min-w-0">
            <h1 className="truncate font-heading text-lg font-bold">Futures</h1>
            <p className="text-xs text-muted-foreground">Front-month contract specs and live pricing across major futures, via tastytrade's sandbox API.</p>
          </div>
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-1 h-3 w-3" />}
            Refresh
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        <Disclaimer />
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-200/90">
          <strong className="text-amber-300">Sandbox data.</strong> This is running against tastytrade's sandbox/certification environment, not
          their production API. Contract specs (symbol, expiration, tick size, contract size) are real and current. Live pricing should also be
          real when available, but the sandbox pricing service is a testing environment tastytrade can take down independent of this app —
          if it's unavailable below, that's why.
        </div>
        {error && (
          <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-xs text-rose-300">
            <strong>Error:</strong> {error}
            <button onClick={load} className="ml-2 underline">Retry</button>
          </div>
        )}
        {data?.quotesError && (
          <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-xs text-rose-300">
            <strong>Pricing unavailable:</strong> {data.quotesError} Contract specs below are still accurate.
          </div>
        )}
        {data?.missingProducts && data.missingProducts.length > 0 && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
            <strong>Couldn't load:</strong> {data.missingProducts.join(', ')} — no current contract found for {data.missingProducts.length === 1 ? 'this product' : 'these products'} on this scan. Everything else below loaded normally.
          </div>
        )}
        {loading && !data ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          bySector.map(([sector, rows]) => (
            <Card key={sector}>
              <CardHeader><CardTitle className="text-sm font-semibold">{sector}</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="border-b text-left text-muted-foreground">
                      <tr>
                        <th className="py-2 pr-3">Contract</th>
                        <th className="py-2 pr-3">Symbol</th>
                        <th className="py-2 pr-3">Exchange</th>
                        <th className="py-2 pr-3">Expiration</th>
                        <th className="py-2 pr-3">Tick Size</th>
                        <th className="py-2 pr-3">Contract Size</th>
                        <th className="py-2 pr-3">Last</th>
                        <th className="py-2 pr-3">Bid / Ask</th>
                        <th className="py-2 pr-3">Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(r => (
                        <tr key={r.code} className="border-b last:border-0">
                          <td className="py-2 pr-3 font-semibold">{r.code} <span className="font-normal text-muted-foreground">{r.name}</span></td>
                          <td className="py-2 pr-3 text-muted-foreground">{r.symbol}</td>
                          <td className="py-2 pr-3">{r.exchange}</td>
                          <td className="py-2 pr-3">{r.expiration}</td>
                          <td className="py-2 pr-3">{r.tickSize != null ? `$${r.tickSize}` : '—'}</td>
                          <td className="py-2 pr-3">{r.contractSize ?? '—'}</td>
                          <td className="py-2 pr-3 font-semibold">{r.last != null ? `$${fmt(r.last)}` : '—'}</td>
                          <td className="py-2 pr-3 text-muted-foreground">
                            {r.bid != null && r.ask != null ? `$${fmt(r.bid)} / $${fmt(r.ask)}` : '—'}
                          </td>
                          <td className="py-2 pr-3">
                            {r.change != null && r.changePercent != null ? (
                              <span className={r.change >= 0 ? 'text-signal-buy' : 'text-signal-sell'}>
                                {r.change >= 0 ? '+' : ''}{fmt(r.change)} ({r.changePercent >= 0 ? '+' : ''}{fmt(r.changePercent, 1)}%)
                              </span>
                            ) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ))
        )}
        <Card>
          <CardHeader><CardTitle className="text-sm font-semibold">How this works</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-xs text-muted-foreground">
            <p>Each contract shown is the current front-month (nearest active) expiration for that product, pulled live from tastytrade's own instrument reference data — not hand-maintained or guessed.</p>
            <p><strong className="text-foreground">Tick Size</strong> and <strong className="text-foreground">Contract Size</strong> are real exchange-defined contract specs: tick size is the minimum price increment, contract size is the multiplier applied to price to get the dollar value of one contract.</p>
            <p>This is research/reference data only — not a recommendation to trade futures, which carry substantial risk of loss, often exceeding the amount initially invested.</p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Futures;
