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

const CandleTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: Candle & { ma: number | null } }> }) => {
  if (!active || !payload?.length) return null;
  const c = payload[0].payload;
  return (
    <div className="rounded-md border bg-card px-2 py-1.5 text-[11px] shadow-md">
      <div className="mb-0.5 font-semibold">{c.time}</div>
      <div>O ${c.open.toFixed(2)} &nbsp;H ${c.high.toFixed(2)}</div>
      <div>L ${c.low.toFixed(2)} &nbsp;C ${c.close.toFixed(2)}</div>
      {c.ma !== null && <div style={{ color: MA_COLOR }}>MA {c.ma.toFixed(2)}</div>}
    </div>
  );
};

// Recharts has no native candlestick chart. This overlays two Bar series at the
// same x-position (barGap="-100%" makes them stack on top of each other instead
// of side-by-side): a thin full-height wick (low-to-high) and a thicker body
// (open-to-close), each colored per-candle via Cell. A moving-average line and
// a dashed "last close" reference line ride on top of the same ComposedChart --
// candles alone (no trend line, no price anchor) read as noisy and directionless
// at a glance, especially once there are 30+ tightly-packed bars.
export const CandlestickChart = ({ candles, height = 220, showGrid = true, tickInterval }: Props) => {
  // Adapts to however many candles are actually available (as few as ~15 in
  // some views) rather than a fixed period that would be meaningless -- or
  // entirely absent for the first N bars -- on a short series.
  const maPeriod = Math.max(3, Math.min(10, Math.floor(candles.length / 3)));

  const data = candles.map((c, i) => {
    const windowSlice = candles.slice(Math.max(0, i - maPeriod + 1), i + 1);
    const ma = windowSlice.length >= maPeriod
      ? windowSlice.reduce((sum, w) => sum + w.close, 0) / windowSlice.length
      : null;
    return {
      ...c,
      wickRange: [c.low, c.high] as [number, number],
      bodyRange: [Math.min(c.open, c.close), Math.max(c.open, c.close)] as [number, number],
      up: c.close >= c.open,
      ma,
    };
  });
  const lastClose = candles.length ? candles[candles.length - 1].close : null;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} barGap="-100%" barCategoryGap="20%">
        {showGrid && <CartesianGrid strokeDasharray="3 3" opacity={0.15} />}
        <XAxis dataKey="time" tick={{ fontSize: 10 }} interval={tickInterval} />
        <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10 }} width={50} />
        <Tooltip content={<CandleTooltip />} />
        {lastClose !== null && (
          <ReferenceLine
            y={lastClose}
            stroke="hsl(var(--muted-foreground))"
            strokeDasharray="4 4"
            strokeOpacity={0.6}
            label={{ value: `$${lastClose.toFixed(2)}`, position: 'right', fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
          />
        )}
        <Bar dataKey="wickRange" barSize={1.5} isAnimationActive={false}>
          {data.map((d, i) => <Cell key={i} fill={d.up ? UP : DOWN} />)}
        </Bar>
        <Bar dataKey="bodyRange" barSize={7} isAnimationActive={false}>
          {data.map((d, i) => <Cell key={i} fill={d.up ? UP : DOWN} />)}
        </Bar>
        <Line dataKey="ma" stroke={MA_COLOR} strokeWidth={1.5} dot={false} isAnimationActive={false} connectNulls />
      </ComposedChart>
    </ResponsiveContainer>
  );
};
