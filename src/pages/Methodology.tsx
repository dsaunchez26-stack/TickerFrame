import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Activity, Filter, TrendingUp, AlertTriangle, Database } from 'lucide-react';

const Methodology = () => (
  <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
    <header>
      <h1 className="font-heading text-3xl font-bold">How Tickerframe Generates Signals</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        An accurate description of the real data sources and rules behind every pick you see - no data source or
        rule mentioned here that isn't actually wired up. Nothing here is investment advice - see the{' '}
        <Link to="/legal" className="underline">disclaimer</Link>.
      </p>
    </header>

    <Card>
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <Database className="h-5 w-5 text-primary" />
        <CardTitle className="text-base">Data sources</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        <p><strong className="text-foreground">Stock prices, RSI, MACD, SMA/EMA, patterns:</strong> Finnhub, refreshed on a rotating schedule across the tracked universe (roughly every 20-35 minutes per symbol as the universe has grown, not every symbol every 5 minutes).</p>
        <p><strong className="text-foreground">Options chains & quotes:</strong> Alpaca's free options feed - real bid/ask/last/volume per contract, refreshed on a rolling schedule across the tracked universe rather than all at once (see the Options Radar header for how current a given view is). Alpaca doesn't report Open Interest at all, so it isn't shown anywhere on this site rather than estimating it. Delta, gamma, and implied volatility also aren't supplied by this feed - they're computed here directly from the real bid/ask/last data using the standard Black-Scholes formula, the same math any provider's own "greeks" field is built from.</p>
        <p><strong className="text-foreground">Default lists:</strong> the Overview picks, Dashboard movers and market summary show the 50 largest S&amp;P 500 companies by default, with a toggle to cover all tracked stocks. Portfolios show an asset-allocation breakdown (stocks, bonds, gold, crypto, real estate, and stock sectors) computed from your holdings and live prices.</p>
        <p><strong className="text-foreground">Top 50 tab:</strong> the 50 largest S&amp;P 500 companies by market value, cross-checked across two published S&amp;P 500 rankings as of October 2026 (they agree on 49 of the 50; names near the cutoff trade places). Large non-members such as TSMC, Toyota, ASML and SpaceX are excluded. The table ranks them by each company's live market cap from Finnhub, and the list itself is a fixed snapshot updated by hand, so it can lag index changes.</p>
        <p><strong className="text-foreground">Asset classes (bonds, gold, bitcoin, real estate, index funds):</strong> tracked through exchange-traded funds - AGG, TLT, IEF, LQD and HYG for bonds, GLD and SLV for gold and silver, IBIT and ETHA for bitcoin and ethereum, VNQ and IYR for real estate, and SPY, QQQ, DIA and IWM for the broad market. They use the same Finnhub prices and the same technical signal as stocks. Funds have no balance sheet or earnings, so they don't appear in the fundamentals screens or insider activity.</p>
        <p><strong className="text-foreground">Futures contract specs:</strong> tastytrade's sandbox/certification API - real, current front-month specs (symbol, expiration, tick size, contract size). Tastytrade's production API would need a funded brokerage account, so this uses their sandbox reference data instead, same as the options migration avoided requiring a funded Tradier account.</p>
        <p><strong className="text-foreground">Futures live pricing:</strong> Yahoo Finance's public quote feed - real, live last price, day high/low, volume, and change for that same front-month contract. This is an unofficial, undocumented endpoint (Yahoo hasn't published a supported finance API since 2017), used because it's the only genuinely live, free, no-account-required futures pricing source available - it can occasionally go down or get rate-limited independent of this app. Bid/ask isn't available from this feed and is never shown or estimated.</p>
        <p><strong className="text-foreground">Insider activity:</strong> SEC EDGAR directly - Form 4 open-market purchases and Schedule 13D/13G 5%+ holder filings. Not 8-K, not 13F, and no filer is specially tagged or prioritized.</p>
        <p><strong className="text-foreground">Fundamentals:</strong> Finnhub - debt/equity, current ratio, margins, revenue and EPS growth, valuation multiples, earnings-surprise history.</p>
        <p><strong className="text-foreground">Earnings dates:</strong> SEC/Finnhub's earnings calendar.</p>
        <p><strong className="text-foreground">VIX / market regime:</strong> the real CBOE VIX close, pulled from FRED (the Federal Reserve's public data service) - typically the most recent business day's close, not an intraday tick. SPY and QQQ price/change come from Alpaca directly. The Risk-On/Risk-Off/Neutral label is a simple, disclosed rule (elevated VIX or a real down day across both ETFs means risk-off; a calm VIX with both ETFs up means risk-on) shown next to the real numbers it's computed from, not a prediction.</p>
        <p><strong className="text-foreground">Options flow tilt:</strong> real call vs. put dollar volume (contracts traded x premium x 100) per ticker, aggregated from the same options scan data shown elsewhere on the site - not a separate live trade-by-trade feed.</p>
        <p><strong className="text-foreground">Put/Call Ratio:</strong> total put contract volume divided by total call contract volume, summed across every contract currently in the rolling options scan (not just the top-80-by-score list shown elsewhere on the page) - the same convention CBOE's own published ratio uses. Below 1 (more call volume) reads bullish, above 1 (more put volume) reads bearish - it's a real volume snapshot of this site's tracked universe, not the whole market, and not a prediction.</p>
        <p><strong className="text-foreground">News headlines:</strong> Finnhub's general-market and company news feeds - headline, outlet, link and time only, cached for 10 minutes, each linking to the publisher. Headlines are shown next to a stock for context; the site does not claim a headline caused a price move, and news does not feed into any reading.</p>
        <p><strong className="text-foreground">Candle charts:</strong> real open/high/low/close bars from Alpaca's free IEX feed (5-minute bars for 1D, 30-minute for 3D, hourly for 1W, daily for 1M-1Y), cached for a few minutes. IEX covers only trades executed on IEX, so highs and lows can differ slightly from consolidated figures. If the feed is unavailable the chart falls back to this site's own price snapshots and says so.</p>
        <p><strong className="text-foreground">Not connected:</strong> sentiment analysis, government or congressional trade disclosures, a live options order-flow tape (individual prints as they happen), and an automated "index early warning" system aren't wired up anywhere on this site - the relevant pages say so directly rather than showing fabricated data.</p>
      </CardContent>
    </Card>

    <Card>
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <Filter className="h-5 w-5 text-primary" />
        <CardTitle className="text-base">How the bullish / bearish reading works</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        <p>Each stock gets a composite technical score built from points, not a single all-or-nothing rule. Every condition below adds or subtracts points, up to +8 or -8 in total, shown on the badge as a score from -100 to +100:</p>
        <ul className="ml-4 list-disc space-y-1">
          <li><strong className="text-foreground">Trend:</strong> price above (+2) or below (-2) its 20-period SMA, and its 9-period EMA above (+1) or below (-1) that SMA.</li>
          <li><strong className="text-foreground">Momentum:</strong> MACD above (+2) or below (-2) its own signal line.</li>
          <li><strong className="text-foreground">Stretch:</strong> RSI at or under 30 (+2, oversold) or at or over 70 (-2, overbought), and Bollinger %B at or under 0.05 (+1) or at or over 0.95 (-1).</li>
        </ul>
        <p>A score of 5 or more points reads <strong className="text-foreground">Bullish</strong> (trend and momentum lean up), -5 or fewer reads <strong className="text-foreground">Bearish</strong> (they lean down), and anything between is <strong className="text-foreground">Neutral</strong> - the score shows how close a Neutral reading is to either side. These are descriptions of what the indicators currently show, not instructions to buy or sell. Open any stock to see a "Why this reading" panel with the real RSI, trend and momentum values and the points each contributed, so you can reach your own view.</p>
        <p>Price samples are collected only while the US market is open, and a stock needs about 27 of them before it gets a reading. Until then (a newly added stock, or after downtime) it shows as Neutral with no score - that means "no reading yet", not a neutral view.</p>
        <p><strong className="text-foreground">Two lenses, kept separate:</strong> the reading itself is built only from recent price action (trend and momentum make up 5 of the 8 points; the stretch measures RSI and Bollinger can pull against them). Company financials - the Balance Sheet and Growth scores - are not part of it. The "Why this reading" summary shows them next to it, and says when the two disagree, so a long-term investor can weigh both.</p>
        <p>The same readings are shown to every visitor. Nothing here is tailored to an individual's finances, goals or holdings.</p>
        <p>The earlier rule required RSI under 35 and price above its 20-SMA at the same time, which almost never happen together - on live data it produced no bullish readings across ~780 stocks. Weighing the conditions together fixes that. The 5-point cutoff was picked so roughly a fifth of the universe reads Bullish and a fifth Bearish rather than nearly everything reading Neutral; it is not a statistically optimized number.</p>
        <p><strong className="text-foreground">Tested, and no proven edge:</strong> in October 2026 we ran the same five indicator rules on daily prices for about 770 U.S. stocks over five years (October 2021 to October 2026) and compared each day's scores with how every stock did relative to the rest over the next 5, 20 and 60 trading days. The relationship was effectively zero (rank correlation between -0.01 and 0.00, nowhere near statistical significance), and the same was true of the individual trend and stretch components and of common alternatives such as 6- and 12-month momentum. Caveats: the test used daily prices while the live reading uses this site's own intraday samples, it only includes stocks still listed today (which flatters long-term results), and it ignores trading costs. So treat a reading as a description of the current price pattern, not a forecast, and expect the live Track Record to look the same until it proves otherwise.</p>
        <p>Chart patterns (breakout, breakdown, bull/bear flag, consolidation) are detected separately from recent intraday price action and shown as a badge next to the reading - they don't feed into the score.</p>
      </CardContent>
    </Card>

    <Card>
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <TrendingUp className="h-5 w-5 text-primary" />
        <CardTitle className="text-base">Sector-relative fundamentals scoring</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        <p>Balance Sheet Strength and Growth &amp; Momentum (both 0-100) compare a stock's debt/equity, current ratio, net margin, revenue growth, and EPS growth against its own sector's median among tracked peers - not one flat cutoff applied to the whole market, so a highly-leveraged utility and a highly-leveraged software company aren't judged the same way. Falls back to a flat scale only when a sector has too few tracked peers to trust a median.</p>
        <p>These two scores are what the Quality Screen, Price-to-Sales, Small-Cap Value, Weak Balance Sheets, Dividend Income, and Sector Rotation screens rank on.</p>
      </CardContent>
    </Card>

    <Card>
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <Activity className="h-5 w-5 text-primary" />
        <CardTitle className="text-base">Signal tracking</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        <p><strong className="text-foreground">Reading Track Record:</strong> every weekday this site saves each stock's Bullish / Neutral / Bearish reading and the price at that time. The track record then compares each reading with the price 1, 3, 5, 10 and 20 trading days later (the two- and four-week rows appear once enough days exist) - the average move and how often a Bullish reading rose or a Bearish one fell - next to the average for all stocks, which is what a useful indicator has to beat. Live recording started October 2026, so those results build up slowly. A separate "replay" table re-runs today's rule over the week of price samples collected before that; it is a backtest and is labeled as one.</p>
        <p>The Reading Check on the Signals page compares every current bullish/bearish reading with that stock's change today versus yesterday's close. It's a same-day consistency check - is the stock moving the way the reading leans - not a historical win/loss ledger and not evidence the reading works. The track record above is the real test.</p>
        <p>See real outcomes on the <Link to="/performance" className="underline">Performance</Link> page for any option pick you've explicitly tracked.</p>
      </CardContent>
    </Card>

    <Card className="border-signal-sell/40">
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <AlertTriangle className="h-5 w-5 text-signal-sell" />
        <CardTitle className="text-base">Known limits</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        <p>Options data rotates through the tracked universe on a schedule rather than scanning everything live on every visit - the Options Radar header shows how current the data currently shown actually is. Open Interest isn't available from this data source and is never shown or estimated.</p>
        <p>Sentiment scoring, government/congressional trade tracking, and SEC 8-K/13F filings are not wired up anywhere on this site - only Form 4 and Schedule 13D/13G insider filings are real.</p>
        <p>The VIX shown in the Market Regime bar is the most recent daily close (via FRED), typically one business day behind - not a live intraday value.</p>
        <p>Volume isn't provided by the free-tier stock data source, so it always shows N/A rather than a fabricated number.</p>
        <p>Nothing on this site is a recommendation to buy or sell any security. See the <Link to="/legal" className="underline">full disclaimer</Link>.</p>
      </CardContent>
    </Card>

    {/* Fixed to the date this content was actually last edited -- new
        Date() here would silently relabel it "updated today" on every
        single page load regardless of whether anything changed. */}
    <div className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground">
      <Shield className="h-3 w-3" />
      <span>Methodology last updated 10/23/2026</span>
    </div>
  </div>
);

export default Methodology;
