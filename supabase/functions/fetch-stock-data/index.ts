import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// Real US equities tracked across the app. All live under category='core'
// since every current consumer of stock_cache reads that category by default.
// Deliberately a mix of large/mega-caps and lower-priced, higher-volatility
// names rather than either extreme -- still a curated list, not the whole
// market (see MARKETDATA covering options below for the same tradeoff).
const SYMBOLS: Array<{ symbol: string; name: string }> = [
  // Mega/large-cap
  { symbol: "AAPL", name: "Apple Inc" },
  { symbol: "NVDA", name: "NVIDIA Corp" },
  { symbol: "TSLA", name: "Tesla Inc" },
  { symbol: "AMD", name: "Advanced Micro Devices" },
  { symbol: "META", name: "Meta Platforms" },
  { symbol: "MSFT", name: "Microsoft Corp" },
  { symbol: "GOOGL", name: "Alphabet Inc" },
  { symbol: "AMZN", name: "Amazon.com Inc" },
  { symbol: "SPY", name: "SPDR S&P 500 ETF" },
  { symbol: "QQQ", name: "Invesco QQQ Trust" },
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
  // Lower-priced / higher-volatility
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
  // Mid-range ($10-250ish) -- neither mega-cap nor penny stock, spread
  // across sectors so "stocks of the day" reflects more than two extremes.
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

function sma(values: number[], period: number): number {
  const slice = values.slice(-period);
  if (!slice.length) return 0;
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

function ema(values: number[], period: number): number {
  if (!values.length) return 0;
  const k = 2 / (period + 1);
  let emaVal = values[0];
  for (let i = 1; i < values.length; i++) emaVal = values[i] * k + emaVal * (1 - k);
  return emaVal;
}

function rsi(values: number[], period = 14): number {
  if (values.length < period + 1) return 50;
  let gains = 0;
  let losses = 0;
  for (let i = values.length - period; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgGain === 0 && avgLoss === 0) return 50; // no movement at all -- neutral, not overbought
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function macd(values: number[]): number {
  return ema(values, 12) - ema(values, 26);
}

// %B: where price sits within the 20-period Bollinger Bands (2 std dev).
// 0 = at the lower band, 1 = at the upper band, >1 = above the upper band
// (stretched to the upside), <0 = below the lower band (stretched down).
function bollingerPctB(values: number[], period = 20, numStdDev = 2): number | null {
  const slice = values.slice(-period);
  if (slice.length < period) return null;
  const mean = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period;
  const stdDev = Math.sqrt(variance);
  const upper = mean + numStdDev * stdDev;
  const lower = mean - numStdDev * stdDev;
  if (upper === lower) return null;
  return (slice[slice.length - 1] - lower) / (upper - lower);
}

// Rule-based detection over our own intraday 5-min-sample history. Deliberately
// limited to patterns that a few hours of intraday samples can actually support
// -- longer-horizon patterns (head & shoulders, triangles, double tops) need
// weeks of daily closes we don't have, and faking those would be worse than
// not detecting them at all.
function detectPattern(closes: number[]): { pattern: string | null; confidence: number } {
  if (closes.length < 12) return { pattern: null, confidence: 0 };

  const n = closes.length;
  const last = closes[n - 1];
  const max = Math.max(...closes);
  const min = Math.min(...closes);
  const avg = closes.reduce((a, b) => a + b, 0) / n;
  const range = max - min;
  if (range === 0 || avg === 0) return { pattern: "consolidation", confidence: 60 };

  const rangePct = range / avg;

  if (rangePct < 0.008) {
    return { pattern: "consolidation", confidence: Math.round(Math.min(90, 40 + (0.008 - rangePct) / 0.008 * 50)) };
  }

  const firstQuarter = closes.slice(0, Math.max(1, Math.floor(n / 4)));
  const firstAvg = firstQuarter.reduce((a, b) => a + b, 0) / firstQuarter.length;
  const netMovePct = (last - firstAvg) / firstAvg;
  const nearHigh = (max - last) / range < 0.1;
  const nearLow = (last - min) / range < 0.1;

  if (nearHigh && netMovePct > 0.015) {
    return { pattern: "breakout", confidence: Math.min(95, Math.round(50 + netMovePct * 1000)) };
  }
  if (nearLow && netMovePct < -0.015) {
    return { pattern: "breakdown", confidence: Math.min(95, Math.round(50 + Math.abs(netMovePct) * 1000)) };
  }

  const mid = Math.floor(n / 2);
  const firstHalf = closes.slice(0, mid);
  const secondHalf = closes.slice(mid);
  const firstHalfMove = (firstHalf[firstHalf.length - 1] - firstHalf[0]) / firstHalf[0];
  const secondHalfRangePct = (Math.max(...secondHalf) - Math.min(...secondHalf)) / avg;

  if (firstHalfMove > 0.02 && secondHalfRangePct < 0.01) {
    return { pattern: "bull_flag", confidence: Math.min(90, Math.round(50 + firstHalfMove * 1000)) };
  }
  if (firstHalfMove < -0.02 && secondHalfRangePct < 0.01) {
    return { pattern: "bear_flag", confidence: Math.min(90, Math.round(50 + Math.abs(firstHalfMove) * 1000)) };
  }

  return { pattern: null, confidence: 0 };
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

  // Finnhub's free tier no longer includes historical candles, so we maintain
  // our own rolling price history and compute technicals from it. Fetch all
  // symbols' history in one round trip instead of one query per symbol.
  //
  // IMPORTANT: this table has 100k+ rows, and PostgREST caps every response
  // at 1000 rows *regardless* of an explicit .limit() beyond that -- an
  // earlier version of this query relied on .limit(SYMBOLS.length * 60) alone
  // and got silently capped to the newest 1000 rows total, which (spread
  // across 76 symbols) works out to only ~13 samples per symbol: enough to
  // clear RSI's 15-sample floor only some of the time, and never enough for
  // Bollinger's 20-sample floor. Paginating with .range() in 1000-row pages
  // is what actually gets each symbol its full 60-sample window.
  const HISTORY_TARGET = SYMBOLS.length * 60;
  const PAGE_SIZE = 1000;
  const allHistory: Array<{ symbol: string; price: number; recorded_at: string }> = [];
  for (let offset = 0; offset < HISTORY_TARGET; offset += PAGE_SIZE) {
    const { data: page } = await supabase
      .from("stock_price_history")
      .select("symbol, price, recorded_at")
      .in("symbol", SYMBOLS.map((s) => s.symbol))
      .order("recorded_at", { ascending: false })
      .range(offset, Math.min(offset + PAGE_SIZE, HISTORY_TARGET) - 1);
    if (!page || page.length === 0) break;
    allHistory.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  const historyBySymbol = new Map<string, number[]>();
  for (const row of allHistory) {
    const list = historyBySymbol.get(row.symbol) ?? [];
    list.push(Number(row.price));
    historyBySymbol.set(row.symbol, list);
  }
  for (const list of historyBySymbol.values()) list.reverse();

  const fetchOne = async ({ symbol, name }: { symbol: string; name: string }) => {
    const quoteRes = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_API_KEY}`,
    );
    const quote = await quoteRes.json();
    if (!quote || typeof quote.c !== "number" || quote.c === 0) {
      throw new Error("No quote data returned");
    }

    const price = quote.c;
    const closes = [...(historyBySymbol.get(symbol) ?? []).slice(-60), price];

    const change = quote.d ?? 0;
    const changePercent = quote.dp ?? 0;
    const prevClose = quote.pc ?? price;
    const sma20 = sma(closes, 20) || price;
    const ema9 = ema(closes, 9) || price;
    const rsiVal = rsi(closes);
    const macdVal = macd(closes);

    const signal = rsiVal < 35 && price >= sma20 ? "buy" : rsiVal > 68 ? "sell" : "hold";
    const entry = signal === "buy" ? price * 0.99 : price;
    const exitPrice = signal === "buy" ? price * 1.08 : price * 0.95;
    const { pattern, confidence: patternConfidence } = detectPattern(closes);
    const pctB = bollingerPctB(closes);

    return {
      symbol,
      name,
      price,
      change,
      change_percent: changePercent,
      volume: quote.v ?? 0,
      signal,
      entry,
      exit_price: exitPrice,
      pattern,
      pattern_confidence: pattern ? patternConfidence : null,
      rsi: rsiVal,
      macd: macdVal,
      sma20,
      ema9,
      bollinger_pct_b: pctB,
      prev_close: prevClose,
      category: "core",
      hold_duration: "Swing",
      fetched_at: new Date().toISOString(),
    };
  };

  // Finnhub's free tier caps out at 60 calls/minute, and the tracked list
  // has grown past that -- a handful of these may 429 on any given run.
  // That's fine: fetchOne already turns a bad response into a per-symbol
  // error via Promise.allSettled, so it just skips this cycle and picks
  // up fresh data on the next 5-minute cron tick instead of failing hard.
  const settled = await Promise.allSettled(SYMBOLS.map(fetchOne));
  const results: Array<Record<string, unknown>> = [];
  settled.forEach((r, i) => {
    if (r.status === "fulfilled") results.push(r.value);
    else errors.push({ symbol: SYMBOLS[i].symbol, message: r.reason instanceof Error ? r.reason.message : String(r.reason) });
  });

  if (results.length > 0) {
    const { error } = await supabase.from("stock_cache").upsert(results, { onConflict: "symbol" });
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // One batched insert for every symbol's new sample instead of N separate ones.
    await supabase.from("stock_price_history").insert(
      results.map((r) => ({ symbol: r.symbol, price: r.price })),
    );
  }

  // Keep price history bounded: we only ever read the most recent 60 samples
  // per symbol, so anything older than 7 days is pure dead weight.
  const cutoff = new Date(Date.now() - 7 * 86400_000).toISOString();
  await supabase.from("stock_price_history").delete().lt("recorded_at", cutoff);

  return new Response(
    JSON.stringify({ updated: results.length, errors }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
