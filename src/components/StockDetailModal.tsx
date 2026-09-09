import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useStockData } from '@/hooks/useStockData';
import { supabase } from '@/integrations/supabase/client';
import { PatternBadge } from '@/components/PatternBadge';
import { CandlestickChart } from '@/components/CandlestickChart';
import { useStockCandles, TIMEFRAMES, type Timeframe } from '@/hooks/useStockCandles';
import { useEffect, useMemo, useState } from 'react';
import { Loader2, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

interface Props {
  symbol: string | null;
  onClose: () => void;
}

interface LiveQuote { price: number; prevClose: number; changePercent: number }
type FundamentalsRow = Database['public']['Tables']['stock_fundamentals']['Row'];
type InsiderRow = Database['public']['Tables']['insider_activity']['Row'];

const fmtMarketCap = (v: number | null) => {
  if (v === null) return 'not reported';
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}T`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}B`;
  return `$${v.toFixed(0)}M`;
};
const fmtPct = (v: number | null, digits = 1) => (v === null ? 'not reported' : `${v >= 0 ? '+' : ''}${v.toFixed(digits)}%`);
const fmtNum = (v: number | null, digits = 2) => (v === null ? 'not reported' : v.toFixed(digits));
const scoreColor = (score: number) => (score >= 65 ? 'text-signal-buy' : score >= 40 ? 'text-signal-hold' : 'text-signal-sell');

export const StockDetailModal = ({ symbol, onClose }: Props) => {
  const { data } = useStockData();
  const stock = useMemo(() => data?.stocks.find(s => s.symbol === symbol) ?? null, [data, symbol]);
  const [timeframe, setTimeframe] = useState<Timeframe>('1D');
  const { candles, loading: loadingHistory } = useStockCandles(symbol, timeframe);

  // For a ticker outside the ~114 we actively track, there's no cached
  // price/history to fall back on -- reuse the same on-demand Finnhub quote
  // fetch already used for untracked portfolio holdings, so search isn't
  // limited to only the names this app happens to scan.
  const [liveQuote, setLiveQuote] = useState<LiveQuote | null>(null);
  const [liveQuoteError, setLiveQuoteError] = useState<string | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);

  useEffect(() => {
    setLiveQuote(null);
    setLiveQuoteError(null);
    if (!symbol || stock) return; // already have rich tracked data, no need for a fallback quote
    let cancelled = false;
    setLoadingQuote(true);
    supabase.functions.invoke('fetch-portfolio-quotes', { body: { symbols: [symbol] } }).then(({ data, error }) => {
      if (cancelled) return;
      setLoadingQuote(false);
      const q = data?.quotes?.[symbol];
      if (error || !q) { setLiveQuoteError(`No data found for ${symbol} — check the ticker and try again.`); return; }
      setLiveQuote(q as LiveQuote);
    });
    return () => { cancelled = true; };
  }, [symbol, stock]);

  // Fundamentals and insider activity are queried directly by symbol
  // instead of through the same context/hook every Research page uses --
  // those load the FULL tracked universe (500+ rows) for peer-percentile
  // ranking, which is unnecessary weight for a quick search lookup. This
  // works for any symbol that's been through fundamentals-scanner /
  // insider-scanner at least once, tracked or not -- independent of
  // whether stock_cache (the chart/RSI/MACD source above) has it.
  const [fundamentals, setFundamentals] = useState<FundamentalsRow | null>(null);
  const [loadingFundamentals, setLoadingFundamentals] = useState(false);
  const [insiderRows, setInsiderRows] = useState<InsiderRow[]>([]);

  useEffect(() => {
    setFundamentals(null);
    setInsiderRows([]);
    if (!symbol) return;
    let cancelled = false;
    setLoadingFundamentals(true);
    Promise.all([
      supabase.from('stock_fundamentals').select('*').eq('symbol', symbol).maybeSingle(),
      supabase.from('insider_activity').select('*').eq('ticker', symbol).order('filing_date', { ascending: false }).limit(5),
    ]).then(([fundRes, insiderRes]) => {
      if (cancelled) return;
      setLoadingFundamentals(false);
      if (fundRes.data) setFundamentals(fundRes.data);
      if (insiderRes.data) setInsiderRows(insiderRes.data);
    });
    return () => { cancelled = true; };
  }, [symbol]);

  return (
    <Dialog open={!!symbol} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {symbol}
            {stock?.pattern && <PatternBadge pattern={stock.pattern} confidence={stock.patternConfidence} />}
          </DialogTitle>
        </DialogHeader>
        {stock && (
          <div className="space-y-4">
            <div className="flex items-baseline gap-3">
              <span className="text-2xl font-bold">${stock.price.toFixed(2)}</span>
              <span className={stock.change >= 0 ? 'text-signal-buy' : 'text-signal-sell'}>
                {stock.change >= 0 ? '+' : ''}{stock.change.toFixed(2)} ({stock.changePercent.toFixed(2)}%)
              </span>
            </div>
            <div className="flex items-center justify-between">
              {!loadingHistory && candles.length >= 2 ? (
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-3" style={{ backgroundColor: '#f0b429' }} />moving average</span>
                  <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-3 border-t border-dashed border-muted-foreground" />last close</span>
                </div>
              ) : <span />}
              <div className="flex items-center gap-0.5 rounded-md border border-border p-0.5 text-[10px]">
                {TIMEFRAMES.map(tf => (
                  <button
                    key={tf.key}
                    onClick={() => setTimeframe(tf.key)}
                    className={`rounded px-1.5 py-0.5 ${timeframe === tf.key ? 'bg-secondary font-semibold' : 'text-muted-foreground'}`}
                  >
                    {tf.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-48">
              {loadingHistory ? (
                <div className="flex h-full items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : candles.length < 2 ? (
                <div className="flex h-full flex-col items-center justify-center gap-1 text-center text-xs text-muted-foreground">
                  <span>Not enough price history yet for this range.</span>
                  {(timeframe === '1M' || timeframe === '3M' || timeframe === '1Y') && (
                    <span className="text-[10px] text-muted-foreground/70">Longer views fill in as more days of data are collected — try 1D/3D/1W for now.</span>
                  )}
                </div>
              ) : (
                <CandlestickChart candles={candles} height={192} tickInterval={Math.ceil(candles.length / 6)} />
              )}
            </div>
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div><div className="text-muted-foreground">RSI</div><div className="font-semibold">{stock.rsi.toFixed(1)}</div></div>
              <div><div className="text-muted-foreground">MACD</div><div className="font-semibold">{stock.macd.toFixed(3)}</div></div>
              <div><div className="text-muted-foreground">Volume</div><div className="font-semibold">{stock.volume > 0 ? `${(stock.volume / 1e6).toFixed(1)}M` : 'N/A'}</div></div>
            </div>
          </div>
        )}
        {!stock && loadingQuote && (
          <div className="flex h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        )}
        {!stock && !loadingQuote && liveQuoteError && (
          <p className="py-6 text-center text-xs text-muted-foreground">{liveQuoteError}</p>
        )}
        {!stock && !loadingQuote && liveQuote && (
          <div className="space-y-2">
            <div className="flex items-baseline gap-3">
              <span className="text-2xl font-bold">${liveQuote.price.toFixed(2)}</span>
              <span className={liveQuote.changePercent >= 0 ? 'text-signal-buy' : 'text-signal-sell'}>
                {liveQuote.changePercent >= 0 ? '+' : ''}{liveQuote.changePercent.toFixed(2)}%
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {symbol} isn't part of this site's actively-tracked list, so there's no chart, RSI/MACD, or pattern detection for it here — just a live price.
            </p>
          </div>
        )}

        {loadingFundamentals && (
          <div className="flex h-16 items-center justify-center"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
        )}

        {!loadingFundamentals && fundamentals && (
          <div className="space-y-4 border-t border-border pt-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border p-3 text-center">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Balance Sheet Strength</div>
                <div className={`font-heading text-2xl font-bold ${scoreColor(fundamentals.balance_sheet_score)}`}>
                  {fundamentals.balance_sheet_score}<span className="text-xs text-muted-foreground">/100</span>
                </div>
              </div>
              <div className="rounded-lg border border-border p-3 text-center">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Growth & Momentum</div>
                <div className={`font-heading text-2xl font-bold ${scoreColor(fundamentals.growth_score)}`}>
                  {fundamentals.growth_score}<span className="text-xs text-muted-foreground">/100</span>
                </div>
              </div>
            </div>

            <div>
              <div className="mb-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">Valuation</div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div><div className="text-muted-foreground">P/E</div><div className="font-semibold">{fmtNum(fundamentals.pe_ratio, 1)}</div></div>
                <div><div className="text-muted-foreground">P/B</div><div className="font-semibold">{fmtNum(fundamentals.pb_ratio)}</div></div>
                <div><div className="text-muted-foreground">P/S</div><div className="font-semibold">{fundamentals.ps_ratio !== null ? `${fundamentals.ps_ratio.toFixed(2)}x` : 'not reported'}</div></div>
                <div><div className="text-muted-foreground">Market Cap</div><div className="font-semibold">{fmtMarketCap(fundamentals.market_cap)}</div></div>
                <div><div className="text-muted-foreground">Dividend Yield</div><div className="font-semibold">{fundamentals.dividend_yield !== null ? `${fundamentals.dividend_yield.toFixed(2)}%` : 'none'}</div></div>
                <div><div className="text-muted-foreground">52-Week Range</div><div className="font-semibold">{fundamentals.week52_low !== null && fundamentals.week52_high !== null ? `$${fundamentals.week52_low.toFixed(2)}–$${fundamentals.week52_high.toFixed(2)}` : 'not reported'}</div></div>
              </div>
            </div>

            <div>
              <div className="mb-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">Balance Sheet</div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div><div className="text-muted-foreground">Debt / Equity</div><div className="font-semibold">{fmtNum(fundamentals.debt_to_equity)}</div></div>
                <div><div className="text-muted-foreground">Current Ratio</div><div className="font-semibold">{fmtNum(fundamentals.current_ratio)}</div></div>
                <div><div className="text-muted-foreground">Net Margin</div><div className="font-semibold">{fmtPct(fundamentals.net_margin)}</div></div>
              </div>
            </div>

            <div>
              <div className="mb-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">Growth</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><div className="text-muted-foreground">Revenue Growth YoY</div><div className="font-semibold">{fmtPct(fundamentals.revenue_growth_yoy)}</div></div>
                <div><div className="text-muted-foreground">EPS Growth YoY</div><div className="font-semibold">{fmtPct(fundamentals.eps_growth_yoy)}</div></div>
              </div>
            </div>

            {insiderRows.length > 0 && (
              <div>
                <div className="mb-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">Recent Insider Activity</div>
                <div className="space-y-1.5">
                  {insiderRows.map(r => {
                    const isBuy = r.transaction_code === 'P';
                    const isHolder = r.filer_title === '5%+ Holder';
                    return (
                      <div key={r.id} className="flex items-center justify-between rounded-md border border-border/40 px-3 py-1.5 text-xs">
                        <div>
                          <div className="font-semibold">{r.filer_name}</div>
                          <div className="text-muted-foreground">{r.filer_title ?? 'Filer'} · {r.filing_date}</div>
                        </div>
                        <div className="flex items-center gap-1.5 text-right">
                          {isBuy ? <TrendingUp className="h-3 w-3 text-signal-buy" /> : isHolder ? <Minus className="h-3 w-3 text-muted-foreground" /> : <TrendingDown className="h-3 w-3 text-signal-sell" />}
                          <div>
                            {r.shares !== null && r.price_per_share !== null ? (
                              <>
                                <div className={`font-semibold ${isBuy ? 'text-signal-buy' : 'text-foreground'}`}>
                                  {r.shares.toLocaleString()} sh @ ${r.price_per_share.toFixed(2)}
                                </div>
                                {r.total_value !== null && <div className="text-muted-foreground">${(r.total_value / 1000).toFixed(0)}K</div>}
                              </>
                            ) : (
                              <div className="text-muted-foreground">{r.form_type} filing</div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <p className="text-[10px] italic text-muted-foreground/70">
              Fundamentals reflect {fundamentals.name}'s most recently reported financials — not a projection, and not a
              recommendation to buy or sell. A missing figure means it wasn't reported, not zero.
            </p>
          </div>
        )}

        {!loadingFundamentals && !fundamentals && (stock || liveQuote) && (
          <p className="border-t border-border pt-4 text-center text-[11px] text-muted-foreground">
            No fundamentals or insider activity on file yet for {symbol}.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
};
