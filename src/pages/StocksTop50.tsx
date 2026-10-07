import { Top50Table } from '@/components/Top50Table';
import { StocksPageHeader } from '@/components/StocksPageHeader';
import { Disclaimer } from '@/components/Disclaimer';

const StocksTop50 = () => (
  <div className="min-h-screen bg-background">
    <StocksPageHeader title="Top 50 U.S. Companies" subtitle="The 50 largest S&P 500 companies by market value - the household names - with prices and the same bullish/bearish reading as every other stock." />
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
      <Disclaimer />
      <Top50Table />
    </main>
  </div>
);

export default StocksTop50;
