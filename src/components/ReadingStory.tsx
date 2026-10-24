import { useMemo } from 'react';
import type { Stock } from '@/lib/mockData';
import { buildReadingStory, type FundamentalsInput } from '@/lib/readingStory';
import type { LongTermContext } from '@/lib/longTerm';
import { SignalBadge } from '@/components/SignalBadge';

const dot = { bullish: 'bg-signal-buy', bearish: 'bg-signal-sell', neutral: 'bg-signal-hold' } as const;

// The same reading, in sentences: what is happening, which part is short-term
// price action versus the company's financials, and what would change it.
export const ReadingStory = ({ stock, fundamentals, longTerm = null, compact = false, onMore }: { stock: Stock; fundamentals: FundamentalsInput | null; longTerm?: LongTermContext | null; compact?: boolean; onMore?: () => void }) => {
  const story = useMemo(() => buildReadingStory(stock, fundamentals, longTerm), [stock, fundamentals, longTerm]);
  if (!story) return null;

  if (compact) {
    return (
      <div className="flex items-start justify-between gap-3 rounded-lg border border-border bg-card p-3">
        <div className="flex items-start gap-2">
          <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dot[story.tone]}`} />
          <div>
            <p className="text-sm font-semibold leading-snug">{story.headline}</p>
            {onMore && <button onClick={onMore} className="mt-1 text-xs text-primary underline">See why</button>}
          </div>
        </div>
        <SignalBadge signal={stock.signal} score={stock.signalScore} />
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-3 text-xs">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${dot[story.tone]}`} />
          <p className="text-sm font-semibold leading-snug">{story.headline}</p>
        </div>
        <SignalBadge signal={stock.signal} score={stock.signalScore} />
      </div>

      <div className="space-y-3">
        <div>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Short term - what the price is doing</div>
          <ul className="ml-4 list-disc space-y-1 text-muted-foreground">
            {story.shortTerm.map((t, i) => <li key={i}>{t}</li>)}
          </ul>
        </div>

        {story.pastYear && (
          <div>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Past year - how the stock has traded</div>
            <ul className="ml-4 list-disc space-y-1 text-muted-foreground">
              {story.pastYear.map((t, i) => <li key={i}>{t}</li>)}
            </ul>
          </div>
        )}

        {story.longTerm && (
          <div>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Longer term - how the company looks</div>
            <ul className="ml-4 list-disc space-y-1 text-muted-foreground">
              {story.longTerm.map((t, i) => <li key={i}>{t}</li>)}
            </ul>
          </div>
        )}

        {story.conflict && <p className="rounded-md bg-secondary/40 p-2 text-muted-foreground">{story.conflict}</p>}

        {story.flips.length > 0 && (
          <div>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">What would change this reading</div>
            <ul className="ml-4 list-disc space-y-1 text-muted-foreground">
              {story.flips.map((t, i) => <li key={i}>{t}</li>)}
            </ul>
          </div>
        )}
      </div>
      <p className="mt-2 text-[10px] italic text-muted-foreground/70">Describes what the data shows today. Not a prediction or a recommendation.</p>
    </div>
  );
};
