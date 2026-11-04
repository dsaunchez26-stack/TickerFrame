import type { Stock } from '@/lib/mockData';
import { signalLabel } from '@/lib/signalLabel';

const styles = {
  buy: 'text-signal-buy',
  sell: 'text-signal-sell',
  hold: 'text-signal-hold',
};

// The score (-100..+100) is the composite behind the label, so a "hold"
// reads as leaning one way or the other instead of a flat, uninformative tag.
export const SignalBadge = ({ signal, score }: { signal: Stock['signal']; score?: number | null }) => (
  <span
    title={score != null ? `Composite reading score ${score > 0 ? '+' : ''}${score} of ±100 - see Methodology` : undefined}
    className={`status-dot whitespace-nowrap ${styles[signal]}`}
  >
    {signalLabel(signal)}
    {score != null && <span className="font-normal tabular-nums text-muted-foreground">{score > 0 ? '+' : ''}{score}</span>}
  </span>
);
