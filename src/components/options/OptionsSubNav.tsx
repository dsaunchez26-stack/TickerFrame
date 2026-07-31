import { NavLink } from 'react-router-dom';

const TABS = [
  { label: 'Overview', to: '/options' },
  { label: 'Calls', to: '/calls' },
  { label: 'Puts', to: '/puts' },
  { label: 'Scanner', to: '/options/scanner' },
  { label: 'Income Strategies', to: '/options/income' },
  { label: 'Tracked Picks', to: '/options/tracked' },
  { label: 'Flow & News', to: '/options/flow-news' },
];

// A page like the old all-in-one "Options Radar" grew to 20+ stacked
// sections -- this splits those into separate pages sharing one scan (via
// OptionsScanContext) and gives a quick way to jump between them without
// relying purely on the sidebar.
export const OptionsSubNav = () => (
  <nav className="-mx-4 flex gap-1 overflow-x-auto border-b border-border px-4 pb-px">
    {TABS.map(tab => (
      <NavLink
        key={tab.to}
        to={tab.to}
        end={tab.to === '/options'}
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
