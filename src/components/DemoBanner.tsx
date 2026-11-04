import { useEffect, useState } from 'react';
import { exitDemo, isDemoMode } from '@/demo/flag';

export const DemoBanner = () => {
  const [date, setDate] = useState<string | null>(null);
  const demo = isDemoMode();

  useEffect(() => {
    if (!demo) return;
    import('@/demo/demoFetch').then((m) => setDate(new Date(m.demoGeneratedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })));
  }, [demo]);

  if (!demo) return null;
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-border bg-accent/50 px-3 py-1 text-[11px] text-muted-foreground">
      <span><strong className="font-medium text-foreground">Demo mode.</strong> Real data saved{date ? ` on ${date}` : ''} - prices and signals don't update, and anything you add is only kept in this browser tab. The assistant answers from the site's data with simple keyword replies (no AI model), and live option-chain lookup is off.</span>
      <button onClick={exitDemo} className="underline hover:text-foreground">Exit demo</button>
    </div>
  );
};
