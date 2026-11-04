import { Link } from 'react-router-dom';
import { StocksSubNav } from '@/components/StocksSubNav';

interface Props {
  title: string;
  subtitle: string;
}

// Shared by every stocks sub-page. Kept responsive from the start (flex-wrap,
// truncated title) after finding the Options section's non-wrapping headers
// clipped content on mobile.
export const StocksPageHeader = ({ title, subtitle }: Props) => (
  <div className="border-b border-border bg-card/50">
    <div className="mx-auto flex max-w-7xl flex-wrap items-start justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <h1 className="truncate text-lg font-semibold tracking-tight">{title}</h1>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{subtitle}</p>
      </div>
      <div className="flex flex-col items-end gap-1 text-[10px]">
        <span className="status-dot text-signal-hold" title="Finnhub's free-tier feed can lag real-time quotes by ~15 minutes.">
          Quotes may be delayed up to 15 min
        </span>
        <Link to="/methodology" className="text-muted-foreground underline hover:text-foreground">How signals are generated</Link>
      </div>
    </div>
    <div className="mx-auto max-w-7xl px-4">
      <StocksSubNav />
    </div>
  </div>
);
