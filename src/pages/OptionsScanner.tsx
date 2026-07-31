import { useMemo, useState } from 'react';
import { AdvancedFilters, defaultFilters, FilterState } from '@/components/options/AdvancedFilters';
import { ScannerTable } from '@/components/options/ScannerTable';
import { ScoreExplainer } from '@/components/options/ScoreExplainer';
import { OptionsPageHeader } from '@/components/options/OptionsPageHeader';
import { Disclaimer } from '@/components/Disclaimer';
import { applyOptionFilters } from '@/lib/optionFilters';
import { useOptionsScan } from '@/context/OptionsScanContext';

const OptionsScanner = () => {
  const { allRows, loading, loadLive, scanError, handleTrack, trackedIds } = useOptionsScan();
  const [filters, setFilters] = useState<FilterState>(defaultFilters);

  const sectors = useMemo(() => Array.from(new Set(allRows.map(r => r.sector))), [allRows]);
  const filteredRows = useMemo(() => applyOptionFilters(allRows, filters), [allRows, filters]);

  return (
    <div className="min-h-screen bg-background">
      <OptionsPageHeader
        title="Scanner"
        subtitle="The full universe, filterable by score, IV rank, volume/OI, delta, sector, and expiration."
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
        <ScannerTable rows={filteredRows} trackedIds={trackedIds} onTrack={handleTrack} />
        <ScoreExplainer />
      </main>
    </div>
  );
};

export default OptionsScanner;
