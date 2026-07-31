import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PatternBadge } from '@/components/PatternBadge';

interface ChainRow {
  id: string;
  ticker: string;
  cp: 'C' | 'P';
  strike: number;
  price: number;
  bid: number;
  ask: number;
  delta: number;
  volume: number;
  oi: number;
  breakeven: number;
  withinExpectedMove: boolean | null;
}

interface LookupResult {
  symbol: string;
  spot: number;
  expirations: string[];
  expiration: string;
  expectedMovePct: number | null;
  pattern: string | null;
  patternConfidence: number | null;
  rows: ChainRow[];
  error?: string;
}

export const OptionChainLookup = () => {
  const [symbol, setSymbol] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LookupResult | null>(null);

  const runLookup = async (sym: string, expiration?: string) => {
    if (!sym) return;
    setLoading(true);
    const { data, error } = await supabase.functions.invoke('option-chain-lookup', { body: { symbol: sym, expiration } });
    if (error) {
      setResult({ symbol: sym, spot: 0, expirations: [], expiration: '', expectedMovePct: null, pattern: null, patternConfidence: null, rows: [], error: error.message });
    } else {
      setResult(data as LookupResult);
    }
    setLoading(false);
  };

  const calls = result?.rows.filter(r => r.cp === 'C') ?? [];
  const puts = result?.rows.filter(r => r.cp === 'P') ?? [];

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm font-semibold">Option Chain Lookup</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-[11px] text-muted-foreground">
          Look up any optionable ticker directly — not limited to the tracked list the scanner ranks against, so a
          low-scoring or thinly-traded name (like a cheap stock the scanner didn't surface today) still shows up here.
        </p>
        <div className="flex gap-2">
          <Input
            value={symbol}
            onChange={e => setSymbol(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && runLookup(symbol)}
            placeholder="Enter ticker, e.g. PLUG"
            className="h-8 text-xs"
          />
          <Button size="sm" className="h-8" onClick={() => runLookup(symbol)} disabled={!symbol || loading}>
            {loading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Search className="mr-1 h-3.5 w-3.5" />}
            Lookup
          </Button>
        </div>

        {result?.error && (
          <p className="text-xs text-signal-sell">{result.error}</p>
        )}

        {result && !result.error && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className="font-heading text-sm font-bold">{result.symbol}</span>
              <span>${result.spot.toFixed(2)}</span>
              {result.pattern && <PatternBadge pattern={result.pattern} confidence={result.patternConfidence ?? undefined} size="xs" />}
              {result.expectedMovePct != null && (
                <span className="text-muted-foreground">Expected move by this expiration: ±{result.expectedMovePct.toFixed(1)}%</span>
              )}
              <Select value={result.expiration} onValueChange={(v) => runLookup(result.symbol, v)}>
                <SelectTrigger className="h-7 w-36 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {result.expirations.map(exp => <SelectItem key={exp} value={exp}>{exp}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <div className="mb-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">Calls</div>
                <div className="max-h-80 overflow-y-auto overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="border-b text-left text-muted-foreground sticky top-0 bg-card">
                      <tr>
                        <th className="py-1.5 pr-2">Strike</th>
                        <th className="py-1.5 pr-2">Bid/Ask</th>
                        <th className="py-1.5 pr-2">Δ</th>
                        <th className="py-1.5 pr-2">Vol/OI</th>
                        <th className="py-1.5 pr-2">Breakeven</th>
                        <th className="py-1.5 pr-2">vs Expected Move</th>
                      </tr>
                    </thead>
                    <tbody>
                      {calls.map(r => (
                        <tr key={r.id} className={`border-b last:border-0 ${r.strike > result.spot ? '' : 'bg-secondary/20'}`}>
                          <td className="py-1.5 pr-2 font-semibold">${r.strike}</td>
                          <td className="py-1.5 pr-2">${r.bid.toFixed(2)}/${r.ask.toFixed(2)}</td>
                          <td className="py-1.5 pr-2">{r.delta.toFixed(2)}</td>
                          <td className="py-1.5 pr-2">{r.volume}/{r.oi}</td>
                          <td className="py-1.5 pr-2">${r.breakeven.toFixed(2)}</td>
                          <td className="py-1.5 pr-2">
                            {r.withinExpectedMove === null ? (
                              <span className="text-muted-foreground">—</span>
                            ) : r.withinExpectedMove ? (
                              <span className="text-signal-hold">Within</span>
                            ) : (
                              <span className="text-signal-buy">Beyond</span>
                            )}
                          </td>
                        </tr>
                      ))}
                      {calls.length === 0 && <tr><td colSpan={6} className="py-3 text-center text-muted-foreground">No call contracts found.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
              <div>
                <div className="mb-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">Puts</div>
                <div className="max-h-80 overflow-y-auto overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="border-b text-left text-muted-foreground sticky top-0 bg-card">
                      <tr>
                        <th className="py-1.5 pr-2">Strike</th>
                        <th className="py-1.5 pr-2">Bid/Ask</th>
                        <th className="py-1.5 pr-2">Δ</th>
                        <th className="py-1.5 pr-2">Vol/OI</th>
                        <th className="py-1.5 pr-2">Breakeven</th>
                        <th className="py-1.5 pr-2">vs Expected Move</th>
                      </tr>
                    </thead>
                    <tbody>
                      {puts.map(r => (
                        <tr key={r.id} className={`border-b last:border-0 ${r.strike < result.spot ? '' : 'bg-secondary/20'}`}>
                          <td className="py-1.5 pr-2 font-semibold">${r.strike}</td>
                          <td className="py-1.5 pr-2">${r.bid.toFixed(2)}/${r.ask.toFixed(2)}</td>
                          <td className="py-1.5 pr-2">{r.delta.toFixed(2)}</td>
                          <td className="py-1.5 pr-2">{r.volume}/{r.oi}</td>
                          <td className="py-1.5 pr-2">${r.breakeven.toFixed(2)}</td>
                          <td className="py-1.5 pr-2">
                            {r.withinExpectedMove === null ? (
                              <span className="text-muted-foreground">—</span>
                            ) : r.withinExpectedMove ? (
                              <span className="text-signal-hold">Within</span>
                            ) : (
                              <span className="text-signal-buy">Beyond</span>
                            )}
                          </td>
                        </tr>
                      ))}
                      {puts.length === 0 && <tr><td colSpan={6} className="py-3 text-center text-muted-foreground">No put contracts found.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <p className="text-[10px] italic text-muted-foreground/70">
              Shaded rows are in-the-money. "Breakeven" is the stock price this specific contract needs to reach by
              expiration just to break even if bought at its current price — not a target or a prediction.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
