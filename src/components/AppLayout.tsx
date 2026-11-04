import { Outlet, Link, useLocation } from 'react-router-dom';
import { AppTopNav, MobileNav } from '@/components/AppTopNav';
import { StockDetailProvider } from '@/context/StockDetailContext';
import { StockSearchBar } from '@/components/StockSearchBar';
import { UserMenu } from '@/components/auth/UserMenu';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LogoLink } from '@/components/Logo';
import { useEffect, useState } from 'react';
import { getMarketStatus, marketStatusLabel, type MarketStatus } from '@/lib/marketHours';
import { OnboardingTour } from '@/components/OnboardingTour';
import { MarketChat } from '@/components/MarketChat';
import { DemoBanner } from '@/components/DemoBanner';

export default function AppLayout() {
  const location = useLocation();
  // The Assistant IS a full chat interface already (/ and /chat both render
  // it) -- showing the floating chat bubble on top of it would just be a
  // second, redundant chat surface on the same page.
  const onChatPage = location.pathname === '/' || location.pathname === '/chat';
  const [status, setStatus] = useState<MarketStatus>(() => getMarketStatus());
  useEffect(() => {
    const id = setInterval(() => setStatus(getMarketStatus()), 30_000);
    return () => clearInterval(id);
  }, []);
  const isLive = status === 'open';
  const statusClass = isLive ? 'text-signal-buy' : status === 'closed' ? 'text-muted-foreground' : 'text-signal-hold';
  return (
    <StockDetailProvider>
      <OnboardingTour />
      {!onChatPage && <MarketChat />}
      <div className="app-shell flex w-full flex-col">
        <DemoBanner />
        <header className="border-b border-border bg-background/80">
          <div className="flex h-12 items-center justify-between px-3">
            <div className="flex shrink-0 items-center gap-2">
              <LogoLink />
              <div className="md:hidden"><MobileNav /></div>
              <span className="hidden text-[11px] text-faint sm:inline">Market research</span>
            </div>
            <div className="flex min-w-0 items-center gap-3 pl-2">
              <StockSearchBar />
              <span className={`status-dot ${statusClass}`} title={marketStatusLabel(status)}>
                <span className="hidden sm:inline">{isLive ? 'Live' : status === 'closed' ? 'Closed' : status === 'pre' ? 'Pre' : 'After-Hrs'}</span>
                <span className="sr-only sm:hidden">{isLive ? 'Live' : status === 'closed' ? 'Closed' : status === 'pre' ? 'Pre' : 'After-Hrs'}</span>
              </span>
              <span className="hidden text-[11px] text-muted-foreground md:inline">{marketStatusLabel(status)}</span>
              <ThemeToggle />
              <UserMenu />
            </div>
          </div>
          <div className="hidden border-t border-border/60 px-3 md:block">
            <AppTopNav />
          </div>
        </header>
        <main className="flex-1 overflow-x-hidden">
          <Outlet />
          <footer className="mt-10 border-t border-border py-5 px-4 text-center text-[11px] text-muted-foreground">
            <p className="mb-1">
              <strong className="text-foreground">Tickerframe</strong> · Research & education only · Not investment advice
            </p>
            <p>
              <Link to="/terms" className="underline hover:text-foreground">Terms of Use</Link>
              {' · '}
              <Link to="/privacy" className="underline hover:text-foreground">Privacy Policy</Link>
              {' · '}
              <Link to="/legal" className="underline hover:text-foreground">Disclaimers</Link>
              {' · '}
              <Link to="/methodology" className="underline hover:text-foreground">How readings are generated</Link>
              {' · '}
              <Link to="/handbook" className="underline hover:text-foreground">Handbook</Link>
              {' · '}
              Data may be delayed or inaccurate. Trade at your own risk.
            </p>
          </footer>
        </main>
      </div>
    </StockDetailProvider>
  );
}
