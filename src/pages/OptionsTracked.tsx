import { TrackedPicks } from '@/components/options/TrackedPicks';
import { OptionPickTracker } from '@/components/options/OptionPickTracker';
import { OptionsPageHeader } from '@/components/options/OptionsPageHeader';
import { Disclaimer } from '@/components/Disclaimer';
import { removeCloudPick } from '@/lib/optionPicks';
import { useOptionsScan } from '@/context/OptionsScanContext';

const OptionsTracked = () => {
  const { allRows, picks, pickQuotes, pickPrevCloses, setAndPersistPicks, refreshPickQuotes, loading, loadLive } = useOptionsScan();

  return (
    <div className="min-h-screen bg-background">
      <OptionsPageHeader
        title="Tracked Picks"
        subtitle="Contracts you've flagged from any screen, with a running paper P/L."
        loading={loading}
        onRefresh={loadLive}
      />
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        <Disclaimer />
        {picks.length === 0 ? (
          <div className="rounded-lg border border-border bg-card/50 px-4 py-8 text-center text-sm text-muted-foreground">
            No tracked picks yet. Click the track button on any contract in the Scanner, Income Strategies, Calls, or Puts pages to add it here.
          </div>
        ) : (
          <>
            <TrackedPicks
              picks={picks}
              liveRows={allRows}
              pickQuotes={pickQuotes}
              pickPrevCloses={pickPrevCloses}
              onChange={setAndPersistPicks}
              onRemove={(id) => void removeCloudPick(id)}
              onRefresh={() => refreshPickQuotes(picks)}
            />
            <OptionPickTracker picks={picks} liveRows={allRows} pickQuotes={pickQuotes} />
          </>
        )}
      </main>
    </div>
  );
};

export default OptionsTracked;
