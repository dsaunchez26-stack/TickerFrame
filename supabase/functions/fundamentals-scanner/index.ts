import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

import { TRACKED_SYMBOLS } from "../_shared/symbols.ts";
import { logCronRun } from "../_shared/logCronRun.ts";

// Same equity universe as fetch-stock-data -- see _shared/symbols.ts.
const SYMBOLS = TRACKED_SYMBOLS;

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

  // The tracked list has grown past what fits in one invocation: Finnhub's
  // free tier is ~60 req/min and this makes 2 calls/symbol, so respecting
  // that rate for the full list would take longer than Supabase's 150s edge
  // function idle timeout. Processing every symbol in the same fixed array
  // order each run would mean whichever symbols sit near the end NEVER get
  // reached (the run always dies at the same relative position) -- so
  // instead each run processes only the stalest symbols (never-scanned ones
  // first, then oldest updated_at), capped to a batch that reliably
  // finishes in time. Every symbol eventually gets its turn across
  // successive cron ticks rather than a fixed tail being permanently
  // starved, and fundamentals move slowly enough that a multi-run cycle to
  // refresh everything is fine.
  const BATCH_LIMIT = 55;
  const { data: existingRows } = await supabase
    .from("stock_fundamentals")
    .select("symbol, updated_at, sector")
    .in("symbol", SYMBOLS.map((s) => s.symbol));
  const updatedAtBySymbol = new Map((existingRows ?? []).map((r) => [r.symbol, r.updated_at]));
  // Sector essentially never changes, so once known it's carried forward
  // without spending another Finnhub call re-fetching it every scan.
  const sectorBySymbol = new Map((existingRows ?? []).map((r) => [r.symbol, r.sector as string | null]));
  const batch = [...SYMBOLS]
    .sort((a, b) => {
      const aTime = updatedAtBySymbol.get(a.symbol);
      const bTime = updatedAtBySymbol.get(b.symbol);
      if (!aTime && !bTime) return 0;
      if (!aTime) return -1; // never scanned -- highest priority
      if (!bTime) return 1;
      return new Date(aTime).getTime() - new Date(bTime).getTime(); // oldest first
    })
    .slice(0, BATCH_LIMIT);

  for (const { symbol, name } of batch) {
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

      // Only spend a 3rd Finnhub call on symbols that don't already have a
      // sector on file -- needed for the value screens to compare a stock's
      // valuation multiples against its own sector's peers instead of one
      // flat number applied to every industry alike.
      let sector = sectorBySymbol.get(symbol) ?? null;
      if (!sector) {
        const profileRes = await fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${FINNHUB_API_KEY}`);
        if (profileRes.ok) {
          const profileJson = await profileRes.json();
          sector = typeof profileJson?.finnhubIndustry === "string" ? profileJson.finnhubIndustry : null;
        }
      }

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
      // peTTM can be negative or absurdly large for a barely-profitable
      // company (net income near zero) -- neither is a meaningful "cheap"
      // signal, so those get dropped rather than passed through as-is.
      const peRawTTM = numOrNull(m["peTTM"] ?? m["peAnnual"]);
      const peRatio = peRawTTM !== null && peRawTTM > 0 && peRawTTM < 500 ? peRawTTM : null;
      const pbRatio = numOrNull(m["pbAnnual"] ?? m["pbQuarterly"]);
      // Finnhub reports this as a percent already (e.g. 3.2 = 3.2%), not a
      // fraction -- indicatedAnnual reflects the current declared rate,
      // TTM can lag a recent hike or cut.
      const dividendYield = numOrNull(m["dividendYieldIndicatedAnnual"] ?? m["currentDividendYieldTTM"]);
      const payoutRatio = numOrNull(m["payoutRatioTTM"] ?? m["payoutRatioAnnual"]);
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
        sector,
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
        pe_ratio: peRatio,
        pb_ratio: pbRatio,
        dividend_yield: dividendYield,
        payout_ratio: payoutRatio,
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

  // rows.length alone would undercount here -- it gets spliced empty by the
  // incremental-upsert step inside the loop above, so by this point it only
  // holds whatever's left of the last partial batch, not the run's total.
  await logCronRun(supabase, "fundamentals-scanner", true, batch.length - errors.length, errors.length ? `${errors.length} symbol errors` : null);

  return new Response(JSON.stringify({ scanned: batch.length, tracked: SYMBOLS.length, errors }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

function numOrNull(v: unknown): number | null {
  return typeof v === "number" && !Number.isNaN(v) ? v : null;
}
