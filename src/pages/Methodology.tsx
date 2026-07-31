import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Activity, Filter, Brain, AlertTriangle, Database } from 'lucide-react';

const Methodology = () => (
  <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
    <header>
      <h1 className="font-heading text-3xl font-bold">How Tickerframe Generates Signals</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Full transparency into the data, filters, scoring, and guardrails behind every pick you see.
        Nothing here is investment advice — see the <Link to="/legal" className="underline">disclaimer</Link>.
      </p>
    </header>

    <Card>
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <Database className="h-5 w-5 text-primary" />
        <CardTitle className="text-base">Data sources</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        <p><strong className="text-foreground">Quotes & options chains:</strong> Tradier (production or 15-minute delayed sandbox depending on account tier — the header shows which).</p>
        <p><strong className="text-foreground">News & sentiment:</strong> Finnhub company news, weighted by source tier (Reuters/Bloomberg/WSJ &gt; aggregators &gt; blogs) and recency (last 48h).</p>
        <p><strong className="text-foreground">Filings:</strong> SEC EDGAR (8-K, 13F, 13D/G, Form 4). Jane Street and other elite desks are priority-tagged.</p>
        <p><strong className="text-foreground">Government trades:</strong> House / Senate STOCK Act disclosures. Trades disclosed within 2 days of execution are flagged.</p>
        <p><strong className="text-foreground">Macro:</strong> FRED (rates, unemployment, CPI). SPY regime (price vs EMA9 vs SMA20) gates directional picks.</p>
      </CardContent>
    </Card>

    <Card>
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <Filter className="h-5 w-5 text-primary" />
        <CardTitle className="text-base">Filters that run before scoring</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        <p><strong className="text-foreground">Liquidity (options):</strong> Open Interest ≥ 250, volume ≥ 25, bid/ask spread ≤ 15%.</p>
        <p><strong className="text-foreground">Greeks / time (options):</strong> Delta 0.25–0.60, 10–50 DTE, IV rank ≤ 80.</p>
        <p><strong className="text-foreground">Earnings blackout:</strong> Long-premium option picks are vetoed if an earnings print falls before expiry. Stock picks are vetoed within 5 trading days of a print.</p>
        <p><strong className="text-foreground">Regime veto (stocks):</strong> Longs are skipped in confirmed SPY downtrends; shorts are skipped in confirmed uptrends.</p>
      </CardContent>
    </Card>

    <Card>
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <Activity className="h-5 w-5 text-primary" />
        <CardTitle className="text-base">How the score is built</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        <p>Every candidate gets a 0–100 composite from independent factor buckets:</p>
        <ul className="ml-4 list-disc space-y-1">
          <li><strong className="text-foreground">Technical:</strong> RSI extremes, MACD direction, price vs EMA9/SMA20 stack, recent change.</li>
          <li><strong className="text-foreground">Flow / smart money:</strong> Unusual options volume, analyst upgrades, insider buys, earnings surprises.</li>
          <li><strong className="text-foreground">News catalyst:</strong> Source-weighted 48h sentiment skew, with a bonus for fresh (&lt;6h) headlines and a penalty when price moves against the news.</li>
          <li><strong className="text-foreground">Confluence gate:</strong> At least two independent factors must agree before a pick is surfaced. Single-factor setups are dropped.</li>
        </ul>
        <p>
          Tiers: <span className="text-signal-buy font-semibold">High</span> ≥ 85 · <span className="text-signal-hold font-semibold">Medium</span> 75–84 · Low &lt; 75. Only High/Medium are logged to Performance.
        </p>
      </CardContent>
    </Card>

    <Card>
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <Brain className="h-5 w-5 text-primary" />
        <CardTitle className="text-base">Continuous learning</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        <p>Every logged signal carries an entry, stop, target, and time-stop rule a human could actually execute. A background resolver marks each pick a win, loss, or time-out from real closes.</p>
        <p>Factor contributions are stored per signal so a nightly calibration job can correlate them with forward returns and re-weight the scorer. What's working shows up on the <Link to="/performance" className="underline">Performance</Link> page.</p>
      </CardContent>
    </Card>

    <Card className="border-signal-sell/40">
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <AlertTriangle className="h-5 w-5 text-signal-sell" />
        <CardTitle className="text-base">Known limits</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        <p>Sandbox Tradier quotes are 15 minutes delayed; the header pill tells you which feed is live.</p>
        <p>Government-trade disclosures lag execution by 1–45 days under the STOCK Act. A "Filed +Nd" tag on every row shows how stale the signal actually is.</p>
        <p>Signal outcomes are resolved on daily closes, not intraday MFE/MAE — real fills can be materially better or worse than the tracked exit.</p>
        <p>Nothing on this site is a recommendation to buy or sell any security. See the <Link to="/legal" className="underline">full disclaimer</Link>.</p>
      </CardContent>
    </Card>

    <div className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground">
      <Shield className="h-3 w-3" />
      <span>Methodology last updated {new Date().toLocaleDateString()}</span>
    </div>
  </div>
);

export default Methodology;
