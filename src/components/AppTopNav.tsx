import { Link, NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, LineChart, TrendingUp, TrendingDown, Activity, Briefcase, BarChart3,
  Newspaper, ShieldCheck, Gem, Radar, ListFilter, Wallet, Bookmark, Rss, Coins, Target, Layers, DollarSign, ChevronDown,
  Calculator, Users, Building2, Percent,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
    { title: 'Small-Cap Value', url: '/value-radar/small-cap', icon: Building2 },
    { title: 'Short Candidates', url: '/value-radar/short-candidates', icon: TrendingDown },
    { title: 'Insider Activity', url: '/insider-activity', icon: Users },
    { title: 'Dividend Income', url: '/dividend-income', icon: Percent },
    { title: 'News & Catalysts', url: '/news', icon: Newspaper },
  ]},
  { label: 'Tools', items: [
    { title: 'Risk Calculator', url: '/tools/risk-calculator', icon: Calculator },
  ]},
];

const dropdownLinkClass = ({ isActive }: { isActive: boolean }) => cn(
  'flex w-full items-center gap-2 cursor-pointer',
  isActive && 'text-primary font-medium',
);

const flatLinkClass = (active: boolean) => cn(
  'inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground',
  active && 'bg-accent/50 text-foreground',
);

const groupActiveClass = (active: boolean) => cn(
  'inline-flex h-9 items-center gap-1 rounded-md px-3 text-sm font-medium outline-none transition-colors hover:bg-accent hover:text-accent-foreground data-[state=open]:bg-accent/50',
  active && 'bg-accent/50 text-foreground',
);

// Replaces the old left-side vertical sidebar with a horizontal top bar --
// every group is visible in one row without scrolling. Uses independent
// per-trigger DropdownMenus (not Radix's NavigationMenu) specifically
// because NavigationMenu drives a single shared content viewport positioned
// relative to the whole menu root; the moment this row needs to wrap onto
// multiple lines on a narrower screen, that shared viewport's position
// calculation breaks -- the dropdown panel rendered detached from whichever
// trigger was actually clicked, floating over unrelated page content
// instead of anchored right below its own trigger. Each DropdownMenu here
// manages its own independently-positioned content, so wrapping the row
// doesn't affect where any single dropdown opens.
export const AppTopNav = () => {
  const { pathname } = useLocation();
  const { isAdmin } = useAuth();
  const isActive = (p: string) => pathname === p;
  const isGroupActive = (g: NavGroup) => g.items.some(item => item.url === pathname);

  return (
    <div className="flex flex-wrap items-center gap-1">
      <Link to="/" className={flatLinkClass(pathname === '/')}>
        <LayoutDashboard className="h-4 w-4" /> Dashboard
      </Link>
      {groups.map(g => (
        <DropdownMenu key={g.label}>
          <DropdownMenuTrigger className={groupActiveClass(isGroupActive(g))}>
            {g.label} <ChevronDown className="h-3 w-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {g.items.map(item => (
              <DropdownMenuItem key={item.url} asChild>
                <NavLink to={item.url} className={dropdownLinkClass}>
                  <item.icon className="h-4 w-4 shrink-0" />
                  {item.title}
                </NavLink>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ))}
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
