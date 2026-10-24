import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface FactorRow { name: string; ic5: number; t5: number; ic20: number; t20: number; ic60: number; t60: number }
interface Result {
  run_at: string; universe_size: number; start_date: string; end_date: string;
  factors: { rows: FactorRow[] };
  insider: {
    events: number; source?: string; newestFiling?: string;
    groups?: Record<string, Record<string, { n: number; days?: number; meanExcessPct?: number; t?: number; beatMarketPct?: number }>>;
    horizons?: Record<string, { n: number; meanExcessPct?: number; t?: number; beatMarketPct?: number }>;
  } | null;
  fundamentals: { status: string; snapshots: number; firstSnapshot: string | null } | null;
}

const LABELS: Record<string, string> = {
  score: 'The Bullish / Bearish score',
  trend_pillar: 'Trend pillar alone',
  momentum_pillar: 'Momentum pillar alone',
  stretch_pillar: 'Stretch pillar alone (RSI, Bollinger)',
  mom_252_21: '12-month price momentum',
  mom_126_21: '6-month price momentum',
  rev_21: 'Last month reversed (buy last month\'s losers)',
  lowvol_60: 'Low volatility',
  near_high_252: 'Closeness to the 52-week high',
};
const SHOW = Object.keys(LABELS);

// The latest quarterly test, straight from the database - published whatever it says.
export const BacktestEvidence = () => {
  const { data } = useQuery({
    queryKey: ['backtest-latest'],
    staleTime: 60 * 60_000,
    queryFn: async () => {
      const { data: rows } = await supabase.from('backtest_results').select('*').order('run_at', { ascending: false }).limit(1);
      return ((rows ?? [])[0] ?? null) as unknown as Result | null;
    },
  });
  if (!data) return null;
  const rows = SHOW.map((k) => data.factors.rows.find((r) => r.name === k)).filter((r): r is FactorRow => !!r);
  const date = new Date(data.run_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  const g = data.insider?.groups;
  const all60 = g?.all?.['60'];
  const big60 = g?.officers_directors_over_100k?.['60'];

  return (
    <div className="rounded-md border border-border bg-secondary/20 p-3 text-xs">
      <p className="mb-2 font-semibold text-foreground">Latest test: {date}</p>
      <p className="mb-2">{data.universe_size} U.S. stocks, {data.start_date} to {data.end_date}. Each row shows how closely the signal lined up with which stocks did better than average over the next 20 trading days (0 means no relationship; a t-stat of 2 or more is the usual bar for "not just luck").</p>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="border-b text-left text-muted-foreground"><tr><th className="py-1 pr-3">Signal</th><th className="py-1 pr-3 text-right">Relationship</th><th className="py-1 text-right">t-stat</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name} className="border-b last:border-0">
                <td className="py-1 pr-3">{LABELS[r.name]}</td>
                <td className="py-1 pr-3 text-right tabular-nums">{r.ic20 > 0 ? '+' : ''}{r.ic20.toFixed(3)}</td>
                <td className={`py-1 text-right tabular-nums ${Math.abs(r.t20) >= 2 ? 'font-semibold text-foreground' : ''}`}>{r.t20.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2">
        Insider purchases: {all60?.n ? `across ${all60.n} open-market purchases (${data.insider?.source ?? 'SEC filings'}), the average stock bought by insiders gained ${all60.meanExcessPct}% more than the average stock over the next 60 trading days, but only ${all60.beatMarketPct}% of them beat the market and the result is not statistically distinguishable from luck (t ${all60.t}); purchases of $100,000 or more by officers and directors averaged ${big60?.meanExcessPct ?? 0}% (t ${big60?.t ?? 0}).` : 'not enough events with follow-up yet.'}{' '}
        Company financials: {data.fundamentals?.status === 'ok' ? 'see the Handbook for results.' : `not testable yet - weekly snapshots started ${data.fundamentals?.firstSnapshot ?? 'recently'} and need a few months to accumulate.`}
        {' '}This test re-runs every quarter and the newest result replaces this one.
      </p>
    </div>
  );
};
