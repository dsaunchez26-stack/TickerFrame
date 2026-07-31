import { useEffect, useMemo, useState } from 'react';
import { loadPicks, type TrackedPick } from '@/lib/optionPicks';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Disclaimer } from '@/components/Disclaimer';
import { Loader2 } from 'lucide-react';

const Performance = () => {
  const [picks] = useState<TrackedPick[]>(() => loadPicks());
  const [liveQuotes, setLiveQuotes] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!picks.length) { setLoading(false); return; }
    const contracts = picks.map(p => ({ id: p.id, ticker: p.row.ticker, strike: p.row.strike, expiration: p.row.expiration, cp: p.row.cp }));
    supabase.functions.invoke('option-quotes', { body: { contracts } }).then(({ data }) => {
      const map: Record<string, number> = {};
      for (const q of (data?.quotes ?? []) as Array<{ id: string; price: number }>) {
        if (q.price > 0) map[q.id] = q.price;
      }
      setLiveQuotes(map);
      setLoading(false);
    });
  }, [picks]);

  const enriched = useMemo(() => picks.map(p => {
    // Fall back to the pick-time snapshot only while the live quote hasn't
    // loaded yet -- using it as a permanent "latest price" would make every
    // pick show exactly 0% forever, which is what this page did before.
    const latest = liveQuotes[p.id] ?? p.row.price;
    const pl = latest - p.entryPrice;
    const plPct = p.entryPrice ? (pl / p.entryPrice) * 100 : 0;
    return { ...p, latest, pl, plPct };
  }), [picks, liveQuotes]);

  const stats = useMemo(() => {
    if (!enriched.length) return null;
    const wins = enriched.filter(p => p.pl >= 0).length;
    return { total: enriched.length, wins, winRate: Math.round((wins / enriched.length) * 100) };
  }, [enriched]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Performance</h1>
        <p className="text-xs text-muted-foreground mt-1">Auto-tracked outcomes for every option pick you've flagged.</p>
      </div>
      <Disclaimer />

      {stats && (
        <div className="grid gap-4 grid-cols-3">
          <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Tracked picks</div><div className="text-2xl font-bold">{stats.total}</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Winning</div><div className="text-2xl font-bold text-signal-buy">{stats.wins}</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Win rate</div><div className="text-2xl font-bold">{stats.winRate}%</div></CardContent></Card>
        </div>
      )}

      <Card>
        <CardHeader><CardTitle className="text-sm font-semibold">Tracked pick history</CardTitle></CardHeader>
        <CardContent>
          {picks.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No picks tracked yet. Track a contract from the Options Radar or Calls/Puts pages to see its performance here.
            </p>
          ) : loading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="border-b text-left text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-3">Contract</th>
                    <th className="py-2 pr-3">Picked</th>
                    <th className="py-2 pr-3">Entry price</th>
                    <th className="py-2 pr-3">Latest price</th>
                    <th className="py-2 pr-3">P/L</th>
                  </tr>
                </thead>
                <tbody>
                  {enriched.map(p => (
                    <tr key={p.id} className="border-b last:border-0">
                      <td className="py-2 pr-3 font-semibold">{p.row.ticker} {p.row.cp}{p.row.strike}</td>
                      <td className="py-2 pr-3">{new Date(p.pickedAt).toLocaleDateString()}</td>
                      <td className="py-2 pr-3">${p.entryPrice.toFixed(2)}</td>
                      <td className="py-2 pr-3">${p.latest.toFixed(2)}</td>
                      <td className={`py-2 pr-3 ${p.pl >= 0 ? 'text-signal-buy' : 'text-signal-sell'}`}>{p.pl >= 0 ? '+' : ''}{p.plPct.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Performance;
