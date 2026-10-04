import { EtfTable } from '@/components/EtfTable';
import { StocksPageHeader } from '@/components/StocksPageHeader';
import { Disclaimer } from '@/components/Disclaimer';

const StocksEtfs = () => (
  <div className="min-h-screen bg-background">
    <StocksPageHeader title="ETFs & Asset Classes" subtitle="Bonds, gold, bitcoin, real estate and index funds - tracked through exchange-traded funds, with the same live signal as stocks." />
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
      <Disclaimer />
      <EtfTable />
    </main>
  </div>
);

export default StocksEtfs;
