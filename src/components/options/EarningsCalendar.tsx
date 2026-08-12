import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useEarningsCalendar } from '@/hooks/useEarningsCalendar';

const hourLabel = (hour: string | null) => (hour === 'bmo' ? 'BMO' : hour === 'amc' ? 'AMC' : hour === 'dmh' ? 'DMH' : '');

export const EarningsCalendar = () => {
  const { earningsBySymbol, loading } = useEarningsCalendar();

  const upcoming = useMemo(
    () => Array.from(earningsBySymbol.entries())
      .map(([ticker, e]) => ({ ticker, date: e.date, time: hourLabel(e.hour) }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 12),
    [earningsBySymbol],
  );

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm font-semibold">Upcoming Earnings</CardTitle></CardHeader>
      <CardContent>
        <p className="mb-2 text-[10px] text-muted-foreground">
          Real dates from SEC/Finnhub's earnings calendar, tracked universe only — not a full-market calendar.
        </p>
        {loading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : upcoming.length === 0 ? (
          <p className="text-xs text-muted-foreground">No upcoming earnings dates on file yet — try again after the next scan.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {upcoming.map(e => (
              <div key={e.ticker} className="rounded-lg border border-border px-3 py-2 text-xs">
                <div className="font-semibold">{e.ticker}</div>
                <div className="text-muted-foreground">{e.date}{e.time && ` · ${e.time}`}</div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
