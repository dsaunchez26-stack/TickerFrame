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
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-[11px] text-amber-200">
      <span><strong className="text-amber-300">Demo mode.</strong> Real data saved{date ? ` on ${date}` : ''} - prices and signals don't update, and anything you add is only kept in this browser tab. The AI assistant and live option-chain lookup are off.</span>
      <button onClick={exitDemo} className="underline hover:text-amber-100">Exit demo</button>
    </div>
  );
};
