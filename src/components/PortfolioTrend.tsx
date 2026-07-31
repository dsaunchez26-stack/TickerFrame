import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Info } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Snapshot { total_value: number; total_invested: number; pnl_pct: number; captured_at: string }

interface Props {
  userId: string;
  portfolioName: string;
}

export const PortfolioTrend = ({ userId, portfolioName }: Props) => {
  const [snapshots, setSnapshots] = useState<Snapshot[] | null>(null);

  useEffect(() => {
    let alive = true;
    supabase
      .from('portfolio_snapshots')
      .select('total_value, total_invested, pnl_pct, captured_at')
      .eq('user_id', userId)
      .eq('portfolio_name', portfolioName)
      // Order descending + limit to actually get the newest 200 snapshots
      // (ascending + limit here would return the OLDEST 200 once a portfolio
      // has tracked more than 200 days, silently freezing "latest" at a
      // stale historical value instead of today's), then reverse back to
      // chronological order for the trend math below.
      .order('captured_at', { ascending: false })
      .limit(200)
      .then(({ data }) => { if (alive) setSnapshots(((data ?? []) as Snapshot[]).reverse()); });
    return () => { alive = false; };
  }, [userId, portfolioName]);

  if (!snapshots) return null;

  if (snapshots.length < 2) {
    return (
      <div className="mb-3 flex items-start gap-2 rounded-md border border-border/60 p-3 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
        <span>Started tracking daily value today — trend comparisons will show up here as history builds. We have no record of what this portfolio was worth before today, so there's nothing to compare against yet.</span>
      </div>
    );
  }

  const latest = snapshots[snapshots.length - 1];
  const first = snapshots[0];
  const daysSpan = Math.max(0.04, (new Date(latest.captured_at).getTime() - new Date(first.captured_at).getTime()) / 86400_000);

  const findClosestTo = (daysAgo: number) => {
    const targetMs = Date.now() - daysAgo * 86400_000;
    return snapshots.reduce((best, s) =>
      Math.abs(new Date(s.captured_at).getTime() - targetMs) < Math.abs(new Date(best.captured_at).getTime() - targetMs) ? s : best,
      snapshots[0]);
  };

  // Deliberately backward-looking only -- this reports what the portfolio's
  // value actually did, using real recorded snapshots. No projection, pace
  // illustration, or extrapolation of any kind: forward-looking performance
  // figures are genuinely regulated territory (SEC/FINRA rules on
  // performance advertising apply real scrutiny, disclaimers or not), and
  // this app is explicitly not a licensed advisor. Facts about the past
  // only.
  const comparisons = [7, 30]
    .filter(d => daysSpan >= d * 0.6)
    .map(d => {
      const then = findClosestTo(d);
      const diff = latest.total_value - then.total_value;
      const diffPct = then.total_value > 0 ? (diff / then.total_value) * 100 : 0;
      return { label: d === 7 ? 'vs 7 days ago' : 'vs 30 days ago', diff, diffPct };
    });

  return (
    <div className="mb-3 space-y-2 rounded-md border border-border/60 p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Trend</div>
      {comparisons.length === 0 ? (
        <p className="text-xs text-muted-foreground">Not enough history yet for a 7-day comparison — check back soon.</p>
      ) : (
        comparisons.map(c => (
          <div key={c.label} className="flex items-center gap-2 text-xs">
            {c.diff >= 0 ? <TrendingUp className="h-3 w-3 text-signal-buy" /> : <TrendingDown className="h-3 w-3 text-signal-sell" />}
            <span className="text-muted-foreground">{c.label}:</span>
            <span className={c.diff >= 0 ? 'text-signal-buy' : 'text-signal-sell'}>
              {c.diff >= 0 ? '+' : ''}${c.diff.toFixed(0)} ({c.diffPct >= 0 ? '+' : ''}{c.diffPct.toFixed(1)}%)
            </span>
          </div>
        ))
      )}
    </div>
  );
};
