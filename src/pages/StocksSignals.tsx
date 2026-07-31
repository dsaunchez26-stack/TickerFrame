import { EntryExit } from '@/components/EntryExit';
import { PredictionTracker } from '@/components/PredictionTracker';
import { StocksPageHeader } from '@/components/StocksPageHeader';
import { Disclaimer } from '@/components/Disclaimer';

const StocksSignals = () => (
  <div className="min-h-screen bg-background">
    <StocksPageHeader title="Signals & Track Record" subtitle="Open entry/exit signals across stocks and options, plus how past stock signals have actually played out." />
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
      <Disclaimer />
      <EntryExit />
      <PredictionTracker />
    </main>
  </div>
);

export default StocksSignals;
