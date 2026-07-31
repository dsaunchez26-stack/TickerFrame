import { GovTradesPanel } from '@/components/GovTradesPanel';
import { InstitutionalPanel } from '@/components/InstitutionalPanel';
import { EarningsCalendar } from '@/components/options/EarningsCalendar';
import { NewsFeed } from '@/components/options/NewsFeed';
import { RegulatoryFilings } from '@/components/options/RegulatoryFilings';
import { MiddayBriefing } from '@/components/MiddayBriefing';
import { Disclaimer } from '@/components/Disclaimer';

const News = () => (
  <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
    <div>
      <h1 className="font-heading text-2xl font-bold">News & Catalysts</h1>
      <p className="text-xs text-muted-foreground mt-1">Earnings, insider activity, government trades, regulatory filings, and breaking news — all in one place.</p>
    </div>
    <Disclaimer />
    <MiddayBriefing />
    <div className="grid gap-6 lg:grid-cols-2">
      <NewsFeed />
      <RegulatoryFilings />
    </div>
    <EarningsCalendar />
    <GovTradesPanel />
    <InstitutionalPanel />
  </div>
);

export default News;
