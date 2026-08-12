import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Loader2, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { OptionRiskMath } from '@/components/tools/OptionRiskMath';

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
  rows: ChainRow[];
  error?: string;
}

export const OptionRiskCalculator = () => {
  const [ticker, setTicker] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LookupResult | null>(null);
  const [side, setSide] = useState<'C' | 'P'>('C');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const runLookup = async (sym: string, expiration?: string) => {
    if (!sym) return;
    setLoading(true);
    setError(null);
    const { data, error: invokeError } = await supabase.functions.invoke('option-chain-lookup', { body: { symbol: sym, expiration } });
    setLoading(false);
    if (invokeError || data?.error) {
      setError(invokeError?.message || data?.error || `No option chain found for ${sym}.`);
      setResult(null);
      return;
    }
    setResult(data as LookupResult);
    setSelectedId(null);
  };

  const rowsForSide = useMemo(() => (result?.rows ?? []).filter(r => r.cp === side), [result, side]);
  const selectedRow = useMemo(() => rowsForSide.find(r => r.id === selectedId) ?? null, [rowsForSide, selectedId]);

  // Ask is what you'd actually pay to buy right now; falls back to last
  // trade price when there's no live ask (thin/no market).
  const premium = selectedRow ? (selectedRow.ask > 0 ? selectedRow.ask : selectedRow.price) : 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-sm font-semibold">1. Pick a contract</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={ticker}
              onChange={e => setTicker(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && runLookup(ticker)}
              placeholder="Ticker, e.g. SOFI"
              className="h-9 max-w-40"
            />
            <Button size="sm" onClick={() => runLookup(ticker)} disabled={!ticker || loading}>
              {loading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Search className="mr-1 h-3.5 w-3.5" />}
              Load Chain
            </Button>
            {result && !result.error && (
              <>
                <ToggleGroup
                  type="single"
                  value={side}
                  onValueChange={v => {
                    if (!v) return;
                    setSide(v as 'C' | 'P');
                    setSelectedId(null);
                  }}
                  size="sm"
                >
                  <ToggleGroupItem value="C">Calls</ToggleGroupItem>
                  <ToggleGroupItem value="P">Puts</ToggleGroupItem>
                </ToggleGroup>
                <Select value={result.expiration} onValueChange={v => runLookup(result.symbol, v)}>
                  <SelectTrigger className="h-9 w-36 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {result.expirations.map(exp => <SelectItem key={exp} value={exp}>{exp}</SelectItem>)}
                  </SelectContent>
                </Select>
              </>
            )}
          </div>
          {error && <p className="text-xs text-signal-sell">{error}</p>}
          {result && !result.error && (
            <>
              <p className="text-xs text-muted-foreground">
                {result.symbol} spot: <span className="font-semibold text-foreground">${result.spot.toFixed(2)}</span>
                {result.expectedMovePct != null && <> · expected move by expiration: ±{result.expectedMovePct.toFixed(1)}%</>}
              </p>
              <Select value={selectedId ?? undefined} onValueChange={setSelectedId}>
                <SelectTrigger className="h-9 max-w-xs text-xs"><SelectValue placeholder="Select a strike" /></SelectTrigger>
                <SelectContent>
                  {rowsForSide.map(r => (
                    <SelectItem key={r.id} value={r.id}>
                      ${r.strike} {r.cp === 'C' ? 'call' : 'put'} — bid ${r.bid.toFixed(2)} / ask ${r.ask.toFixed(2)}
                    </SelectItem>
                  ))}
                  {rowsForSide.length === 0 && <div className="px-2 py-1.5 text-xs text-muted-foreground">No contracts for this side.</div>}
                </SelectContent>
              </Select>
            </>
          )}
        </CardContent>
      </Card>

      {selectedRow && result && (
        <OptionRiskMath
          ticker={result.symbol}
          cp={side}
          strike={selectedRow.strike}
          spot={result.spot}
          premium={premium}
          expiration={result.expiration}
          titles={{ position: '2. Set your position', math: '3. The math' }}
        />
      )}
    </div>
  );
};
