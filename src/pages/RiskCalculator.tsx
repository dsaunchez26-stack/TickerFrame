import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Disclaimer } from '@/components/Disclaimer';
import { StockRiskCalculator } from '@/components/tools/StockRiskCalculator';
import { OptionRiskCalculator } from '@/components/tools/OptionRiskCalculator';
import { FuturesRiskCalculator } from '@/components/tools/FuturesRiskCalculator';

const RiskCalculator = () => {
  const [mode, setMode] = useState<'stock' | 'option' | 'futures'>('stock');

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="mx-auto max-w-5xl px-4 py-3">
          <h1 className="font-heading text-lg font-bold">Risk Calculator</h1>
          <p className="text-xs text-muted-foreground">
            Pick a stock, option, or future, enter your position, and see the dollar risk, breakeven, and profit math before you decide anything.
          </p>
        </div>
      </header>
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        <Disclaimer />
        <Tabs value={mode} onValueChange={v => setMode(v as 'stock' | 'option' | 'futures')}>
          <TabsList>
            <TabsTrigger value="stock">Stock Position</TabsTrigger>
            <TabsTrigger value="option">Option Trade</TabsTrigger>
            <TabsTrigger value="futures">Futures Position</TabsTrigger>
          </TabsList>
        </Tabs>
        {mode === 'stock' ? <StockRiskCalculator /> : mode === 'option' ? <OptionRiskCalculator /> : <FuturesRiskCalculator />}
      </main>
    </div>
  );
};

export default RiskCalculator;
