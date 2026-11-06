import { useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Loader2 } from 'lucide-react';
import { useStockHistory } from '@/hooks/useStockHistory';
import { erasWithin, historyStats, type LongRange } from '@/lib/longHistory';

interface Props {
  symbol: string;
  range: LongRange;
  height?: number;
}

const LINE = 'hsl(var(--primary))';
const ERA = 'hsl(var(--signal-sell))';

const fmtPct = (v: number, digits = 0) => `${v >= 0 ? '+' : ''}${v.toLocaleString(undefined, { maximumFractionDigits: digits })}%`;
const fmtPrice = (v: number) => `$${v >= 100 ? v.toFixed(0) : v.toFixed(2)}`;
const fmtYear = (t: number) => new Date(t).getUTCFullYear().toString();
const fmtDate = (t: number, monthly: boolean) =>
  new Date(t).toLocaleDateString(undefined, { year: 'numeric', month: 'short', ...(monthly ? {} : { day: 'numeric' }), timeZone: 'UTC' });

export const LongHistoryChart = ({ symbol, range, height = 208 }: Props) => {
  const { points, interval, loading, error } = useStockHistory(symbol, range);
  // Over decades, equal vertical distance should mean equal percentage change, so log is the honest default.
  const [log, setLog] = useState(range === '20Y' || range === 'MAX');
  const [total, setTotal] = useState(false);
  useEffect(() => { setLog(range === '20Y' || range === 'MAX'); }, [range]);

  const stats = useMemo(() => historyStats(points), [points]);
  const eras = useMemo(
    () => (points.length ? erasWithin(points[0].t, points[points.length - 1].t) : []),
    [points],
  );
  const data = useMemo(() => points.map(p => ({ t: p.t, v: total ? p.adj : p.close })), [points, total]);
  const monthly = interval === 'month';

  if (loading) return <div className="flex items-center justify-center" style={{ height }}><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (error || !stats) {
    return (
      <div className="flex flex-col items-center justify-center gap-1 text-center text-xs text-muted-foreground" style={{ height }}>
        <span>{error ?? 'Not enough history for this range.'}</span>
        <span className="text-[10px] text-muted-foreground/70">Try a shorter range.</span>
      </div>
    );
  }

  const stat = (label: string, value: string, tone?: number) => (
    <div className="min-w-0">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className={`text-xs font-semibold tabular-nums ${tone === undefined ? '' : tone >= 0 ? 'text-signal-buy' : 'text-signal-sell'}`}>{value}</div>
    </div>
  );
  const dd = stats.maxDrawdown;

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 border-b border-border pb-2 sm:grid-cols-4">
        {stat(`Since ${fmtYear(points[0].t)}`, fmtPct(total ? stats.totalReturnPct : stats.priceChangePct), total ? stats.totalReturnPct : stats.priceChangePct)}
        {stat('Per year (avg.)', stats.cagrPct === null ? '-' : fmtPct(stats.cagrPct, 1), stats.cagrPct ?? undefined)}
        {stat('Deepest drop', `${dd.pct.toFixed(0)}%`, dd.pct)}
        {stat('Span', `${stats.years.toFixed(stats.years >= 10 ? 0 : 1)} years`)}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          {eras.length > 0 && <><span className="inline-block h-2 w-3 rounded-sm opacity-30" style={{ backgroundColor: ERA }} />market downturns</>}
        </span>
        <span className="flex items-center gap-3">
          <label className="flex cursor-pointer items-center gap-1"><input type="checkbox" checked={log} onChange={e => setLog(e.target.checked)} className="h-3 w-3 accent-[hsl(var(--primary))]" />log scale</label>
          <label className="flex cursor-pointer items-center gap-1"><input type="checkbox" checked={total} onChange={e => setTotal(e.target.checked)} className="h-3 w-3 accent-[hsl(var(--primary))]" />reinvest dividends</label>
        </span>
      </div>

      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="lhFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={LINE} stopOpacity={0.28} />
                <stop offset="100%" stopColor={LINE} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.5} vertical={false} />
            <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={fmtYear}
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} minTickGap={32} />
            <YAxis scale={log ? 'log' : 'auto'} domain={['auto', 'auto']} allowDataOverflow tickFormatter={fmtPrice} width={46}
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
            {eras.map(e => <ReferenceArea key={e.label} x1={e.from} x2={e.to} fill={ERA} fillOpacity={0.12} stroke="none" ifOverflow="hidden" />)}
            <Tooltip
              cursor={{ stroke: 'hsl(var(--muted-foreground))', strokeOpacity: 0.4 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as { t: number; v: number };
                const era = eras.find(e => p.t >= e.from && p.t <= e.to);
                return (
                  <div className="rounded-md border border-border bg-popover px-2 py-1.5 text-[11px] tabular-nums">
                    <div className="font-semibold">{fmtDate(p.t, monthly)}</div>
                    <div>${p.v.toFixed(2)}{total ? ' (dividends reinvested)' : ''}</div>
                    {era && <div className="text-signal-sell">{era.label}</div>}
                  </div>
                );
              }}
            />
            <Area type="monotone" dataKey="v" stroke={LINE} strokeWidth={1.5} fill="url(#lhFill)" dot={false} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <p className="text-[10px] leading-relaxed text-muted-foreground/70">
        {monthly ? 'Month-end' : 'Weekly'} closing prices, adjusted for stock splits so old and new prices compare.
        {total ? ' Shown with dividends reinvested.' : ' Dividends are not included unless you tick "reinvest dividends".'}
        {' '}Past performance does not predict future results; this is for research and education, not advice.
      </p>
    </div>
  );
};
