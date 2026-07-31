import { useMemo, useState } from 'react';
import { ScannerTable } from '@/components/options/ScannerTable';
import { BestTradeCards } from '@/components/options/BestTradeCards';
import { BudgetPicks } from '@/components/options/BudgetPicks';
import { CashSecuredPuts } from '@/components/options/CashSecuredPuts';
import { CoveredCalls } from '@/components/options/CoveredCalls';
import { CreditSpreads } from '@/components/options/CreditSpreads';
import { StockReplacement } from '@/components/options/StockReplacement';
import { OptionsPageHeader } from '@/components/options/OptionsPageHeader';
import { Disclaimer } from '@/components/Disclaimer';
import { AdvancedFilters, defaultFilters, FilterState } from '@/components/options/AdvancedFilters';
import { applyOptionFilters } from '@/lib/optionFilters';
import { useOptionsScan } from '@/context/OptionsScanContext';

interface Props {
  side: 'C' | 'P';
  title: string;
  subtitle: string;
  prominent?: boolean;
}

// Shares its scan data with every other options page via OptionsScanContext
// instead of independently invoking options-scanner on mount -- previously
// each of Calls, Puts, and Options Radar ran its own scan, and this
// component's `trackedIds` was local state that started empty and was never
// hydrated from storage, so already-tracked picks incorrectly looked
// untracked here until re-tracked in the same session.
export const OptionsSidePage = ({ side, title, subtitle, prominent = false }: Props) => {
  const { allRows, leapsRows, creditSpreads, diagonals, loading, loadLive, scanError, handleTrack, trackedIds } = useOptionsScan();
  const [filters, setFilters] = useState<FilterState>(defaultFilters);

  const sectors = useMemo(() => Array.from(new Set(allRows.map(r => r.sector))), [allRows]);
  const filteredRows = useMemo(() => applyOptionFilters(allRows, filters), [allRows, filters]);
  // Cash-secured puts / covered calls deliberately want LOW delta (the
  // premium-selling thesis) and apply their own band internally -- feeding
  // them through the same "min delta = higher probability" filter meant for
  // the directional Top-Scored/Cheapest/Scanner sections intersects two
  // opposite-direction delta bands down to nearly nothing.
  const incomeRows = useMemo(() => applyOptionFilters(allRows, filters, { skipDelta: true }), [allRows, filters]);
  const incomeLeapsRows = useMemo(() => applyOptionFilters(leapsRows, filters, { skipDelta: true }), [leapsRows, filters]);
  const sideRows = useMemo(() => filteredRows.filter(r => r.cp === side), [filteredRows, side]);
  const sideSpreads = useMemo(
    () => creditSpreads.filter(s => s.strategy === (side === 'C' ? 'call_credit_spread' : 'put_credit_spread')),
    [creditSpreads, side],
  );
  const sideDiagonals = useMemo(
    () => diagonals.filter(d => d.strategy === (side === 'C' ? 'poor_mans_covered_call' : 'poor_mans_cash_secured_put')),
    [diagonals, side],
  );

  return (
    <div className={`min-h-screen bg-background ${prominent ? 'bg-gradient-to-b from-primary/5 to-transparent' : ''}`}>
      <OptionsPageHeader title={title} subtitle={subtitle} loading={loading} onRefresh={loadLive} />
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        <Disclaimer />
        {scanError && (
          <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-xs text-rose-300">
            <strong>Scanner error:</strong> {scanError}
            <button onClick={loadLive} className="ml-2 underline">Retry</button>
          </div>
        )}
        <AdvancedFilters filters={filters} setFilters={setFilters} sectors={sectors} />
        <BestTradeCards rows={sideRows} />
        <BudgetPicks rows={sideRows} />
        {side === 'P'
          ? <CashSecuredPuts rows={incomeRows} leapsRows={incomeLeapsRows} onTrack={handleTrack} trackedIds={trackedIds} />
          : <CoveredCalls rows={incomeRows} leapsRows={incomeLeapsRows} onTrack={handleTrack} trackedIds={trackedIds} />}
        <CreditSpreads spreads={sideSpreads} />
        <StockReplacement diagonals={sideDiagonals} />
        <ScannerTable rows={sideRows} trackedIds={trackedIds} onTrack={handleTrack} />
      </main>
    </div>
  );
};
