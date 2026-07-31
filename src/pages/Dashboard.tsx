import { MarketOverview } from '@/components/MarketOverview';
import { MiddayBriefing } from '@/components/MiddayBriefing';
import { TopMovers } from '@/components/TopMovers';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { TrendingUp, TrendingDown, Activity, Briefcase, BarChart3, LineChart, Zap, ListFilter, Wallet, Layers } from 'lucide-react';
import { Disclaimer } from '@/components/Disclaimer';

const QuickLink = ({ to, icon: Icon, title, desc }: { to: string; icon: any; title: string; desc: string }) => (
  <Link to={to}>
    <Card className="p-4 hover:border-primary/40 hover:shadow-md transition-all cursor-pointer h-full">
      <Icon className="h-5 w-5 text-primary mb-2" />
      <div className="font-heading font-semibold text-sm">{title}</div>
      <div className="text-xs text-muted-foreground mt-1">{desc}</div>
    </Card>
  </Link>
);

const Dashboard = () => (
  <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
    <div className="flex items-center justify-between">
      <div>
        <h1 className="font-heading text-2xl font-bold">Dashboard</h1>
        <p className="text-xs text-muted-foreground mt-1">Your professional trading command center.</p>
      </div>
    </div>
    <Disclaimer />
    <MarketOverview />
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
      <QuickLink to="/stocks" icon={LineChart} title="Stock Signals" desc="Live multi-factor picks with patterns" />
      <QuickLink to="/options" icon={Zap} title="Options Radar" desc="Market pulse: regime, sentiment, top setups" />
      <QuickLink to="/calls" icon={TrendingUp} title="Call Options" desc="Bullish setups, IV cheap" />
      <QuickLink to="/puts" icon={TrendingDown} title="Put Options" desc="Bearish setups (featured)" />
      <QuickLink to="/options/scanner" icon={ListFilter} title="Options Scanner" desc="Full universe, filter by score, delta & more" />
      <QuickLink to="/options/income" icon={Wallet} title="Income Strategies" desc="Cash-secured puts, covered calls, spreads" />
      <QuickLink to="/futures" icon={Layers} title="Futures" desc="Front-month contracts across major products" />
      <QuickLink to="/patterns" icon={Activity} title="Pattern Hub" desc="All detected chart patterns" />
      <QuickLink to="/portfolio" icon={Briefcase} title="Portfolio" desc="Compare two portfolios side by side" />
      <QuickLink to="/performance" icon={BarChart3} title="Performance" desc="Auto-tracked pick outcomes" />
    </div>
    <MiddayBriefing />
    <TopMovers />
  </div>
);

export default Dashboard;
