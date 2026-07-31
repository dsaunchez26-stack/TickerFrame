import { useState } from 'react';
import { Indicators } from '@/components/Indicators';
import { StockChart } from '@/components/StockChart';
import { StocksPageHeader } from '@/components/StocksPageHeader';
import { Disclaimer } from '@/components/Disclaimer';

// Indicators and StockChart previously picked their symbol independently
// (Indicators auto-picked the day's biggest mover, StockChart defaulted to
// the first stock in the list) despite sitting side by side -- lifting the
// selection here keeps both showing the same stock.
const StocksChart = () => {
  const [symbol, setSymbol] = useState('');

  return (
    <div className="min-h-screen bg-background">
      <StocksPageHeader title="Chart & Indicators" subtitle="Pick a stock to see its price chart, RSI, MACD, volume, and SMA together." />
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        <Disclaimer />
        <Indicators symbol={symbol} />
        <StockChart symbol={symbol} onSymbolChange={setSymbol} />
      </main>
    </div>
  );
};

export default StocksChart;
