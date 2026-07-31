import { OptionsFlowList } from '@/components/options/OptionsFlowList';
import { FlowTiltPanel } from '@/components/options/FlowTiltPanel';
import { NewsFeed } from '@/components/options/NewsFeed';
import { RegulatoryFilings } from '@/components/options/RegulatoryFilings';
import { EarningsCalendar } from '@/components/options/EarningsCalendar';
import { OptionsPageHeader } from '@/components/options/OptionsPageHeader';
import { Disclaimer } from '@/components/Disclaimer';
import { useOptionsScan } from '@/context/OptionsScanContext';

const OptionsFlowNews = () => {
  const { liveFlow, flowAggs, loading, loadLive } = useOptionsScan();

  return (
    <div className="min-h-screen bg-background">
      <OptionsPageHeader
        title="Flow & News"
        subtitle="Options flow prints, market-wide flow tilt, news, filings, and earnings."
        loading={loading}
        onRefresh={loadLive}
      />
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        <Disclaimer />
        <div className="grid gap-6 lg:grid-cols-2">
          <OptionsFlowList prints={liveFlow} />
          <NewsFeed />
        </div>
        <FlowTiltPanel flowAggs={flowAggs} />
        <RegulatoryFilings />
        <EarningsCalendar />
      </main>
    </div>
  );
};

export default OptionsFlowNews;
