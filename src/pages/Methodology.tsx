import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Activity, Filter, TrendingUp, AlertTriangle, Database } from 'lucide-react';

const Methodology = () => (
  <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
    <header>
      <h1 className="font-heading text-3xl font-bold">How Tickerframe Generates Signals</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        An accurate description of the real data sources and rules behind every pick you see — no data source or
        rule mentioned here that isn't actually wired up. Nothing here is investment advice — see the{' '}
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
        <p><strong className="text-foreground">Options chains & quotes:</strong> Tradier — production or 15-minute-delayed sandbox depending on account tier, the header pill shows which.</p>
        <p><strong className="text-foreground">Futures contract specs & quotes:</strong> tastytrade's sandbox/certification API. Specs are always real; live pricing depends on tastytrade's sandbox market-data service, which can go down independent of this app.</p>
        <p><strong className="text-foreground">Insider activity:</strong> SEC EDGAR directly — Form 4 open-market purchases and Schedule 13D/13G 5%+ holder filings. Not 8-K, not 13F, and no filer is specially tagged or prioritized.</p>
        <p><strong className="text-foreground">Fundamentals:</strong> Finnhub — debt/equity, current ratio, margins, revenue and EPS growth, valuation multiples, earnings-surprise history.</p>
        <p><strong className="text-foreground">Earnings dates:</strong> SEC/Finnhub's earnings calendar.</p>
        <p><strong className="text-foreground">Not connected:</strong> news/sentiment and government or congressional trade disclosures aren't wired up anywhere on this site — the Flow & News page says so directly rather than showing fabricated data.</p>
      </CardContent>
    </Card>

    <Card>
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <Filter className="h-5 w-5 text-primary" />
        <CardTitle className="text-base">How the buy/sell signal actually works</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        <p>This is a two-indicator technical rule, not a multi-factor model or a 0-100 composite score:</p>
        <ul className="ml-4 list-disc space-y-1">
          <li><strong className="text-foreground">Buy:</strong> RSI under 35, price at or above its 20-period SMA, and MACD already above its own signal line.</li>
          <li><strong className="text-foreground">Sell:</strong> RSI over 68 and MACD already below its own signal line.</li>
          <li><strong className="text-foreground">Otherwise:</strong> hold.</li>
        </ul>
        <p>Requiring MACD to already agree with the RSI extreme is what keeps a stock in a real, sustained downtrend from firing a false "oversold" buy just because RSI dipped — RSI alone can stay under 35 for a long stretch while a stock keeps making new lows.</p>
        <p>Chart patterns (breakout, breakdown, bull/bear flag, consolidation) are detected separately from recent intraday price action and shown as a badge next to the signal — they don't feed into the buy/sell rule itself.</p>
      </CardContent>
    </Card>

    <Card>
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <TrendingUp className="h-5 w-5 text-primary" />
        <CardTitle className="text-base">Sector-relative fundamentals scoring</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        <p>Balance Sheet Strength and Growth &amp; Momentum (both 0-100) compare a stock's debt/equity, current ratio, net margin, revenue growth, and EPS growth against its own sector's median among tracked peers — not one flat cutoff applied to the whole market, so a highly-leveraged utility and a highly-leveraged software company aren't judged the same way. Falls back to a flat scale only when a sector has too few tracked peers to trust a median.</p>
        <p>These two scores are what the Quality Screen, Price-to-Sales, Small-Cap Value, Short Candidates, Dividend Income, and Sector Rotation screens rank on.</p>
      </CardContent>
    </Card>

    <Card>
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <Activity className="h-5 w-5 text-primary" />
        <CardTitle className="text-base">Signal tracking</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        <p>The Signal Prediction Tracker re-checks every current buy/sell signal against that stock's actual price change today, refreshed alongside the regular price update. It's a live consistency check — does the signal's implied direction match what the stock is actually doing right now — not a historical win/loss ledger with stored entry/exit fills.</p>
        <p>See real outcomes on the <Link to="/performance" className="underline">Performance</Link> page for any option pick you've explicitly tracked.</p>
      </CardContent>
    </Card>

    <Card className="border-signal-sell/40">
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <AlertTriangle className="h-5 w-5 text-signal-sell" />
        <CardTitle className="text-base">Known limits</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        <p>Sandbox Tradier quotes are 15 minutes delayed; the header pill tells you which feed is live.</p>
        <p>News, government/congressional trade tracking, and SEC 8-K/13F filings are not wired up anywhere on this site — only Form 4 and Schedule 13D/13G insider filings are real.</p>
        <p>Volume isn't provided by the free-tier stock data source, so it always shows N/A rather than a fabricated number.</p>
        <p>Nothing on this site is a recommendation to buy or sell any security. See the <Link to="/legal" className="underline">full disclaimer</Link>.</p>
      </CardContent>
    </Card>

    {/* Fixed to the date this content was actually last edited -- new
        Date() here would silently relabel it "updated today" on every
        single page load regardless of whether anything changed. */}
    <div className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground">
      <Shield className="h-3 w-3" />
      <span>Methodology last updated 9/9/2026</span>
    </div>
  </div>
);

export default Methodology;
