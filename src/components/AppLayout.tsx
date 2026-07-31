import { Outlet, Link } from 'react-router-dom';
import { AppTopNav } from '@/components/AppTopNav';
import { Activity, Zap } from 'lucide-react';
import { StockDetailProvider } from '@/context/StockDetailContext';
import { UserMenu } from '@/components/auth/UserMenu';
import { useEffect, useState } from 'react';
import { getMarketStatus, marketStatusLabel, type MarketStatus } from '@/lib/marketHours';
import { OnboardingTour } from '@/components/OnboardingTour';

export default function AppLayout() {
  const [status, setStatus] = useState<MarketStatus>(() => getMarketStatus());
  useEffect(() => {
    const id = setInterval(() => setStatus(getMarketStatus()), 30_000);
    return () => clearInterval(id);
  }, []);
  const isLive = status === 'open';
  const dotClass = isLive ? 'bg-signal-buy' : status === 'closed' ? 'bg-muted-foreground' : 'bg-signal-hold';
  const pillClass = isLive ? 'bg-signal-buy/10 text-signal-buy'
    : status === 'closed' ? 'bg-muted/40 text-muted-foreground'
    : 'bg-signal-hold/10 text-signal-hold';
  return (
    <StockDetailProvider>
      <OnboardingTour />
      <div className="min-h-screen flex w-full flex-col bg-background">
        <header className="border-b border-border bg-card/40 backdrop-blur-sm">
          <div className="flex h-12 items-center justify-between px-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
                <Zap className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-heading text-sm font-bold">Tickerframe</span>
              <span className="text-xs text-muted-foreground hidden sm:inline">Professional Trading Suite</span>
            </div>
            <div className="flex items-center gap-3">
              <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 ${pillClass}`}>
                <span className="relative flex h-1.5 w-1.5">
                  {isLive && <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${dotClass}`} />}
                  <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${dotClass}`} />
                </span>
                <span className="text-[10px] font-semibold">{isLive ? 'Live' : status === 'closed' ? 'Closed' : status === 'pre' ? 'Pre' : 'After-Hrs'}</span>
              </div>
              <span className="text-[10px] text-muted-foreground hidden md:inline">
                <Activity className="mr-1 inline h-3 w-3" />{marketStatusLabel(status)}
              </span>
              <UserMenu />
            </div>
          </div>
          <div className="border-t border-border/60 px-3 py-1">
            <AppTopNav />
          </div>
        </header>
        <main className="flex-1 overflow-x-hidden">
          <Outlet />
          <footer className="border-t border-border/50 mt-12 py-6 px-4 text-center text-[11px] text-muted-foreground">
            <p className="mb-1">
              <strong className="text-foreground">Tickerframe</strong> · Research & education only · Not investment advice
            </p>
            <p>
              <Link to="/legal" className="underline hover:text-foreground">Disclaimers & Terms</Link>
              {' · '}
              <Link to="/methodology" className="underline hover:text-foreground">How signals are generated</Link>
              {' · '}
              Data may be delayed or inaccurate. Trade at your own risk.
            </p>
          </footer>
        </main>
      </div>
    </StockDetailProvider>
  );
}
