import { useState } from 'react';
import { ComposedChart, Bar, Line, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from 'recharts';
import type { Candle } from '@/lib/candles';

interface Props {
  candles: Candle[];
  height?: number;
  showGrid?: boolean;
  tickInterval?: number;
}

const UP = 'hsl(var(--signal-buy))';
const DOWN = 'hsl(var(--signal-sell))';
const MA_COLOR = '#f0b429';
const BAND_COLOR = '#8b5cf6';

type ChartType = 'candlestick' | 'line';

interface RowData extends Candle {
  ma: number | null;
  bbUpper: number | null;
  bbLower: number | null;
}

const CandleTooltip = ({ active, payload, showBollinger }: { active?: boolean; payload?: Array<{ payload: RowData }>; showBollinger: boolean }) => {
  if (!active || !payload?.length) return null;
  const c = payload[0].payload;
  return (
    <div className="rounded-md border bg-card px-2 py-1.5 text-[11px] shadow-md">
      <div className="mb-0.5 font-semibold">{c.time}</div>
      <div>O ${c.open.toFixed(2)} &nbsp;H ${c.high.toFixed(2)}</div>
      <div>L ${c.low.toFixed(2)} &nbsp;C ${c.close.toFixed(2)}</div>
      {c.ma !== null && <div style={{ color: MA_COLOR }}>MA {c.ma.toFixed(2)}</div>}
      {showBollinger && c.bbUpper !== null && c.bbLower !== null && (
        <div style={{ color: BAND_COLOR }}>Bands {c.bbLower.toFixed(2)} – {c.bbUpper.toFixed(2)}</div>
      )}
    </div>
  );
};

// Recharts has no native candlestick chart. Candles are drawn as two Bar
// series stacked at the same x-position (barGap="-100%"): a thin full-
// height wick (low-to-high) and a thicker body (open-to-close), each
// colored per-candle via Cell. A moving-average line and a dashed "last
// close" reference line ride on top -- candles alone (no trend line, no
// price anchor) read as noisy and directionless at a glance, especially
// once there are 30+ tightly-packed bars. Chart type (candlestick vs.
// line) and a Bollinger Bands overlay are user-toggleable rather than
// always-on, since bands add real visual clutter on a short/choppy series.
export const CandlestickChart = ({ candles, height = 220, showGrid = true, tickInterval }: Props) => {
  const [chartType, setChartType] = useState<ChartType>('candlestick');
  const [showBollinger, setShowBollinger] = useState(false);

  // Adapts to however many candles are actually available (as few as ~15 in
  // some views) rather than a fixed period that would be meaningless -- or
  // entirely absent for the first N bars -- on a short series.
  const maPeriod = Math.max(3, Math.min(10, Math.floor(candles.length / 3)));
  // Bollinger Bands conventionally use a 20-period SMA -- scaled down the
  // same way for short series, with a slightly larger floor since a band
  // width computed from too few points is more misleading than a missing
  // line would be.
  const bbPeriod = Math.max(5, Math.min(20, Math.floor(candles.length / 2)));

  const data: RowData[] = candles.map((c, i) => {
    const maSlice = candles.slice(Math.max(0, i - maPeriod + 1), i + 1);
    const ma = maSlice.length >= maPeriod
      ? maSlice.reduce((sum, w) => sum + w.close, 0) / maSlice.length
      : null;

    const bbSlice = candles.slice(Math.max(0, i - bbPeriod + 1), i + 1);
    let bbUpper: number | null = null;
    let bbLower: number | null = null;
    if (bbSlice.length >= bbPeriod) {
      const mean = bbSlice.reduce((sum, w) => sum + w.close, 0) / bbSlice.length;
      const variance = bbSlice.reduce((sum, w) => sum + (w.close - mean) ** 2, 0) / bbSlice.length;
      const stdDev = Math.sqrt(variance);
      bbUpper = mean + 2 * stdDev;
      bbLower = mean - 2 * stdDev;
    }

    return {
      ...c,
      wickRange: [c.low, c.high] as [number, number],
      bodyRange: [Math.min(c.open, c.close), Math.max(c.open, c.close)] as [number, number],
      up: c.close >= c.open,
      ma,
      bbUpper,
      bbLower,
    };
  });
  const lastClose = candles.length ? candles[candles.length - 1].close : null;

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <div className="flex items-center gap-1 rounded-md border border-border p-0.5 text-[10px]">
          <button
            onClick={() => setChartType('candlestick')}
            className={`rounded px-2 py-0.5 ${chartType === 'candlestick' ? 'bg-secondary font-semibold' : 'text-muted-foreground'}`}
          >
            Candles
          </button>
          <button
            onClick={() => setChartType('line')}
            className={`rounded px-2 py-0.5 ${chartType === 'line' ? 'bg-secondary font-semibold' : 'text-muted-foreground'}`}
          >
            Line
          </button>
        </div>
        <button
          onClick={() => setShowBollinger(v => !v)}
          className={`rounded-md border border-border px-2 py-0.5 text-[10px] ${showBollinger ? 'bg-secondary font-semibold' : 'text-muted-foreground'}`}
        >
          Bollinger Bands
        </button>
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} barGap="-100%" barCategoryGap="20%">
          {showGrid && <CartesianGrid strokeDasharray="3 3" opacity={0.15} />}
          <XAxis dataKey="time" tick={{ fontSize: 10 }} interval={tickInterval} />
          <YAxis
            domain={['auto', 'auto']}
            tick={{ fontSize: 10 }}
            width={50}
            // A near-flat series (e.g. a stock with only a couple of real
            // samples so far) can make Recharts auto-compute a domain with
            // a floating-point sliver of a range, producing garbled ticks
            // like "309.34999999997" -- rounding for display sidesteps
            // that regardless of how tight the underlying range is.
            tickFormatter={(v: number) => v.toFixed(2)}
          />
          <Tooltip content={<CandleTooltip showBollinger={showBollinger} />} />
          {lastClose !== null && (
            <ReferenceLine
              y={lastClose}
              stroke="hsl(var(--muted-foreground))"
              strokeDasharray="4 4"
              strokeOpacity={0.6}
              label={{ value: `$${lastClose.toFixed(2)}`, position: 'right', fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
            />
          )}
          {chartType === 'candlestick' ? (
            <>
              <Bar dataKey="wickRange" barSize={1.5} isAnimationActive={false}>
                {data.map((d, i) => <Cell key={i} fill={d.up ? UP : DOWN} />)}
              </Bar>
              <Bar dataKey="bodyRange" barSize={7} isAnimationActive={false}>
                {data.map((d, i) => <Cell key={i} fill={d.up ? UP : DOWN} />)}
              </Bar>
            </>
          ) : (
            <Line dataKey="close" stroke="hsl(var(--primary))" strokeWidth={1.5} dot={false} isAnimationActive={false} />
          )}
          <Line dataKey="ma" stroke={MA_COLOR} strokeWidth={1.5} dot={false} isAnimationActive={false} connectNulls />
          {showBollinger && (
            <>
              <Line dataKey="bbUpper" stroke={BAND_COLOR} strokeWidth={1} strokeDasharray="3 3" dot={false} isAnimationActive={false} connectNulls />
              <Line dataKey="bbLower" stroke={BAND_COLOR} strokeWidth={1} strokeDasharray="3 3" dot={false} isAnimationActive={false} connectNulls />
            </>
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};
