import type { Stock } from '@/lib/mockData';

const styles = {
  buy: 'bg-signal-buy/15 text-signal-buy',
  sell: 'bg-signal-sell/15 text-signal-sell',
  hold: 'bg-signal-hold/15 text-signal-hold',
};

// The score (-100..+100) is the composite behind the label, so a "hold"
// reads as leaning one way or the other instead of a flat, uninformative tag.
export const SignalBadge = ({ signal, score }: { signal: Stock['signal']; score?: number | null }) => (
  <span
    title={score != null ? `Composite signal score ${score > 0 ? '+' : ''}${score} of ±100 - see Methodology` : undefined}
    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${styles[signal]}`}
  >
    {signal}
    {score != null && <span className="font-normal opacity-80">{score > 0 ? '+' : ''}{score}</span>}
  </span>
);
