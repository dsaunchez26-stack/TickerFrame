import { MarketOverview } from '@/components/MarketOverview';
import { TopMovers } from '@/components/TopMovers';
import { Disclaimer } from '@/components/Disclaimer';

// Deliberately lean: this used to also carry a 10-tile navigation grid
// (redundant with the top-nav dropdowns, which already reach every one of
// those pages) and a "Midday Briefing" widget that queried a table and an
// edge function that never existed -- it could only ever render "No
// briefing yet today." Both cut rather than fixed. What's left is real,
// live data: current market snapshot, then today's biggest movers with
// one-click add-to-portfolio.
const Dashboard = () => (
  <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
    <div>
      <h1 className="font-heading text-2xl font-bold">Dashboard</h1>
      <p className="text-xs text-muted-foreground mt-1">Today's market at a glance.</p>
    </div>
    <Disclaimer />
    <MarketOverview />
    <TopMovers />
  </div>
);

export default Dashboard;
