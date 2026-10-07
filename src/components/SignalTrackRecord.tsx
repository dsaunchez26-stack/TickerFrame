import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';

interface TrackRow { horizon: number; source: 'live' | 'replay'; signal: 'buy' | 'hold' | 'sell' | 'all'; n: number; avgReturnPct: number | null; hitRatePct: number | null }
interface TrackRecord {
  rows: TrackRow[];
  liveDays: number; liveFirstDate: string | null;
  replayDays: number; replayFirstDate: string | null; replayLastDate: string | null;
}

const ORDER: TrackRow['signal'][] = ['buy', 'hold', 'sell', 'all'];
const LABEL: Record<TrackRow['signal'], string> = { buy: 'Bullish', hold: 'Neutral', sell: 'Bearish', all: 'All stocks' };
const pct = (v: number | null) => (v == null ? '-' : `${v > 0 ? '+' : ''}${v.toFixed(2)}%`);
const fmtDate = (d: string | null) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '');

const Table = ({ rows, source }: { rows: TrackRow[]; source: 'live' | 'replay' }) => {
  const horizons = [...new Set(rows.filter(r => r.source === source).map(r => r.horizon))].sort((a, b) => a - b);
  if (!horizons.length) return null;
  return (
    <div className="space-y-3">
      {horizons.map(h => {
        const set = rows.filter(r => r.source === source && r.horizon === h);
        return (
          <div key={h}>
            <p className="mb-1 text-[11px] font-semibold text-muted-foreground">{h} trading day{h > 1 ? 's' : ''} later</p>
            <table className="w-full text-xs">
              <thead className="border-b text-left text-muted-foreground">
                <tr>
                  <th className="py-1.5 pr-3">Reading</th>
                  <th className="py-1.5 pr-3 text-right">Readings</th>
                  <th className="py-1.5 pr-3 text-right">Avg move</th>
                  <th className="py-1.5 text-right" title="Bullish: price went up. Bearish: price went down.">Moved the right way</th>
                </tr>
              </thead>
              <tbody>
                {ORDER.map(sig => {
                  const r = set.find(x => x.signal === sig);
                  if (!r) return null;
                  const good = sig === 'buy' ? (r.avgReturnPct ?? 0) > 0 : sig === 'sell' ? (r.avgReturnPct ?? 0) < 0 : null;
                  return (
                    <tr key={sig} className={`border-b last:border-0 ${sig === 'all' ? 'text-muted-foreground' : ''}`}>
                      <td className="py-1.5 pr-3 font-semibold">{LABEL[sig]}</td>
                      <td className="py-1.5 pr-3 text-right">{r.n.toLocaleString()}</td>
                      <td className={`py-1.5 pr-3 text-right font-medium ${good === null ? '' : good ? 'text-signal-buy' : 'text-signal-sell'}`}>{pct(r.avgReturnPct)}</td>
                      <td className="py-1.5 text-right">{r.hitRatePct == null ? '-' : `${r.hitRatePct.toFixed(0)}%`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
};

// The honest answer to "does this signal work?": every day's buy/sell/hold
// call is stored with its price, then compared with what the price actually
// did N trading days later. A useful Buy should beat the "All stocks" row and
// a useful Sell should trail it.
export const SignalTrackRecord = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['signal-track-record'],
    queryFn: async () => {
      const { data: res } = await supabase.rpc('signal_track_record');
      return (res ?? null) as unknown as TrackRecord | null;
    },
    staleTime: 10 * 60_000,
  });

  const hasLive = (data?.rows ?? []).some(r => r.source === 'live');
  const hasReplay = (data?.rows ?? []).some(r => r.source === 'replay');

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Reading Track Record</CardTitle>
        <p className="text-[11px] text-muted-foreground">
          Each day's Bullish / Neutral / Bearish reading is saved with its price, then compared with what the price did afterward. A useful Bullish reading should beat the "All stocks" row, and a useful Bearish one should trail it.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : !data ? (
          <p className="text-xs text-muted-foreground">Track record isn't available right now.</p>
        ) : (
          <>
            <div>
              <h4 className="mb-2 text-xs font-semibold">Live readings{data.liveFirstDate ? ` since ${fmtDate(data.liveFirstDate)}` : ''}</h4>
              {hasLive ? <Table rows={data.rows} source="live" /> : (
                <p className="rounded-md border border-border bg-secondary/20 p-3 text-xs text-muted-foreground">
                  Recording started{data.liveFirstDate ? ` ${fmtDate(data.liveFirstDate)}` : ' today'} ({data.liveDays} trading day{data.liveDays === 1 ? '' : 's'} so far). The first results appear after a day or two of history - these are real, forward-looking readings, so they take real time to mature.
                </p>
              )}
            </div>
            {hasReplay && (
              <div>
                <h4 className="mb-2 text-xs font-semibold">Replay of the last week ({fmtDate(data.replayFirstDate)} - {fmtDate(data.replayLastDate)})</h4>
                <Table rows={data.rows} source="replay" />
                <p className="mt-2 text-[10px] text-muted-foreground">
                  A backtest: today's rule re-run over price samples this site had already collected, so it could be tuned to that week by accident. Only about {data.replayDays} days, one market regime - treat it as a first look, not proof. The live table above is the one to trust as it fills in.
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
