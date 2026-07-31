import { Link, NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, LineChart, TrendingUp, TrendingDown, Activity, Briefcase, BarChart3,
  Newspaper, ShieldCheck, Gem, Radar, ListFilter, Wallet, Bookmark, Rss, Coins, Target, Layers, DollarSign,
} from 'lucide-react';
import {
  NavigationMenu, NavigationMenuContent, NavigationMenuItem, NavigationMenuLink,
  NavigationMenuList, NavigationMenuTrigger,
} from '@/components/ui/navigation-menu';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

interface NavItem { title: string; url: string; icon: typeof LineChart }
interface NavGroup { label: string; items: NavItem[] }

const groups: NavGroup[] = [
  { label: 'Stocks', items: [
    { title: 'Overview', url: '/stocks', icon: LineChart },
    { title: 'Chart & Indicators', url: '/stocks/chart', icon: BarChart3 },
    { title: 'Penny Stocks', url: '/stocks/penny', icon: Coins },
    { title: 'Signals & Track Record', url: '/stocks/signals', icon: Target },
  ]},
  { label: 'Options', items: [
    { title: 'Overview', url: '/options', icon: Radar },
    { title: 'Calls', url: '/calls', icon: TrendingUp },
    { title: 'Puts', url: '/puts', icon: TrendingDown },
    { title: 'Scanner', url: '/options/scanner', icon: ListFilter },
    { title: 'Income Strategies', url: '/options/income', icon: Wallet },
    { title: 'Tracked Picks', url: '/options/tracked', icon: Bookmark },
    { title: 'Flow & News', url: '/options/flow-news', icon: Rss },
  ]},
  { label: 'Portfolio', items: [
    { title: 'Portfolio Hub', url: '/portfolio', icon: Briefcase },
    { title: 'Performance', url: '/performance', icon: BarChart3 },
  ]},
  { label: 'Research', items: [
    { title: 'Quality Screen', url: '/value-radar', icon: Gem },
    { title: 'Price-to-Sales', url: '/value-radar/price-to-sales', icon: DollarSign },
    { title: 'Short Candidates', url: '/value-radar/short-candidates', icon: TrendingDown },
    { title: 'News & Catalysts', url: '/news', icon: Newspaper },
  ]},
];

const dropdownLinkClass = ({ isActive }: { isActive: boolean }) => cn(
  'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground',
  isActive && 'bg-accent/60 font-medium text-foreground',
);

const flatLinkClass = (active: boolean) => cn(
  'inline-flex h-10 items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground',
  active && 'bg-accent/50 text-foreground',
);

// Replaces the old left-side vertical sidebar -- with ~20 nav items spread
// across groups, that sidebar either had to scroll or hide items below the
// fold. A horizontal top bar keeps every group's label visible in one row
// at all times; each group opens as a dropdown rather than requiring a
// scroll to find an item.
export const AppTopNav = () => {
  const { pathname } = useLocation();
  const { isAdmin } = useAuth();
  const isActive = (p: string) => pathname === p;

  return (
    // No overflow-x-auto here: setting overflow-x alone forces the browser's
    // computed overflow-y to 'auto' too (CSS overflow spec), which clipped
    // the dropdown content panels -- they render as an absolutely-positioned
    // child that pops out below the trigger, so any ancestor overflow other
    // than visible cuts them off entirely.
    <div className="flex items-center gap-1 flex-wrap">
      <Link to="/" className={flatLinkClass(pathname === '/')}>
        <LayoutDashboard className="h-4 w-4" /> Dashboard
      </Link>
      <NavigationMenu>
        {/* flex-wrap override -- NavigationMenuList's base styles have no
            wrap, so on a narrow viewport its triggers overflow straight past
            the edge instead of dropping to a new line the way everything
            else in this row does. */}
        <NavigationMenuList className="flex-wrap justify-start space-x-0 gap-1">
          {groups.map(g => (
            <NavigationMenuItem key={g.label}>
              <NavigationMenuTrigger className="h-10 bg-transparent text-sm font-medium">
                {g.label}
              </NavigationMenuTrigger>
              <NavigationMenuContent>
                <ul className="grid w-56 gap-1 p-2">
                  {g.items.map(item => (
                    <li key={item.url}>
                      <NavigationMenuLink asChild>
                        <NavLink to={item.url} className={dropdownLinkClass}>
                          <item.icon className="h-4 w-4 shrink-0" />
                          {item.title}
                        </NavLink>
                      </NavigationMenuLink>
                    </li>
                  ))}
                </ul>
              </NavigationMenuContent>
            </NavigationMenuItem>
          ))}
        </NavigationMenuList>
      </NavigationMenu>
      <Link to="/futures" className={flatLinkClass(isActive('/futures'))}>
        <Layers className="h-4 w-4" /> Futures
      </Link>
      <Link to="/patterns" className={flatLinkClass(isActive('/patterns'))}>
        <Activity className="h-4 w-4" /> Patterns
      </Link>
      {isAdmin && (
        <Link to="/health" className={flatLinkClass(isActive('/health'))}>
          <ShieldCheck className="h-4 w-4" /> System Health
        </Link>
      )}
    </div>
  );
};
