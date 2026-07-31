import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, RefreshCw } from 'lucide-react';
import { OptionsSubNav } from '@/components/options/OptionsSubNav';

interface Props {
  title: string;
  subtitle: string;
  loading: boolean;
  onRefresh: () => void;
}

// Shared by every options sub-page (Scanner, Income, Tracked, Flow & News,
// Calls, Puts) -- previously each page hand-rolled this header with a
// non-wrapping flex row that clipped off-screen on mobile (title running
// into the Refresh button, "Options Radar" link cut off entirely).
export const OptionsPageHeader = ({ title, subtitle, loading, onRefresh }: Props) => (
  <header className="border-b border-border bg-card/50 backdrop-blur-sm">
    <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-3">
      <div className="min-w-0">
        <h1 className="truncate font-heading text-lg font-bold">{title}</h1>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button size="sm" variant="outline" onClick={onRefresh} disabled={loading}>
          {loading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-1 h-3 w-3" />}
          Refresh
        </Button>
        <Button asChild variant="ghost" size="sm"><Link to="/options"><ArrowLeft className="mr-1 h-3 w-3" /> Options Radar</Link></Button>
      </div>
    </div>
    <div className="mx-auto max-w-7xl px-4">
      <OptionsSubNav />
    </div>
  </header>
);
