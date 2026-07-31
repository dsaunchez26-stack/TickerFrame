import { Watchlist } from '@/components/Watchlist';
import { AlertsPanel } from '@/components/AlertsPanel';
import { StocksPageHeader } from '@/components/StocksPageHeader';
import { Disclaimer } from '@/components/Disclaimer';

// The landing page for the stocks section: alerts and the main ranked
// watchlist. Chart/indicators, penny stocks, and signal tracking each moved
// to their own page -- see StocksSubNav.
const Stocks = () => (
  <div className="min-h-screen bg-background">
    <StocksPageHeader title="Stock Signals" subtitle="Live multi-factor signals with chart pattern recognition. Updates every 5 minutes." />
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
      <Disclaimer />
      <AlertsPanel />
      <Watchlist />
    </main>
  </div>
);

export default Stocks;
