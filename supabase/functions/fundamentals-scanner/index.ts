import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// Same equity universe as fetch-stock-data, minus index ETFs (SPY/QQQ) --
// balance-sheet metrics like debt/equity don't mean anything for a fund.
const SYMBOLS: Array<{ symbol: string; name: string }> = [
  { symbol: "AAPL", name: "Apple Inc" },
  { symbol: "NVDA", name: "NVIDIA Corp" },
  { symbol: "TSLA", name: "Tesla Inc" },
  { symbol: "AMD", name: "Advanced Micro Devices" },
  { symbol: "META", name: "Meta Platforms" },
  { symbol: "MSFT", name: "Microsoft Corp" },
  { symbol: "GOOGL", name: "Alphabet Inc" },
  { symbol: "AMZN", name: "Amazon.com Inc" },
  { symbol: "PLTR", name: "Palantir Technologies" },
  { symbol: "NFLX", name: "Netflix Inc" },
  { symbol: "DIS", name: "Walt Disney Co" },
  { symbol: "JPM", name: "JPMorgan Chase & Co" },
  { symbol: "BAC", name: "Bank of America Corp" },
  { symbol: "XOM", name: "Exxon Mobil Corp" },
  { symbol: "JNJ", name: "Johnson & Johnson" },
  { symbol: "KO", name: "Coca-Cola Co" },
  { symbol: "WMT", name: "Walmart Inc" },
  { symbol: "V", name: "Visa Inc" },
  { symbol: "CRM", name: "Salesforce Inc" },
  { symbol: "ORCL", name: "Oracle Corp" },
  { symbol: "INTC", name: "Intel Corp" },
  { symbol: "ADBE", name: "Adobe Inc" },
  { symbol: "UBER", name: "Uber Technologies" },
  { symbol: "SOFI", name: "SoFi Technologies" },
  { symbol: "NIO", name: "NIO Inc" },
  { symbol: "PLUG", name: "Plug Power Inc" },
  { symbol: "SIRI", name: "Sirius XM Holdings" },
  { symbol: "NOK", name: "Nokia Corp" },
  { symbol: "F", name: "Ford Motor Co" },
  { symbol: "GPRO", name: "GoPro Inc" },
  { symbol: "CLOV", name: "Clover Health Investments" },
  { symbol: "BBAI", name: "BigBear.ai Holdings" },
  { symbol: "MARA", name: "MARA Holdings" },
  { symbol: "RIOT", name: "Riot Platforms" },
  { symbol: "SNDL", name: "SNDL Inc" },
  { symbol: "LCID", name: "Lucid Group" },
  { symbol: "CHPT", name: "ChargePoint Holdings" },
  { symbol: "FCEL", name: "FuelCell Energy" },
  { symbol: "IQ", name: "iQIYI Inc" },
  { symbol: "SNOW", name: "Snowflake Inc" },
  { symbol: "DDOG", name: "Datadog Inc" },
  { symbol: "NET", name: "Cloudflare Inc" },
  { symbol: "SHOP", name: "Shopify Inc" },
  { symbol: "PYPL", name: "PayPal Holdings" },
  { symbol: "ROKU", name: "Roku Inc" },
  { symbol: "SNAP", name: "Snap Inc" },
  { symbol: "ABNB", name: "Airbnb Inc" },
  { symbol: "DASH", name: "DoorDash Inc" },
  { symbol: "TGT", name: "Target Corp" },
  { symbol: "LULU", name: "Lululemon Athletica" },
  { symbol: "NKE", name: "Nike Inc" },
  { symbol: "SBUX", name: "Starbucks Corp" },
  { symbol: "CMG", name: "Chipotle Mexican Grill" },
  { symbol: "MS", name: "Morgan Stanley" },
  { symbol: "SCHW", name: "Charles Schwab Corp" },
  { symbol: "COF", name: "Capital One Financial" },
  { symbol: "MRNA", name: "Moderna Inc" },
  { symbol: "GILD", name: "Gilead Sciences" },
  { symbol: "CVS", name: "CVS Health Corp" },
  { symbol: "BA", name: "Boeing Co" },
  { symbol: "GE", name: "General Electric Co" },
  { symbol: "FDX", name: "FedEx Corp" },
  { symbol: "UPS", name: "United Parcel Service" },
  { symbol: "DAL", name: "Delta Air Lines" },
  { symbol: "UAL", name: "United Airlines Holdings" },
  { symbol: "AAL", name: "American Airlines Group" },
  { symbol: "LUV", name: "Southwest Airlines Co" },
  { symbol: "MU", name: "Micron Technology" },
  { symbol: "QCOM", name: "Qualcomm Inc" },
  { symbol: "RIVN", name: "Rivian Automotive" },
  { symbol: "GM", name: "General Motors Co" },
  { symbol: "T", name: "AT&T Inc" },
  { symbol: "VZ", name: "Verizon Communications" },
  { symbol: "CMCSA", name: "Comcast Corp" },
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const FINNHUB_API_KEY = Deno.env.get("FINNHUB_API_KEY");
  if (!FINNHUB_API_KEY) {
    return new Response(JSON.stringify({ error: "FINNHUB_API_KEY is not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const errors: Array<{ symbol: string; message: string }> = [];
  const rows: Array<Record<string, unknown>> = [];

  // Reuse the price stock_cache already maintains (refreshed every 5 min by
  // fetch-stock-data) instead of spending a 3rd Finnhub call per symbol on
  // a quote we already have cached.
  const { data: cachedPrices } = await supabase
    .from("stock_cache")
    .select("symbol, price")
    .in("symbol", SYMBOLS.map((s) => s.symbol));
  const priceBySymbol = new Map((cachedPrices ?? []).map((r) => [r.symbol, Number(r.price)]));

  // Finnhub's free tier allows ~60 req/min. Basic financials + earnings is
  // 2 calls x ~70 symbols, spaced out so the sustained rate stays near the
  // limit instead of bursting through it in the first few seconds.
  for (const { symbol, name } of SYMBOLS) {
    try {
      const [metricRes, earningsRes] = await Promise.all([
        fetch(`https://finnhub.io/api/v1/stock/metric?symbol=${symbol}&metric=all&token=${FINNHUB_API_KEY}`),
        fetch(`https://finnhub.io/api/v1/stock/earnings?symbol=${symbol}&token=${FINNHUB_API_KEY}`),
      ]);

      const metricJson = metricRes.ok ? await metricRes.json() : null;
      const earningsJson = earningsRes.ok ? await earningsRes.json() : null;

      const m = metricJson?.metric ?? {};
      const price = priceBySymbol.get(symbol) ?? null;
      if (!price) throw new Error("No cached price available");

      const debtToEquity = numOrNull(m["totalDebt/totalEquityAnnual"] ?? m["totalDebt/totalEquityQuarterly"]);
      const currentRatio = numOrNull(m["currentRatioAnnual"] ?? m["currentRatioQuarterly"]);
      const netMargin = numOrNull(m["netProfitMarginAnnual"] ?? m["netProfitMarginTTM"]);
      const revenueGrowth = numOrNull(m["revenueGrowthTTMYoy"] ?? m["revenueGrowthQuarterlyYoy"]);
      const epsGrowth = numOrNull(m["epsGrowthTTMYoy"] ?? m["epsGrowthQuarterlyYoy"]);
      const week52Low = numOrNull(m["52WeekLow"]);
      const week52High = numOrNull(m["52WeekHigh"]);
      // psTTM preferred over psAnnual -- trailing-twelve-months reflects the
      // most recent four quarters rather than the last full fiscal year,
      // which can otherwise lag up to ~a year behind for a business whose
      // revenue has meaningfully changed since its last annual close.
      const psRatio = numOrNull(m["psTTM"] ?? m["psAnnual"]);
      // Finnhub reports this in millions of dollars.
      const marketCap = numOrNull(m["marketCapitalization"]);

      // Last 4 quarters' actual-vs-estimate EPS, kept individually (not just
      // averaged) so the detail view can show the real beat/miss trend
      // quarter by quarter rather than one blended number.
      const epsHistory: Array<{ period: string; actual: number; estimate: number; surprisePct: number }> = Array.isArray(earningsJson)
        ? earningsJson.slice(0, 4)
            .map((q: { period?: string; actual?: number; estimate?: number }) =>
              typeof q.actual === "number" && typeof q.estimate === "number" && q.estimate !== 0
                ? { period: q.period ?? "", actual: q.actual, estimate: q.estimate, surprisePct: ((q.actual - q.estimate) / Math.abs(q.estimate)) * 100 }
                : null)
            .filter((v): v is { period: string; actual: number; estimate: number; surprisePct: number } => v !== null)
        : [];
      const surprises = epsHistory.map((h) => h.surprisePct);
      const avgEpsSurprisePct = surprises.length ? surprises.reduce((a, b) => a + b, 0) / surprises.length : null;

      // Balance Sheet Strength: rewards low leverage, healthy liquidity, real
      // margins. Each factor only contributes if the data is actually present,
      // so a missing field doesn't drag the score toward either extreme.
      const parts: number[] = [];
      if (debtToEquity !== null) parts.push(clamp(100 - debtToEquity * 40, 0, 100));
      if (currentRatio !== null) parts.push(clamp((currentRatio / 2) * 100, 0, 100));
      if (netMargin !== null) parts.push(clamp(50 + netMargin * 2.5, 0, 100));
      const balanceSheetScore = parts.length ? Math.round(parts.reduce((a, b) => a + b, 0) / parts.length) : 50;

      // Growth & Momentum: rewards actual revenue/EPS growth and a recent
      // track record of beating (not missing) earnings estimates.
      const gparts: number[] = [];
      if (revenueGrowth !== null) gparts.push(clamp(50 + revenueGrowth * 2.5, 0, 100));
      if (epsGrowth !== null) gparts.push(clamp(50 + epsGrowth * 1.5, 0, 100));
      if (avgEpsSurprisePct !== null) gparts.push(clamp(50 + avgEpsSurprisePct * 4, 0, 100));
      const growthScore = gparts.length ? Math.round(gparts.reduce((a, b) => a + b, 0) / gparts.length) : 50;

      rows.push({
        symbol,
        name,
        price,
        week52_low: week52Low,
        week52_high: week52High,
        debt_to_equity: debtToEquity,
        current_ratio: currentRatio,
        net_margin: netMargin,
        revenue_growth_yoy: revenueGrowth,
        eps_growth_yoy: epsGrowth,
        avg_eps_surprise_pct: avgEpsSurprisePct,
        eps_surprise_history: epsHistory,
        balance_sheet_score: balanceSheetScore,
        growth_score: growthScore,
        ps_ratio: psRatio,
        market_cap: marketCap,
        updated_at: new Date().toISOString(),
      });
    } catch (e) {
      errors.push({ symbol, message: e instanceof Error ? e.message : String(e) });
    }

    // Upsert in small batches as we go rather than one insert at the end --
    // if the function gets cut off partway through a ~70-symbol scan, work
    // already done shouldn't be thrown away.
    if (rows.length >= 10) {
      await supabase.from("stock_fundamentals").upsert(rows.splice(0, rows.length), { onConflict: "symbol" });
    }
    await sleep(1200);
  }

  if (rows.length > 0) {
    await supabase.from("stock_fundamentals").upsert(rows, { onConflict: "symbol" });
  }

  return new Response(JSON.stringify({ scanned: SYMBOLS.length, errors }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

function numOrNull(v: unknown): number | null {
  return typeof v === "number" && !Number.isNaN(v) ? v : null;
}
