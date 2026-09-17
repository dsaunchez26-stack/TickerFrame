import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, BookOpen } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Disclaimer } from '@/components/Disclaimer';

interface Entry { term: string; def: string }
interface Section { title: string; entries: Entry[] }

// Every definition here matches what the code actually does -- see
// Methodology for the full write-up. Nothing below is aspirational.
const SECTIONS: Section[] = [
  {
    title: 'Reading a signal',
    entries: [
      { term: 'RSI (Relative Strength Index)', def: 'A 0-100 measure of how overbought or oversold a stock is, based on recent up-moves vs. down-moves. Under 35 is oversold territory; over 68 is overbought. RSI alone can stay "oversold" through a real downtrend, which is why it\'s never used by itself here.' },
      { term: 'MACD', def: 'Compares a fast and slow moving average to gauge momentum direction and strength. What matters for the signal isn\'t the raw MACD value but whether it\'s above or below its own signal line (see MACD Histogram).' },
      { term: 'MACD Histogram', def: 'MACD minus its own 9-period signal line. Positive means bullish momentum is still building; negative means it\'s fading. A buy signal requires this to already be positive, not just RSI being low - that combination is what filters out a stock that\'s merely "oversold" in a real downtrend.' },
      { term: 'SMA 20 / EMA 9', def: 'Simple and exponential moving averages over the last 20 and 9 samples. Used as a trend filter: a buy signal requires price to be at or above its 20-period SMA, not just RSI/MACD lining up.' },
      { term: 'Buy / Sell / Hold signal', def: 'The real rule, no more and no less: Buy = RSI under 35, price at/above its 20-SMA, and MACD histogram positive. Sell = RSI over 68 and MACD histogram negative. Everything else is Hold. This is a two-indicator technical rule, not a multi-factor model - see the Methodology page for the full explanation.' },
      { term: 'Bollinger Bands / %B', def: 'Two bands plotted two standard deviations above and below a moving average. %B shows where price sits inside that range: near 1 means price is pressing the upper band (stretched to the upside relative to its own recent range), near 0 the lower band.' },
      { term: 'Chart patterns', def: 'Breakout / Breakdown / Bull Flag / Bear Flag / Consolidation are detected separately from the buy/sell rule, using rule-based analysis of recent intraday price action. They show as a badge next to a signal but don\'t change what the signal itself says.' },
      { term: 'Timeframes (1D/3D/1W/1M/3M/1Y)', def: '1D/3D/1W come from real 5-minute intraday samples. 1M/3M/1Y come from daily closes, which only started accumulating once each symbol was added - there\'s no historical backfill, so longer views fill in gradually rather than showing years of history immediately.' },
      { term: 'Volume - "N/A"', def: 'The free-tier stock data source doesn\'t report real trading volume, so it always shows N/A here rather than a fabricated number.' },
    ],
  },
  {
    title: 'Fundamentals & scoring',
    entries: [
      { term: 'Balance Sheet Strength (0-100)', def: 'Scores debt-to-equity, current ratio, and net margin against that stock\'s own sector median among tracked peers - not one flat cutoff for the whole market, so a highly-leveraged utility and a highly-leveraged software company aren\'t judged the same way.' },
      { term: 'Growth & Momentum (0-100)', def: 'Scores revenue growth, EPS growth, and recent earnings-surprise history against sector peers, the same way Balance Sheet Strength does.' },
      { term: 'Sector-relative scoring', def: 'The general principle behind both scores above: every metric is compared to the median of other tracked stocks in the same broad sector, falling back to a flat scale only when a sector has too few tracked peers (under 4) to trust a median.' },
      { term: 'P/E, P/B, P/S', def: 'Price-to-Earnings, Price-to-Book, and Price-to-Sales ratios. On the Value Radar screens, each is scored against its own sector\'s median rather than a single number applied to every industry.' },
      { term: 'Dividend Yield / Payout Ratio', def: 'Yield is the annual dividend as a percent of price. Payout ratio is how much of earnings that dividend actually consumes - a high yield with an unsustainable payout ratio is a common value trap, which is why Dividend Income weighs both together instead of ranking on yield alone.' },
      { term: 'Revenue / EPS Growth YoY', def: 'Year-over-year growth in revenue or earnings per share, compared against sector peers the same way the two main scores are.' },
      { term: 'Earnings Surprise', def: 'How far actual reported EPS came in above or below analyst estimates for a given quarter, expressed as a percent.' },
      { term: 'Combined Score', def: 'Used on the Value Radar screens: an average of the sector-relative valuation score (from whichever of P/E, P/B, P/S are actually reported) with Balance Sheet Strength and Growth & Momentum, into one 0-100 ranking.' },
      { term: 'Market Cap', def: 'Share price times shares outstanding - the total market value of a company\'s equity.' },
    ],
  },
  {
    title: 'Research screens',
    entries: [
      { term: 'Quality Screen', def: 'The main Value Radar view: strong balance sheet plus real growth, filtered by minimum Balance Sheet and Growth thresholds you set.' },
      { term: 'Price-to-Sales Screen', def: 'Stocks cheap relative to their own revenue, filtered to exclude names that are cheap for a bad reason - a low P/S from collapsing sales isn\'t the same as a genuine bargain, so this still requires the same quality gates as the Quality Screen.' },
      { term: 'Small-Cap Value Screen', def: 'The same idea narrowed to roughly $300M-$2B market cap. The Strict Value Filters toggle (on by default) adds hard, non-negotiable cutoffs on top of the blended score: P/S under 2x, debt-to-equity under 0.5, and a positive net margin - a stock failing any one of these is excluded outright, even if it ranks well otherwise.' },
      { term: 'Short Candidates', def: 'The inverse screen: a weak balance sheet paired with a price that\'s technically stretched above its own normal range (high Bollinger %B). This is backward-looking data, not a signal to open a short - heavily-shorted, weak-fundamentals stocks are exactly the setups most prone to squeezes.' },
      { term: 'Sector Rotation / Contrarian Candidates', def: 'Compares each sector\'s recent price momentum against its average fundamental quality. A sector the market has been pricing down that still clears a real quality bar gets flagged as a Contrarian Candidate - a research starting point, not a buy signal.' },
      { term: 'Insider Activity - Form 4', def: 'An open-market purchase by a company officer, director, or 10%+ owner, pulled directly from SEC EDGAR. Filed within 2 business days of the actual trade, so the filing date can lag the real purchase slightly.' },
      { term: 'Insider Activity - Schedule 13D/13G', def: 'A filing disclosing a new 5%+ ownership stake in a company. Unlike Form 4, these don\'t require the filer to disclose a per-share price, so only the ownership change is shown, not a dollar amount.' },
    ],
  },
  {
    title: 'Options',
    entries: [
      { term: 'Call / Put', def: 'A call gives the right to buy a stock at the strike price by expiration; a put gives the right to sell. Buying either costs a premium; the max loss on a bought option is that premium.' },
      { term: 'Strike / Expiration / DTE', def: 'Strike is the price the option can be exercised at. Expiration is when it stops existing. DTE (Days To Expiration) is how many days remain - a core input to how much time value an option still carries.' },
      { term: 'Delta', def: 'Roughly, how much an option\'s price moves per $1 move in the underlying stock. A 0.50 delta call moves about $0.50 for every $1 the stock moves. Also used loosely as "how likely this expires in the money."' },
      { term: 'Gamma', def: 'How fast delta itself changes as the stock moves. High gamma means an option\'s sensitivity to the stock can shift quickly, which matters most for short-dated, near-the-money contracts.' },
      { term: 'IV (Implied Volatility)', def: 'The volatility the options market is currently pricing in for a stock, back-calculated from option prices themselves - it\'s a market expectation, not a historical measurement.' },
      { term: 'IV Rank', def: 'How rich a stock\'s current IV is relative to that same stock\'s own recent IV history - a way of asking "is IV high for this stock right now," not "is IV high in absolute terms."' },
      { term: 'IV/RV ratio', def: 'Compares implied volatility to the stock\'s actual realized volatility (computed from real price history). Above 1x means the options market is pricing in more movement than the stock has actually been making recently.' },
      { term: 'Open Interest / Volume (options)', def: 'Open Interest is the number of contracts currently outstanding for a given strike/expiration. Volume is how many traded today. Both matter for whether a contract is liquid enough to trade without a wide spread.' },
      { term: 'Covered Call', def: 'Selling a call against stock you already own, collecting premium in exchange for capping your upside at the strike. Ranked by annualized yield, prioritizing contracts beyond the stock\'s expected move over the single highest number.' },
      { term: 'Cash-Secured Put', def: 'Selling a put with the cash set aside to buy the stock if assigned. If the stock stays above the strike, the put expires worthless and you keep the premium; if it breaks below, you\'re obligated to buy at the strike.' },
      { term: 'Credit Spread', def: 'Selling one option and buying a further-out one as protection, capping the maximum possible loss at the strike width minus the credit collected.' },
      { term: 'Stock-Replacement Diagonal (LEAPS)', def: 'Uses a longer-dated, deep-in-the-money option in place of owning the stock outright, then sells shorter-dated options against it for income.' },
      { term: 'Expected Move', def: 'A rough estimate, derived from the option chain\'s own pricing, of how far a stock might move by a given expiration - shown next to strike selection so a strike\'s distance from spot has real context.' },
    ],
  },
  {
    title: 'Futures',
    entries: [
      { term: 'Front-month contract', def: 'The nearest active expiration for a given futures product - what the Futures page shows by default, since it\'s the most actively traded contract for that product at any given time.' },
      { term: 'Tick size / Tick value', def: 'Tick size is the minimum price increment a contract can move. Tick value is that tick size multiplied by the contract multiplier - the real dollar amount one tick is worth.' },
      { term: 'Contract multiplier (contract size)', def: 'The real, exchange-defined dollar value of a one-point move in the contract. This is why futures P&L isn\'t just quantity times price - a $1 move in gold is worth a different dollar amount per contract than a $1 move in the S&P.' },
      { term: 'Notional exposure', def: 'Quantity times the contract multiplier times the entry price - the total dollar value actually being controlled by a futures position, which is typically far larger than the margin posted to hold it.' },
    ],
  },
  {
    title: 'Portfolio & risk',
    entries: [
      { term: 'Portfolio types', def: 'Day Trade, Long-Term, and Watchlist are separate buckets you can assign a position to when adding it - purely organizational, they don\'t change how a position is scored.' },
      { term: 'Portfolio Rating', def: 'Based on realized performance plus how concentrated your holdings are - a portfolio that\'s 100% one stock gets flagged for concentration risk regardless of how that stock is doing.' },
      { term: 'Win Rate', def: 'The share of tracked picks currently sitting at a gain versus a loss. Reflects only what you\'ve actually added and tracked, not the full universe of signals the site has ever shown.' },
      { term: 'Entry / Stop-loss / Target', def: 'Entry is the price a position was or would be opened at. Stop-loss is the downside level that caps risk. Target is the upside level the trade is aiming for.' },
      { term: 'Breakeven', def: 'For an option position, the stock price at expiration where the trade neither makes nor loses money - for a bought call, strike plus premium paid.' },
      { term: 'Max Loss / Max Gain', def: 'The largest possible loss or gain a specific position can produce, computed from its actual structure (e.g., premium paid for a bought option, strike width minus credit for a spread) - not an estimate.' },
      { term: 'Risk/Reward ratio', def: 'Dollar risk to the stop compared to dollar gain to the target, expressed as a ratio (e.g., 1:2 means the target is twice as far away, in dollars, as the stop).' },
    ],
  },
  {
    title: 'Alerts (Settings)',
    entries: [
      { term: 'Insider buy alerts', def: 'Notifies you when an officer, director, or 10%+ owner buys shares in a stock you hold, based on real Form 4 filings.' },
      { term: 'Target / stop-loss alerts', def: 'Notifies you when a tracked position crosses the gain target or stop-loss you set on it.' },
      { term: 'Big price move alerts', def: 'Notifies you when a stock or future you hold moves ±6% or more in a day.' },
      { term: 'Chart pattern alerts', def: 'Notifies you when a bullish or bearish chart pattern (breakout, flag, etc.) is newly detected on a tracked holding.' },
      { term: 'Upcoming earnings alerts', def: 'Notifies you when a stock you hold is scheduled to report earnings within the next 3 days.' },
      { term: 'Small-cap value idea alerts', def: 'Notifies you when a new stock clears a 65+ score on the Small-Cap Value screen - sent weekly, one alert per idea.' },
    ],
  },
];

const Handbook = () => {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SECTIONS;
    return SECTIONS
      .map(s => ({ ...s, entries: s.entries.filter(e => e.term.toLowerCase().includes(q) || e.def.toLowerCase().includes(q)) }))
      .filter(s => s.entries.length > 0);
  }, [query]);

  const totalShown = filtered.reduce((n, s) => n + s.entries.length, 0);

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <BookOpen className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="font-heading text-2xl font-bold">Handbook</h1>
          <p className="text-xs text-muted-foreground mt-1">
            What every signal, score, and term on the site actually means. See{' '}
            <Link to="/methodology" className="underline hover:text-foreground">How signals are generated</Link> for the full methodology.
          </p>
        </div>
      </div>

      <Disclaimer />

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search terms - e.g. RSI, delta, breakeven…"
          className="pl-9"
        />
      </div>

      {query.trim() && (
        <p className="text-xs text-muted-foreground">{totalShown} match{totalShown === 1 ? '' : 'es'} for "{query.trim()}"</p>
      )}

      {filtered.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No terms match that search.</CardContent></Card>
      ) : (
        filtered.map(section => (
          <Card key={section.title}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">{section.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {section.entries.map(entry => (
                <div key={entry.term}>
                  <div className="text-sm font-semibold">{entry.term}</div>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{entry.def}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
};

export default Handbook;
