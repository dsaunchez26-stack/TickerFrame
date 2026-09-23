import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { TRACKED_TICKERS } from "../_shared/symbols.ts";
import { alpacaHeaders, fetchFullChain, snapshotPrice, type AlpacaChainContract } from "../_shared/alpaca.ts";
import { greeksFromPrice } from "../_shared/blackScholes.ts";

// This used to be its own hand-copied 76-symbol list that never got updated
// when the shared tracked universe grew to 114 (the same ticker-list-drift
// bug already found and fixed in the other 4 scanners) -- silently missing
// options coverage on every ticker added since. SPY/QQQ are added back
// explicitly: they're intentionally included for options liquidity as
// broad-market index ETFs, not because they're part of the tracked-stock
// fundamentals universe, so they aren't in TRACKED_TICKERS itself.
const TICKERS = [...TRACKED_TICKERS, "SPY", "QQQ"];

interface NormalizedOption {
  strike: number;
  bid: number;
  ask: number;
  price: number;
  volume: number;
  cp: "C" | "P";
  delta: number;
  gamma: number;
  iv: number | null;
}

interface Leg {
  strike: number;
  price: number;
  bid: number;
  ask: number;
  delta: number;
}

// Does the underlying's own recent chart pattern support the direction this
// contract profits from -- a call pairs with a bullish pattern, a put with a
// bearish one. Deliberately a small nudge (+/-5 of 100), not a dominant
// factor: liquidity, flow, and the option chain's own pricing still carry
// most of the weight, this just tips close calls toward the setups where
// price action and the option's own thesis agree.
function patternScore(cp: "C" | "P", pattern: string | null): number {
  if (!pattern) return 0;
  const bullish = pattern === "breakout" || pattern === "bull_flag";
  const bearish = pattern === "breakdown" || pattern === "bear_flag";
  if (cp === "C") return bullish ? 5 : bearish ? -5 : 0;
  return bearish ? 5 : bullish ? -5 : 0;
}

// Open interest isn't available from Alpaca's free options feed at all (not
// a tier restriction -- it's just not a field they report), so the old
// volume/OI ("V/OI") flow signal has nothing to divide by. Rather than fake
// a ratio, its weight is redistributed onto the two signals that are still
// real: raw volume (liquidity) and dollar flow -- both actual traded amounts,
// not estimates. Gamma and IV-rank weights are unchanged.
function scoreRow(volume: number, dollarFlow: number, gamma: number, price: number, ivRank: number, patternBonus: number) {
  const liquidity = Math.min(30, Math.log10(volume + 1) * 8);
  const flowScore = Math.min(35, Math.log10(dollarFlow + 1) * 5);
  const gpd = (gamma * 1000) / Math.max(price, 0.5);
  const gammaScore = Math.min(25, gpd * 3);
  const ivScore = Math.max(0, 10 - ivRank / 10);
  return { score: Math.max(0, Math.min(100, Math.round(liquidity + flowScore + gammaScore + ivScore + patternBonus))) };
}

// Bear call credit spread (sell a call, buy the next strike up as protection)
// or bull put credit spread (sell a put, buy the next strike down as
// protection). Unlike a naked short, max loss here is genuinely capped at
// the strike width minus the credit collected -- there is no scenario where
// this loses more than that, no matter how far the stock moves.
function buildCallCreditSpreads(
  calls: Leg[], spot: number, ticker: string, expiration: string, term: string,
  expectedMove: number | null, expectedMovePct: number | null,
): Record<string, unknown>[] {
  const sorted = [...calls].sort((a, b) => a.strike - b.strike);
  const out: Record<string, unknown>[] = [];
  for (const short of sorted) {
    if (short.strike <= spot) continue;
    const shortDelta = Math.abs(short.delta);
    if (shortDelta < 0.10 || shortDelta > 0.35) continue;
    const long = sorted.find((c) => c.strike > short.strike);
    if (!long) continue;
    const width = long.strike - short.strike;
    const netCredit = short.price - long.price;
    if (netCredit <= 0) continue;
    const maxLoss = width - netCredit;
    if (maxLoss < width * 0.10) continue;
    const withinExpectedMove = expectedMove !== null ? Math.abs(short.strike - spot) <= expectedMove : null;
    out.push({
      id: `${ticker}-CCS-${Math.round(short.strike * 100)}-${Math.round(long.strike * 100)}-${expiration}`,
      ticker, strategy: "call_credit_spread", term, expiration, stockPrice: spot,
      shortStrike: short.strike, longStrike: long.strike, width: +width.toFixed(2),
      shortDelta: short.delta, netCredit: +netCredit.toFixed(2), maxLoss: +maxLoss.toFixed(2),
      maxGain: +netCredit.toFixed(2), returnOnRisk: +((netCredit / maxLoss) * 100).toFixed(2),
      expectedMovePct, withinExpectedMove,
    });
  }
  return out;
}

function buildPutCreditSpreads(
  puts: Leg[], spot: number, ticker: string, expiration: string, term: string,
  expectedMove: number | null, expectedMovePct: number | null,
): Record<string, unknown>[] {
  const sorted = [...puts].sort((a, b) => b.strike - a.strike);
  const out: Record<string, unknown>[] = [];
  for (const short of sorted) {
    if (short.strike >= spot) continue;
    const shortDelta = Math.abs(short.delta);
    if (shortDelta < 0.10 || shortDelta > 0.35) continue;
    const long = sorted.find((p) => p.strike < short.strike);
    if (!long) continue;
    const width = short.strike - long.strike;
    const netCredit = short.price - long.price;
    if (netCredit <= 0) continue;
    const maxLoss = width - netCredit;
    if (maxLoss < width * 0.10) continue;
    const withinExpectedMove = expectedMove !== null ? Math.abs(short.strike - spot) <= expectedMove : null;
    out.push({
      id: `${ticker}-PCS-${Math.round(short.strike * 100)}-${Math.round(long.strike * 100)}-${expiration}`,
      ticker, strategy: "put_credit_spread", term, expiration, stockPrice: spot,
      shortStrike: short.strike, longStrike: long.strike, width: +width.toFixed(2),
      shortDelta: short.delta, netCredit: +netCredit.toFixed(2), maxLoss: +maxLoss.toFixed(2),
      maxGain: +netCredit.toFixed(2), returnOnRisk: +((netCredit / maxLoss) * 100).toFixed(2),
      expectedMovePct, withinExpectedMove,
    });
  }
  return out;
}

// "Poor man's covered call/put" -- a deep-in-the-money LEAPS option (delta
// ~0.75-0.90) used as a stock stand-in, with a near-term out-of-the-money
// option sold against it for income. The stock-replacement leg still costs
// real money and can lose everything it cost (same as any long option), but
// the position's total max loss is capped at the net debit paid to enter --
// there is no naked/unlimited side to it, because the "short" leg is always
// backed by the long leg's intrinsic value moving the same direction.
function buildDiagonals(
  longLegs: Leg[], shortLegs: Leg[], spot: number, ticker: string,
  longExpiration: string, shortExpiration: string, side: "call" | "put",
  shortExpectedMove: number | null, shortExpectedMovePct: number | null,
): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const longCandidates = longLegs.filter((l) => {
    if (Math.abs(l.delta) < 0.70 || Math.abs(l.delta) > 0.92) return false;
    const intrinsic = side === "call" ? Math.max(0, spot - l.strike) : Math.max(0, l.strike - spot);
    return l.price >= intrinsic * 0.95;
  });
  if (!longCandidates.length) return out;
  const long = longCandidates.reduce((best, l) =>
    Math.abs(Math.abs(l.delta) - 0.80) < Math.abs(Math.abs(best.delta) - 0.80) ? l : best);

  const shortCandidates = shortLegs.filter((s) => {
    const d = Math.abs(s.delta);
    if (d < 0.10 || d > 0.35) return false;
    return side === "call" ? s.strike > long.strike : s.strike < long.strike;
  });
  for (const short of shortCandidates) {
    const netDebit = long.price - short.price;
    if (netDebit <= 0) continue;
    const width = side === "call" ? short.strike - long.strike : long.strike - short.strike;
    const maxGainApprox = width - netDebit;
    const withinExpectedMove = shortExpectedMove !== null ? Math.abs(short.strike - spot) <= shortExpectedMove : null;
    out.push({
      id: `${ticker}-${side === "call" ? "PMCC" : "PMCP"}-${Math.round(long.strike * 100)}-${Math.round(short.strike * 100)}-${shortExpiration}`,
      ticker, strategy: side === "call" ? "poor_mans_covered_call" : "poor_mans_cash_secured_put",
      stockPrice: spot,
      longStrike: long.strike, longDelta: long.delta, longPrice: long.price, longExpiration,
      shortStrike: short.strike, shortDelta: short.delta, shortPrice: short.price, shortExpiration,
      netDebit: +netDebit.toFixed(2), maxLossApprox: +netDebit.toFixed(2),
      maxGainApprox: +maxGainApprox.toFixed(2),
      expectedMovePct: shortExpectedMovePct, withinExpectedMove,
    });
  }
  return out;
}

const source = "alpaca";
const LONG_TERM_TARGET_DAYS = 365;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let alpacaAuthHeaders: Record<string, string>;
  try {
    alpacaAuthHeaders = alpacaHeaders();
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let body: { expWindowDays?: number; mode?: string } = {};
  try {
    body = await req.json();
  } catch {
    // no body provided
  }
  const expWindowDays = typeof body.expWindowDays === "number" ? body.expWindowDays : 45;

  // Two very different jobs share this one function on purpose (same file,
  // same TICKERS list, same scoring logic -- keeping them apart would mean
  // keeping two copies of all of that in sync):
  //   - {"mode":"scan"}, called only by the cron job below: does a real,
  //     rate-limited batch fetch from Alpaca for a slice of tickers and
  //     writes to options_ticker_cache.
  //   - anything else (what the client's own invoke() sends): a fast,
  //     read-only aggregation across whatever's currently cached -- no
  //     external API calls, so it can't be slow or rate-limited.
  if (body.mode !== "scan") {
    return await serveAggregate(supabase);
  }
  return await runScanBatch(supabase, alpacaAuthHeaders, expWindowDays);
});

async function serveAggregate(supabase: ReturnType<typeof createClient>): Promise<Response> {
  const { data: cacheRows, error } = await supabase
    .from("options_ticker_cache")
    .select("ticker, payload, candidates, scanned_at");

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const rows: Record<string, unknown>[] = [];
  const leapsRows: Record<string, unknown>[] = [];
  const creditSpreads: Record<string, unknown>[] = [];
  const diagonals: Record<string, unknown>[] = [];
  let candidates = 0;
  let oldestScan: string | null = null;

  for (const row of cacheRows ?? []) {
    const payload = row.payload as { rows?: Record<string, unknown>[]; creditSpreads?: Record<string, unknown>[]; diagonals?: Record<string, unknown>[] };
    for (const r of payload.rows ?? []) {
      if (r.type === "LEAPS") leapsRows.push(r); else rows.push(r);
    }
    creditSpreads.push(...(payload.creditSpreads ?? []));
    diagonals.push(...(payload.diagonals ?? []));
    candidates += Number(row.candidates) || 0;
    if (!oldestScan || row.scanned_at < oldestScan) oldestScan = row.scanned_at as string;
  }

  rows.sort((a, b) => (b.score as number) - (a.score as number));
  leapsRows.sort((a, b) => (b.score as number) - (a.score as number));
  creditSpreads.sort((a, b) => (b.returnOnRisk as number) - (a.returnOnRisk as number));
  diagonals.sort((a, b) => (b.maxGainApprox as number) - (a.maxGainApprox as number));

  const payload = {
    rows: rows.slice(0, 80),
    leapsRows: leapsRows.slice(0, 150),
    creditSpreads: creditSpreads.slice(0, 200),
    diagonals: diagonals.slice(0, 100),
    source, scanned: TICKERS.length, candidates, count: Math.min(rows.length, 80),
    errors: [],
    // Every response here is served from the rolling cache by design (see
    // the cron comment above) -- cachedAt is always set so the UI can show
    // "as of" freshness honestly instead of implying this second's data.
    cached: true,
    cachedAt: oldestScan ?? new Date().toISOString(),
    tickersCached: (cacheRows ?? []).length,
  };

  return new Response(JSON.stringify(payload), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function runScanBatch(supabase: ReturnType<typeof createClient>, headers: Record<string, string>, expWindowDays: number): Promise<Response> {
  // A genuine IV Rank needs the underlying's own recent IV range, not just
  // its raw IV value rescaled -- fetch each ticker's history in one round trip.
  //
  // IMPORTANT: PostgREST caps every response at 1000 rows regardless of an
  // explicit .limit() beyond that (same issue found and fixed in
  // fetch-stock-data's price-history query). Paginating with .range() in
  // 1000-row pages actually gets each ticker its full history window.
  const IV_HISTORY_TARGET = TICKERS.length * 90;
  const IV_PAGE_SIZE = 1000;
  const allIvHistory: Array<{ ticker: string; iv: number }> = [];
  for (let offset = 0; offset < IV_HISTORY_TARGET; offset += IV_PAGE_SIZE) {
    const { data: page } = await supabase
      .from("option_iv_history")
      .select("ticker, iv")
      .in("ticker", TICKERS)
      .order("recorded_at", { ascending: false })
      .range(offset, Math.min(offset + IV_PAGE_SIZE, IV_HISTORY_TARGET) - 1);
    if (!page || page.length === 0) break;
    allIvHistory.push(...page);
    if (page.length < IV_PAGE_SIZE) break;
  }
  const ivHistoryByTicker = new Map<string, number[]>();
  for (const row of allIvHistory) {
    const list = ivHistoryByTicker.get(row.ticker) ?? [];
    list.push(Number(row.iv));
    ivHistoryByTicker.set(row.ticker, list);
  }

  // Spot price, pattern, and realized volatility all come from this app's
  // own already-fresh tables (Finnhub-backed stock_cache, and
  // realized-volatility-scanner's own output) rather than a second call to
  // Alpaca for the underlying quote -- one round trip covers every ticker.
  const { data: stockRows } = await supabase
    .from("stock_cache")
    .select("symbol, price, pattern, pattern_confidence")
    .in("symbol", TICKERS);
  const stockBySymbol = new Map<string, { price: number; pattern: string | null; confidence: number | null }>();
  for (const row of stockRows ?? []) {
    if (typeof row.price === "number" && row.price > 0) {
      stockBySymbol.set(row.symbol, { price: row.price, pattern: row.pattern, confidence: row.pattern_confidence });
    }
  }

  const { data: rvRows } = await supabase
    .from("realized_volatility")
    .select("symbol, rv_annualized")
    .in("symbol", TICKERS);
  const rvBySymbol = new Map<string, number | null>(
    (rvRows ?? []).map((r) => [r.symbol, r.rv_annualized !== null ? Number(r.rv_annualized) : null]),
  );

  // Only the stalest tickers this run -- see the migration's cron comment
  // for why a full-universe live scan doesn't fit in one invocation against
  // Alpaca's 200 req/min cap. Never-scanned tickers sort first.
  const BATCH_LIMIT = 30;
  const { data: cacheAges } = await supabase
    .from("options_ticker_cache")
    .select("ticker, scanned_at")
    .in("ticker", TICKERS);
  const scannedAtByTicker = new Map((cacheAges ?? []).map((r) => [r.ticker, r.scanned_at as string]));
  const batchTickers = [...TICKERS]
    .sort((a, b) => {
      const aTime = scannedAtByTicker.get(a);
      const bTime = scannedAtByTicker.get(b);
      if (!aTime && !bTime) return 0;
      if (!aTime) return -1;
      if (!bTime) return 1;
      return new Date(aTime).getTime() - new Date(bTime).getTime();
    })
    .slice(0, BATCH_LIMIT);

  const nearestExpiration = (dates: string[], targetDays: number, now: number) => {
    const targetMs = now + targetDays * 86400_000;
    return dates.reduce((closest, d) => {
      const dMs = new Date(d).getTime();
      const closestMs = new Date(closest).getTime();
      return Math.abs(dMs - targetMs) < Math.abs(closestMs - targetMs) ? d : closest;
    }, dates[0]);
  };

  const scanExpiration = (ticker: string, expiration: string, fullChain: AlpacaChainContract[], spot: number, now: number) => {
    const inExp = fullChain.filter((c) => c.expirationDate === expiration);
    if (!inExp.length) throw new Error("no option contracts for this expiration");

    const dte = Math.round((new Date(expiration).getTime() - now) / 86400_000);
    const timeYears = Math.max(dte, 0) / 365;

    const options: NormalizedOption[] = [];
    for (const c of inExp) {
      const price = snapshotPrice(c.snapshot);
      if (price === null || !spot) continue;
      const cp: "C" | "P" = c.type === "call" ? "C" : "P";
      const { iv, delta, gamma } = greeksFromPrice(cp, price, spot, c.strike, timeYears);
      options.push({
        strike: c.strike,
        bid: c.snapshot.latestQuote?.bp ?? 0,
        ask: c.snapshot.latestQuote?.ap ?? 0,
        price,
        volume: c.snapshot.dailyBar?.v ?? 0,
        cp,
        delta,
        gamma,
        iv,
      });
    }
    if (!options.length) throw new Error("no priceable option contracts returned");

    // A representative IV for this ticker right now: average solved IV
    // across near-the-money contracts (within 5% of spot), which is what
    // "IV Rank" is normally measured against rather than any single
    // strike's IV.
    const atmIvs = options.filter((o) => o.iv !== null && Math.abs(o.strike - spot) / spot < 0.05).map((o) => o.iv as number);
    const currentIv = atmIvs.length ? atmIvs.reduce((a, b) => a + b, 0) / atmIvs.length : null;

    const rv = rvBySymbol.get(ticker) ?? null;
    const ivRvRatio = currentIv !== null && rv !== null && rv > 0 ? +(currentIv / rv).toFixed(2) : null;

    let ivRank = 50;
    if (currentIv !== null) {
      const priorIvs = ivHistoryByTicker.get(ticker) ?? [];
      const allIvs = [...priorIvs, currentIv];
      const minIv = Math.min(...allIvs);
      const maxIv = Math.max(...allIvs);
      ivRank = priorIvs.length >= 5 && maxIv > minIv
        ? Math.round(((currentIv - minIv) / (maxIv - minIv)) * 100)
        : Math.min(100, Math.round(currentIv * 100));
    }

    let atmCallPrice: number | null = null;
    let atmPutPrice: number | null = null;
    let atmCallDiff = Infinity;
    let atmPutDiff = Infinity;
    const calls: Leg[] = [];
    const puts: Leg[] = [];
    for (const o of options) {
      if (o.bid > 0) {
        const leg: Leg = { strike: o.strike, price: o.price, bid: o.bid, ask: o.ask, delta: o.delta };
        if (o.cp === "C") calls.push(leg); else puts.push(leg);
      }
      const diff = Math.abs(o.strike - spot);
      if (o.cp === "C" && diff < atmCallDiff) { atmCallDiff = diff; atmCallPrice = o.price; }
      if (o.cp === "P" && diff < atmPutDiff) { atmPutDiff = diff; atmPutPrice = o.price; }
    }

    const expectedMoveFormula = currentIv !== null && spot > 0 ? spot * currentIv * Math.sqrt(timeYears) : null;
    const expectedMoveStraddle = atmCallPrice !== null && atmPutPrice !== null ? (atmCallPrice + atmPutPrice) * 1.25 : null;
    const expectedMove = expectedMoveFormula !== null && expectedMoveStraddle !== null
      ? (expectedMoveFormula + expectedMoveStraddle) / 2
      : expectedMoveFormula ?? expectedMoveStraddle;
    const expectedMovePct = expectedMove !== null && spot > 0 ? (expectedMove / spot) * 100 : null;

    const oneDayExpectedMove = currentIv !== null && spot > 0 ? spot * currentIv * Math.sqrt(1 / 365) : null;
    const oneDayExpectedMovePct = oneDayExpectedMove !== null && spot > 0 ? (oneDayExpectedMove / spot) * 100 : null;

    const term = dte > 300 ? "LEAPS" : dte < 8 ? "Weekly" : "Monthly";

    const creditSpreads = [
      ...buildCallCreditSpreads(calls, spot, ticker, expiration, term, expectedMove, expectedMovePct !== null ? +expectedMovePct.toFixed(2) : null),
      ...buildPutCreditSpreads(puts, spot, ticker, expiration, term, expectedMove, expectedMovePct !== null ? +expectedMovePct.toFixed(2) : null),
    ];

    const localRows: Record<string, unknown>[] = [];
    let localCandidates = 0;
    const stockInfo = stockBySymbol.get(ticker);
    for (const o of options) {
      localCandidates++;
      if (o.volume === 0 && o.bid === 0 && o.ask === 0) continue;

      const dollarFlow = o.volume * o.price * 100;
      const { score } = scoreRow(o.volume, dollarFlow, o.gamma, o.price, ivRank, patternScore(o.cp, stockInfo?.pattern ?? null));
      const strikeCents = Math.round(o.strike * 100);
      const contractId = strikeCents * 10 + (o.cp === "C" ? 1 : 2);

      const breakeven = o.cp === "C" ? o.strike + o.price : o.strike - o.price;
      const breakevenMovePct = spot > 0 ? (Math.abs(breakeven - spot) / spot) * 100 : undefined;
      const beVsExpectedMove = breakevenMovePct !== undefined && expectedMovePct
        ? +(breakevenMovePct / expectedMovePct).toFixed(2)
        : null;
      const withinExpectedMove = expectedMove !== null ? Math.abs(o.strike - spot) <= expectedMove : null;

      localRows.push({
        id: `${ticker}-${contractId}-${expiration}`,
        score,
        ticker,
        cp: o.cp,
        stockPrice: spot,
        sector: "Other",
        type: term,
        strike: o.strike,
        expiration,
        price: o.price,
        bid: o.bid,
        ask: o.ask,
        delta: o.delta,
        gamma: o.gamma,
        gpRatio: +((o.gamma / Math.max(o.price, 0.5)) * 100).toFixed(2),
        ivRank,
        ivRankIsReal: (ivHistoryByTicker.get(ticker)?.length ?? 0) >= 5,
        ivRvRatio,
        volume: o.volume,
        dollarFlow,
        printType: "BLOCK",
        earningsInDays: null,
        squeeze: 0,
        expectedMovePct: expectedMovePct !== null ? +expectedMovePct.toFixed(2) : null,
        oneDayExpectedMovePct: oneDayExpectedMovePct !== null ? +oneDayExpectedMovePct.toFixed(2) : null,
        breakeven: +breakeven.toFixed(2),
        breakevenMovePct: breakevenMovePct !== undefined ? +breakevenMovePct.toFixed(2) : null,
        beVsExpectedMove,
        withinExpectedMove,
        pattern: stockInfo?.pattern ?? null,
        patternConfidence: stockInfo?.confidence ?? undefined,
      });
    }

    return {
      rows: localRows, candidates: localCandidates, currentIv, creditSpreads,
      spot, dte, term, expectedMove,
      expectedMovePct: expectedMovePct !== null ? +expectedMovePct.toFixed(2) : null,
      callLegs: calls, putLegs: puts,
    };
  };

  const scanTicker = async (ticker: string) => {
    const spot = stockBySymbol.get(ticker)?.price;
    if (!spot) throw new Error("no spot price available");

    const fullChain = await fetchFullChain(ticker, headers);
    if (!fullChain.length) throw new Error("no option contracts returned");
    const dates = [...new Set(fullChain.map((c) => c.expirationDate))];

    const now = Date.now();
    const nearExpiration = nearestExpiration(dates, expWindowDays, now);
    const longExpiration = nearestExpiration(dates, LONG_TERM_TARGET_DAYS, now);

    const near = scanExpiration(ticker, nearExpiration, fullChain, spot, now);
    const long = longExpiration !== nearExpiration
      ? scanExpiration(ticker, longExpiration, fullChain, spot, now)
      : { rows: [], candidates: 0, currentIv: null, creditSpreads: [], spot, dte: 0, term: "LEAPS", expectedMove: null, expectedMovePct: null, callLegs: [] as Leg[], putLegs: [] as Leg[] };

    const pmcc = (long.callLegs.length && near.callLegs.length)
      ? buildDiagonals(long.callLegs, near.callLegs, spot, ticker, longExpiration, nearExpiration, "call", near.expectedMove, near.expectedMovePct)
      : [];
    const pmcp = (long.putLegs.length && near.putLegs.length)
      ? buildDiagonals(long.putLegs, near.putLegs, spot, ticker, longExpiration, nearExpiration, "put", near.expectedMove, near.expectedMovePct)
      : [];

    return {
      rows: [...near.rows, ...long.rows],
      candidates: near.candidates + long.candidates,
      ticker,
      currentIv: near.currentIv,
      creditSpreads: [...near.creditSpreads, ...long.creditSpreads],
      diagonals: [...pmcc, ...pmcp],
    };
  };

  // Deliberately conservative pacing: this batch's ~30 tickers x ~3 Alpaca
  // calls each (contracts + up to 2 expiration snapshots) is already close
  // to Alpaca's 200 req/min cap -- small concurrent sub-batches with a pause
  // between them keep the sustained rate safely under that ceiling instead
  // of bursting the whole batch at once and risking 429s mid-run.
  const SUB_BATCH_SIZE = 5;
  const SUB_BATCH_PAUSE_MS = 2500;
  const settled: PromiseSettledResult<Awaited<ReturnType<typeof scanTicker>>>[] = [];
  for (let i = 0; i < batchTickers.length; i += SUB_BATCH_SIZE) {
    const sub = batchTickers.slice(i, i + SUB_BATCH_SIZE);
    const subResults = await Promise.allSettled(sub.map(scanTicker));
    settled.push(...subResults);
    if (i + SUB_BATCH_SIZE < batchTickers.length) await new Promise((r) => setTimeout(r, SUB_BATCH_PAUSE_MS));
  }

  const errors: Array<{ ticker: string; message: string }> = [];
  const ivSamples: Array<{ ticker: string; iv: number }> = [];
  const cacheUpserts: Array<{ ticker: string; payload: unknown; current_iv: number | null; candidates: number; scanned_at: string }> = [];
  const now = new Date().toISOString();

  settled.forEach((r, i) => {
    const ticker = batchTickers[i];
    if (r.status === "fulfilled") {
      cacheUpserts.push({
        ticker,
        payload: { rows: r.value.rows, creditSpreads: r.value.creditSpreads, diagonals: r.value.diagonals },
        current_iv: r.value.currentIv,
        candidates: r.value.candidates,
        scanned_at: now,
      });
      if (r.value.currentIv !== null) ivSamples.push({ ticker: r.value.ticker, iv: r.value.currentIv });
    } else {
      errors.push({ ticker, message: r.reason instanceof Error ? r.reason.message : String(r.reason) });
    }
  });

  if (ivSamples.length > 0) {
    await supabase.from("option_iv_history").insert(ivSamples);
  }
  if (cacheUpserts.length > 0) {
    await supabase.from("options_ticker_cache").upsert(cacheUpserts, { onConflict: "ticker" });
  }

  return new Response(JSON.stringify({ scanned: batchTickers.length, updated: cacheUpserts.length, errors }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
