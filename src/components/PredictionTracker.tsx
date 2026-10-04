import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { useStockData } from '@/hooks/useStockData';

export const PredictionTracker = () => {
  const { data, isLoading } = useStockData();

  const rows = useMemo(() => {
    const signalTier = (s: string) => (s === 'buy' ? 0 : s === 'hold' ? 1 : 2);
    return (data?.stocks ?? [])
      .map(s => {
        // A hold makes no directional call, so it can't be "right" or "wrong".
        const hit = s.signal === 'buy' ? s.change >= 0 : s.signal === 'sell' ? s.change <= 0 : null;
        return { ...s, hit };
      })
      .sort((a, b) => {
        const tierDiff = signalTier(a.signal) - signalTier(b.signal);
        if (tierDiff !== 0) return tierDiff;
        return Math.abs(b.changePercent) - Math.abs(a.changePercent);
      });
  }, [data]);

  // Only buy/sell calls count -- including holds as automatic hits inflated this.
  const called = rows.filter(r => r.hit !== null);
  const hitRate = called.length ? Math.round((called.filter(r => r.hit).length / called.length) * 100) : null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-semibold">Signal Prediction Tracker</CardTitle>
        {hitRate !== null && <span className="text-xs font-semibold text-primary" title="Buy/sell signals only - holds make no call">{hitRate}% of buy/sell calls moving the right way today</span>}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b text-left text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3">Symbol</th>
                  <th className="py-2 pr-3">Signal</th>
                  <th className="py-2 pr-3">Entry</th>
                  <th className="py-2 pr-3">Current</th>
                  <th className="py-2 pr-3">Move since signal</th>
                  <th className="py-2 pr-3">Tracking</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.symbol} className="border-b last:border-0">
                    <td className="py-2 pr-3 font-semibold">{r.symbol}</td>
                    <td className="py-2 pr-3 uppercase">{r.signal}</td>
                    <td className="py-2 pr-3">${r.entry.toFixed(2)}</td>
                    <td className="py-2 pr-3">${r.price.toFixed(2)}</td>
                    <td className={`py-2 pr-3 ${r.change >= 0 ? 'text-signal-buy' : 'text-signal-sell'}`}>{r.changePercent > 0 ? '+' : ''}{r.changePercent.toFixed(2)}%</td>
                    <td className="py-2 pr-3">{r.hit === null ? '-' : r.hit ? '✅ On track' : '⚠️ Off track'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
