import { PennyWatchlist } from '@/components/PennyWatchlist';
import { StocksPageHeader } from '@/components/StocksPageHeader';
import { Disclaimer } from '@/components/Disclaimer';

const StocksPenny = () => (
  <div className="min-h-screen bg-background">
    <StocksPageHeader title="Penny Stocks" subtitle="Sub-$5 stocks, ranked by the same signal tiers as the main watchlist." />
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
      <Disclaimer />
      <PennyWatchlist />
    </main>
  </div>
);

export default StocksPenny;
