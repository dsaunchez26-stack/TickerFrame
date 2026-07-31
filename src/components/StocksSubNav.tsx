import { NavLink } from 'react-router-dom';

const TABS = [
  { label: 'Overview', to: '/stocks' },
  { label: 'Chart & Indicators', to: '/stocks/chart' },
  { label: 'Penny Stocks', to: '/stocks/penny' },
  { label: 'Signals & Track Record', to: '/stocks/signals' },
];

// Splits what used to be one long Stocks page (alerts, watchlist, chart,
// indicators, penny watchlist, signal tracking, prediction accuracy all
// stacked together) into focused pages, same pattern as the Options Radar
// split.
export const StocksSubNav = () => (
  <nav className="-mx-4 flex gap-1 overflow-x-auto border-b border-border px-4 pb-px">
    {TABS.map(tab => (
      <NavLink
        key={tab.to}
        to={tab.to}
        end={tab.to === '/stocks'}
        className={({ isActive }) =>
          `whitespace-nowrap rounded-t-md border-b-2 px-3 py-2 text-xs font-medium transition-colors ${
            isActive
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`
        }
      >
        {tab.label}
      </NavLink>
    ))}
  </nav>
);
