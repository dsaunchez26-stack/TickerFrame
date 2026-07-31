import { BarChart, Bar, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import type { Candle } from '@/lib/candles';

interface Props {
  candles: Candle[];
  height?: number;
  showGrid?: boolean;
  tickInterval?: number;
}

const UP = 'hsl(var(--signal-buy))';
const DOWN = 'hsl(var(--signal-sell))';

const CandleTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: Candle }> }) => {
  if (!active || !payload?.length) return null;
  const c = payload[0].payload;
  return (
    <div className="rounded-md border bg-card px-2 py-1.5 text-[11px] shadow-md">
      <div className="mb-0.5 font-semibold">{c.time}</div>
      <div>O ${c.open.toFixed(2)} &nbsp;H ${c.high.toFixed(2)}</div>
      <div>L ${c.low.toFixed(2)} &nbsp;C ${c.close.toFixed(2)}</div>
    </div>
  );
};

// Recharts has no native candlestick chart. This overlays two Bar series at the
// same x-position (barGap="-100%" makes them stack on top of each other instead
// of side-by-side): a thin full-height wick (low-to-high) and a thicker body
// (open-to-close), each colored per-candle via Cell.
export const CandlestickChart = ({ candles, height = 220, showGrid = true, tickInterval }: Props) => {
  const data = candles.map(c => ({
    ...c,
    wickRange: [c.low, c.high] as [number, number],
    bodyRange: [Math.min(c.open, c.close), Math.max(c.open, c.close)] as [number, number],
    up: c.close >= c.open,
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} barGap="-100%" barCategoryGap="20%">
        {showGrid && <CartesianGrid strokeDasharray="3 3" opacity={0.15} />}
        <XAxis dataKey="time" tick={{ fontSize: 10 }} interval={tickInterval} />
        <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10 }} width={50} />
        <Tooltip content={<CandleTooltip />} />
        <Bar dataKey="wickRange" barSize={1.5} isAnimationActive={false}>
          {data.map((d, i) => <Cell key={i} fill={d.up ? UP : DOWN} />)}
        </Bar>
        <Bar dataKey="bodyRange" barSize={7} isAnimationActive={false}>
          {data.map((d, i) => <Cell key={i} fill={d.up ? UP : DOWN} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};
