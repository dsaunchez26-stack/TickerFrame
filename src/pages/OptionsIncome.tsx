import { useMemo, useState } from 'react';
import { AdvancedFilters, defaultFilters, FilterState } from '@/components/options/AdvancedFilters';
import { CashSecuredPuts } from '@/components/options/CashSecuredPuts';
import { CoveredCalls } from '@/components/options/CoveredCalls';
import { CreditSpreads } from '@/components/options/CreditSpreads';
import { StockReplacement } from '@/components/options/StockReplacement';
import { OptionsPageHeader } from '@/components/options/OptionsPageHeader';
import { Disclaimer } from '@/components/Disclaimer';
import { applyOptionFilters } from '@/lib/optionFilters';
import { useOptionsScan } from '@/context/OptionsScanContext';

// Structured / defined-outcome strategies grouped together: cash-secured
// puts, covered calls, credit spreads, and stock-replacement diagonals all
// share the same "income or capped-risk, not a directional bet" framing.
const OptionsIncome = () => {
  const { allRows, leapsRows, creditSpreads, diagonals, loading, loadLive, scanError, handleTrack, trackedIds } = useOptionsScan();
  const [filters, setFilters] = useState<FilterState>(defaultFilters);

  const sectors = useMemo(() => Array.from(new Set(allRows.map(r => r.sector))), [allRows]);
  // skipDelta: true -- cash-secured puts and covered calls deliberately want
  // LOW delta (that's the premium-selling thesis) and apply their own
  // strategy-appropriate band internally. The global "min delta" filter is
  // built for the opposite goal (directional, want-high-probability-ITM), so
  // applying both at once intersects down to nearly nothing.
  const filteredRows = useMemo(() => applyOptionFilters(allRows, filters, { skipDelta: true }), [allRows, filters]);
  const filteredLeapsRows = useMemo(() => applyOptionFilters(leapsRows, filters, { skipDelta: true }), [leapsRows, filters]);

  return (
    <div className="min-h-screen bg-background">
      <OptionsPageHeader
        title="Income Strategies"
        subtitle="Cash-secured puts, covered calls, credit spreads, and stock-replacement diagonals."
        loading={loading}
        onRefresh={loadLive}
      />
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        <Disclaimer />
        {scanError && (
          <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-xs text-rose-300">
            <strong>Scanner error:</strong> {scanError}
            <button onClick={loadLive} className="ml-2 underline">Retry</button>
          </div>
        )}
        <AdvancedFilters filters={filters} setFilters={setFilters} sectors={sectors} />
        <p className="-mt-3 text-[10px] text-muted-foreground">
          Note: the |Δ| filter above doesn't apply on this page — these strategies deliberately target low delta (10–35%) as
          part of the premium-selling thesis, so each section below applies its own delta band instead.
        </p>
        <div className="grid gap-6 lg:grid-cols-2">
          <CashSecuredPuts rows={filteredRows} leapsRows={filteredLeapsRows} onTrack={handleTrack} trackedIds={trackedIds} />
          <CoveredCalls rows={filteredRows} leapsRows={filteredLeapsRows} onTrack={handleTrack} trackedIds={trackedIds} />
        </div>
        <CreditSpreads spreads={creditSpreads} />
        <StockReplacement diagonals={diagonals} />
      </main>
    </div>
  );
};

export default OptionsIncome;
