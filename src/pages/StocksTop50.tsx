import { Top50Table } from '@/components/Top50Table';
import { StocksPageHeader } from '@/components/StocksPageHeader';
import { Disclaimer } from '@/components/Disclaimer';

const StocksTop50 = () => (
  <div className="min-h-screen bg-background">
    <StocksPageHeader title="S&P Top 50" subtitle="The 50 largest S&P 500 companies - the household names - with live prices and the same signal as every other stock." />
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
      <Disclaimer />
      <Top50Table />
    </main>
  </div>
);

export default StocksTop50;
