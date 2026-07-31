import { NavLink } from 'react-router-dom';

const TABS = [
  { label: 'Quality Screen', to: '/value-radar' },
  { label: 'Price-to-Sales', to: '/value-radar/price-to-sales' },
  { label: 'Short Candidates', to: '/value-radar/short-candidates' },
];

export const ValueRadarSubNav = () => (
  <nav className="-mx-4 flex gap-1 overflow-x-auto border-b border-border px-4 pb-px">
    {TABS.map(tab => (
      <NavLink
        key={tab.to}
        to={tab.to}
        end={tab.to === '/value-radar'}
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
