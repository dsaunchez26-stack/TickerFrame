import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, RefreshCw, TrendingUp, Zap } from 'lucide-react';
import { TickerBanner } from '@/components/options/TickerBanner';
import { SentimentSummary } from '@/components/options/SentimentSummary';
import { BestTradeCards } from '@/components/options/BestTradeCards';
import { BudgetPicks } from '@/components/options/BudgetPicks';
import { AdvancedFilters, defaultFilters, FilterState } from '@/components/options/AdvancedFilters';
import { MarketRegimeBar } from '@/components/options/MarketRegimeBar';
import { IndexEarlyWarning } from '@/components/options/IndexEarlyWarning';
import { OptionChainLookup } from '@/components/options/OptionChainLookup';
import { OptionsSubNav } from '@/components/options/OptionsSubNav';
import { Disclaimer } from '@/components/Disclaimer';
import { applyOptionFilters } from '@/lib/optionFilters';
import { useOptionsScan } from '@/context/OptionsScanContext';

// The market-pulse landing page for the options section: what's happening
// right now and the day's best-scoring / cheapest setups. Everything else
// (scanner table, income strategies, tracked picks, flow & news) lives on
// its own page now -- see OptionsSubNav -- all sharing this same scan via
// OptionsScanContext instead of each re-fetching independently.
const Options = () => {
  const {
    allRows, loading, source, lastUpdate, scanError, scanMeta, cachedAt, regime, indexWarnings, loadLive,
  } = useOptionsScan();
  const [filters, setFilters] = useState<FilterState>(defaultFilters);

  const sectors = useMemo(() => Array.from(new Set(allRows.map(r => r.sector))), [allRows]);
  const filteredRows = useMemo(() => applyOptionFilters(allRows, filters), [allRows, filters]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary glow-primary">
              <Zap className="h-4 w-4 text-primary-foreground" />
            </div>
            <h1 className="font-heading text-lg font-bold">Options Radar</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span className="text-[11px] text-muted-foreground">
              {cachedAt
                ? `🟠 Live scan unavailable — showing cache from ${cachedAt.toLocaleTimeString()}`
                : source === 'tradier-sandbox'
                  ? '🟢 Tradier (sandbox, current-day data)'
                  : '🟡 MarketData.app (~24h delayed)'}
              {lastUpdate && ` · checked ${lastUpdate.toLocaleTimeString()}`}
            </span>
            <Button size="sm" variant="outline" onClick={loadLive} disabled={loading}>
              {loading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-1 h-3 w-3" />}
              Refresh
            </Button>
            <Button asChild variant="ghost" size="sm"><Link to="/"><ArrowLeft className="mr-1 h-3 w-3" /> Stocks Dashboard</Link></Button>
            <Button asChild variant="ghost" size="sm"><Link to="/performance"><TrendingUp className="mr-1 h-3 w-3" /> Track Record</Link></Button>
          </div>
        </div>
        <div className="mx-auto max-w-7xl px-4">
          <OptionsSubNav />
        </div>
      </header>

      <TickerBanner />

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        <Disclaimer />
        {scanError && (
          <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-xs text-rose-300">
            <strong>Scanner error:</strong> {scanError}
            <button onClick={loadLive} className="ml-2 underline">Retry</button>
          </div>
        )}
        {!scanError && !loading && allRows.length === 0 && lastUpdate && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
            No qualifying contracts on this scan. Market may be closed or every candidate failed a risk gate (earnings / IV crush / liquidity). Try again after the next refresh.
            {scanMeta && <span className="ml-2 opacity-70">· scanned {scanMeta.scanned} tickers · {scanMeta.candidates} candidates evaluated</span>}
          </div>
        )}
        <MarketRegimeBar regime={regime} />
        <IndexEarlyWarning warnings={indexWarnings} />
        <SentimentSummary rows={allRows} />
        <AdvancedFilters filters={filters} setFilters={setFilters} sectors={sectors} />
        <BestTradeCards rows={filteredRows} />
        <BudgetPicks rows={filteredRows} />
        <OptionChainLookup />
      </main>
    </div>
  );
};

export default Options;
