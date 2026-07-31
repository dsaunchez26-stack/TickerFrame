import { useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { useStockData } from '@/hooks/useStockData';
import { useStockDetail } from '@/context/StockDetailContext';
import { PatternBadge } from '@/components/PatternBadge';
import { getPatternMeta, ALL_PATTERNS } from '@/lib/patterns';
import { Disclaimer } from '@/components/Disclaimer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const Patterns = () => {
  const { data, isLoading } = useStockData();
  const { open } = useStockDetail();

  const withPatterns = useMemo(
    () => (data?.stocks ?? []).filter(s => getPatternMeta(s.pattern)),
    [data],
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Pattern Hub</h1>
        <p className="text-xs text-muted-foreground mt-1">Every chart pattern currently detected across the tracked universe.</p>
      </div>
      <Disclaimer />

      <Card>
        <CardHeader><CardTitle className="text-sm font-semibold">Active patterns</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : withPatterns.length === 0 ? (
            <p className="text-xs text-muted-foreground">No patterns currently detected. Check back after the next scan.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {withPatterns.map(s => (
                <div
                  key={s.symbol}
                  onClick={() => open(s.symbol)}
                  className="cursor-pointer rounded-lg border border-border p-3 hover:border-primary/40 hover:bg-secondary/40"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-heading text-sm font-semibold">{s.symbol}</span>
                    <span className="text-xs text-muted-foreground">${s.price.toFixed(2)}</span>
                  </div>
                  <div className="mt-2">
                    <PatternBadge pattern={s.pattern} confidence={s.patternConfidence} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm font-semibold">Pattern glossary</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(ALL_PATTERNS).map(([key, meta]) => (
              <div key={key} className="rounded-lg border border-border p-3">
                <div className="flex items-center gap-2">
                  <meta.icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-semibold">{meta.label}</span>
                  <span className={`ml-auto text-[10px] uppercase font-semibold ${meta.bias === 'bullish' ? 'text-signal-buy' : meta.bias === 'bearish' ? 'text-signal-sell' : 'text-muted-foreground'}`}>{meta.bias}</span>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">{meta.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Patterns;
