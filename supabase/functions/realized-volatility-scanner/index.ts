import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { TRACKED_TICKERS } from "../_shared/symbols.ts";
import { logCronRun } from "../_shared/logCronRun.ts";
import { isMarketOpen } from "../_shared/marketHours.ts";

// Same universe options-scanner covers (tracked stocks + the two broad-
// market ETFs it adds back for options liquidity).
const TICKERS = [...TRACKED_TICKERS, "SPY", "QQQ"];

// fetch-stock-data samples every 5 minutes around the clock, so most of a
// long lookback window is actually closed-market: a flat last-trade price
// repeated for 17+ hours a day would swamp a naive stdev calc with fake
// zero-return periods and badly understate real volatility. Filtering to
// only samples recorded during the regular session -- and only pairing up
// samples that are actually adjacent within the same session, not across a
// Friday-close-to-Monday-open gap -- keeps this an honest realized-vol
// estimate from the data this app actually has, rather than needing a
// separate daily-closes data source.
const MAX_GAP_MINUTES = 15;
// 5-minute samples across a ~6.5hr regular session -> ~78 samples/day,
// ~77 return-periods/day, annualized over 252 trading days.
const ANNUALIZATION_FACTOR = Math.sqrt(77 * 252);

// A first attempt querying stock_price_history per-symbol (up to ~300
// separate paginated round trips across 116 tickers) hit the edge
// function's compute/resource ceiling -- root cause turned out to be an
// unrelated per-call Intl.DateTimeFormat construction in isMarketOpen (see
// _shared/marketHours.ts), not data volume. Still switched to one set of
// paginated bulk queries across every symbol at once instead of N small
// ones, matching fetch-stock-data's own history fetch, and a shorter 3-day
// window instead of the full 7-day retention.
//
// Rows interleave across all TICKERS.length symbols by recorded_at, so the
// per-symbol row budget needs real headroom above "samples actually
// needed": at ~900/symbol (24/7 raw rows, most of which are closed-market)
// this reaches back roughly 3 real days per symbol, yielding the ~200+
// market-hours samples after filtering that a 300/symbol budget (only
// ~25 hours per symbol once interleaved) fell well short of.
const LOOKBACK_DAYS = 3;
const PAGE_SIZE = 1000;
const TARGET_ROWS_PER_SYMBOL = 900;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const cutoff = new Date(Date.now() - LOOKBACK_DAYS * 86400_000).toISOString();
    const HISTORY_TARGET = TICKERS.length * TARGET_ROWS_PER_SYMBOL;
    const pointsBySymbol = new Map<string, Array<{ price: number; recorded_at: string }>>();

    // Newest-first, not oldest-first: rows interleave across all 116
    // symbols by timestamp, so an ascending fetch capped at HISTORY_TARGET
    // only ever reaches a fixed ~25-hour slice right after `cutoff` --
    // which, depending on what day "now" happens to be, can land entirely
    // on a weekend and yield zero market-hours samples for every symbol.
    // Anchoring to the most recent data (then reversing into chronological
    // order per symbol, same as fetch-stock-data's own history fetch)
    // guarantees whatever real trading activity is freshest actually gets
    // used.
    for (let offset = 0; offset < HISTORY_TARGET; offset += PAGE_SIZE) {
      const { data: page, error } = await supabase
        .from("stock_price_history")
        .select("symbol, price, recorded_at")
        .in("symbol", TICKERS)
        .gte("recorded_at", cutoff)
        .order("recorded_at", { ascending: false })
        .range(offset, Math.min(offset + PAGE_SIZE, HISTORY_TARGET) - 1);
      if (error) throw new Error(error.message);
      if (!page || page.length === 0) break;
      for (const row of page) {
        const list = pointsBySymbol.get(row.symbol) ?? [];
        list.push({ price: Number(row.price), recorded_at: row.recorded_at });
        pointsBySymbol.set(row.symbol, list);
      }
      if (page.length < PAGE_SIZE) break;
    }
    for (const list of pointsBySymbol.values()) list.reverse();

    const rows: Array<{ symbol: string; rv_annualized: number | null; sample_count: number; updated_at: string }> = [];
    const now = new Date().toISOString();

    for (const symbol of TICKERS) {
      const allPoints = pointsBySymbol.get(symbol) ?? [];
      const sessionPoints = allPoints.filter((p) => isMarketOpen(new Date(p.recorded_at)));

      const logReturns: number[] = [];
      for (let i = 1; i < sessionPoints.length; i++) {
        const prev = sessionPoints[i - 1];
        const cur = sessionPoints[i];
        const gapMinutes = (new Date(cur.recorded_at).getTime() - new Date(prev.recorded_at).getTime()) / 60000;
        if (gapMinutes > MAX_GAP_MINUTES) continue;
        if (prev.price <= 0 || cur.price <= 0) continue;
        logReturns.push(Math.log(cur.price / prev.price));
      }

      // Need a real sample of actual price movement before an annualized
      // number means anything -- a handful of returns from a quiet
      // afternoon shouldn't be presented as "this stock's volatility."
      if (logReturns.length < 30) {
        rows.push({ symbol, rv_annualized: null, sample_count: logReturns.length, updated_at: now });
        continue;
      }

      const mean = logReturns.reduce((a, b) => a + b, 0) / logReturns.length;
      const variance = logReturns.reduce((a, b) => a + (b - mean) ** 2, 0) / logReturns.length;
      const stdDev = Math.sqrt(variance);
      const rvAnnualized = stdDev * ANNUALIZATION_FACTOR;

      rows.push({ symbol, rv_annualized: rvAnnualized, sample_count: logReturns.length, updated_at: now });
    }

    if (rows.length > 0) {
      const { error: upsertError } = await supabase.from("realized_volatility").upsert(rows, { onConflict: "symbol" });
      if (upsertError) {
        await logCronRun(supabase, "realized-volatility-scanner", false, 0, upsertError.message);
        return new Response(JSON.stringify({ error: upsertError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    await logCronRun(supabase, "realized-volatility-scanner", true, rows.length, null);
    return new Response(JSON.stringify({ scanned: rows.length, tracked: TICKERS.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    await logCronRun(supabase, "realized-volatility-scanner", false, 0, String(err));
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
