import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TICKER_LIST } from '@/lib/optionsMockData';

export const EarningsCalendar = () => {
  const upcoming = useMemo(() => {
    return TICKER_LIST.slice(0, 8).map((t, i) => {
      const date = new Date();
      date.setDate(date.getDate() + ((i + 1) * 3));
      return { ticker: t.t, date: date.toISOString().slice(0, 10), time: i % 2 === 0 ? 'BMO' : 'AMC' };
    });
  }, []);

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm font-semibold">Upcoming Earnings</CardTitle></CardHeader>
      <CardContent>
        <p className="mb-2 text-[10px] text-muted-foreground">Example dates — connect a real earnings-calendar API for live data.</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {upcoming.map(e => (
            <div key={e.ticker} className="rounded-lg border border-border px-3 py-2 text-xs">
              <div className="font-semibold">{e.ticker}</div>
              <div className="text-muted-foreground">{e.date} · {e.time}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
