import { PredictionTracker } from '@/components/PredictionTracker';
import { StocksPageHeader } from '@/components/StocksPageHeader';
import { Disclaimer } from '@/components/Disclaimer';

const StocksSignals = () => (
  <div className="min-h-screen bg-background">
    <StocksPageHeader title="Signals & Track Record" subtitle="How current stock signals are tracking against today's actual price moves." />
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
      <Disclaimer />
      <PredictionTracker />
    </main>
  </div>
);

export default StocksSignals;
