import { EarningsCalendar } from '@/components/options/EarningsCalendar';
import { NewsFeed } from '@/components/options/NewsFeed';
import { RegulatoryFilings } from '@/components/options/RegulatoryFilings';
import { Disclaimer } from '@/components/Disclaimer';

const News = () => (
  <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
    <div>
      <h1 className="font-heading text-2xl font-bold">News & Catalysts</h1>
      <p className="text-xs text-muted-foreground mt-1">Earnings, SEC regulatory filings, and breaking news - all in one place. Government/congressional trade tracking isn't wired up anywhere on this site (see Methodology).</p>
    </div>
    <Disclaimer />
    <div className="grid gap-6 lg:grid-cols-2">
      <NewsFeed />
      <RegulatoryFilings />
    </div>
    <EarningsCalendar />
  </div>
);

export default News;
