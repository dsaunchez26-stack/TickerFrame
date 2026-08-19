import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { TRACKED_TICKERS } from "../_shared/symbols.ts";

// This used to be its own hand-copied 76-symbol list that never got updated
// when the shared tracked universe grew to 114 (the same ticker-list-drift
// bug already found and fixed in the other 4 scanners) -- silently missing
// options coverage on every ticker added since. SPY/QQQ are added back
// explicitly: they're intentionally included for options liquidity as
// broad-market index ETFs, not because they're part of the tracked-stock
// fundamentals universe, so they aren't in TRACKED_TICKERS itself.
const TICKERS = [...TRACKED_TICKERS, "SPY", "QQQ"];

interface TradierOption {
  strike: number;
  bid: number | null;
  ask: number | null;
  last: number | null;
  volume: number | null;
  open_interest: number | null;
  option_type: "call" | "put";
  greeks?: { delta?: number; gamma?: number; mid_iv?: number; smv_vol?: number } | null;
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

function scoreRow(volume: number, oi: number, dollarFlow: number, gamma: number, price: number, ivRank: number, patternBonus: number) {
  const voi = oi > 0 ? volume / oi : 0;
  const liquidity = Math.min(25, Math.log10(volume + 1) * 6);
  const flowScore = Math.min(30, voi * 8 + Math.log10(dollarFlow + 1) * 1.5);
  const gpd = (gamma * 1000) / Math.max(price, 0.5);
  const gammaScore = Math.min(25, gpd * 3);
  const ivScore = Math.max(0, 10 - ivRank / 10);
  return { score: Math.max(0, Math.min(100, Math.round(liquidity + flowScore + gammaScore + ivScore + patternBonus))), voi };
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
    // A protective leg only ~5 cents cheaper than the short leg it's meant
    // to offset is almost always a stale/illiquid quote on a rarely-traded
    // strike, not a genuine near-riskless credit -- require the "loss" side
    // of the spread to be at least a meaningful fraction of the width.
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
    // A protective leg only a few cents cheaper than the short leg it's meant
    // to offset is almost always a stale/illiquid quote on a rarely-traded
    // strike, not a genuine near-riskless credit -- require the "loss" side
    // of the spread to be at least a meaningful fraction of the width.
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
  // Long leg: deep ITM, delta magnitude between 0.70 and 0.92 -- deep enough
  // to move almost dollar-for-dollar with the stock, shallow enough to still
  // cost meaningfully less than the shares themselves. Thin, far-dated ITM
  // strikes are prone to stale/unreliable quotes -- a real option can never
  // trade below its own intrinsic value, so any leg that does is a bad quote,
  // not a bargain, and gets filtered out here.
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
    // Simplified approximation, not a full pricing model: the width between
    // strikes minus what was paid, i.e. roughly what this is worth if the
    // stock finishes right at the short strike at the short leg's
    // expiration. The long leg still carries real time value at that point
    // that this doesn't attempt to model -- treat this as a ballpark, not a
    // guaranteed payout.
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const TRADIER_API_KEY = Deno.env.get("TRADIER_API_KEY");
  if (!TRADIER_API_KEY) {
    return new Response(JSON.stringify({ error: "TRADIER_API_KEY is not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Sandbox market data is real (not simulated), just tied to a free
  // developer account instead of a funded brokerage account -- current-day
  // quotes, not delayed the way the previous provider's free tier was.
  const base = "https://sandbox.tradier.com/v1";
  const headers = { Authorization: `Bearer ${TRADIER_API_KEY}`, Accept: "application/json" };
  const source = "tradier-sandbox";

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let expWindowDays = 45;
  try {
    const body = await req.json();
    if (typeof body?.expWindowDays === "number") expWindowDays = body.expWindowDays;
  } catch {
    // no body provided, use default
  }

  // A genuine IV Rank needs the underlying's own recent IV range, not just
  // its raw IV value rescaled -- fetch each ticker's history in one round trip.
  //
  // IMPORTANT: PostgREST caps every response at 1000 rows regardless of an
  // explicit .limit() beyond that (same issue found and fixed in
  // fetch-stock-data's price-history query). TICKERS.length * 90 is well
  // past 1000, so without pagination this silently returns only the newest
  // ~1000 rows total -- at this scan's cadence that's roughly 13 samples per
  // ticker instead of up to 90, narrowing the min/max range IV Rank is
  // computed from. Paginating with .range() in 1000-row pages actually gets
  // each ticker its full history window.
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

  // The underlying's own chart pattern (already detected by fetch-stock-data
  // from real price history) -- attached here purely as descriptive context
  // on every contract, and used by the CSP/covered-call screeners as a real
  // ranking factor (does the chart support the premium-seller's thesis).
  const { data: patternRows } = await supabase
    .from("stock_cache")
    .select("symbol, pattern, pattern_confidence")
    .in("symbol", TICKERS);
  const patternBySymbol = new Map<string, { pattern: string | null; confidence: number | null }>();
  for (const row of patternRows ?? []) {
    patternBySymbol.set(row.symbol, { pattern: row.pattern, confidence: row.pattern_confidence });
  }

  // The underlying's actual realized volatility (computed separately by
  // realized-volatility-scanner on its own schedule -- an expensive
  // per-ticker history calc doesn't belong inline in a function this
  // latency-sensitive). IV Rank alone only says "rich or cheap relative to
  // this ticker's OWN past IV" -- it says nothing about whether the options
  // market is currently pricing in more or less movement than the stock is
  // actually making. That IV/RV ratio is what the income-strategy screens
  // use to prefer shorter-dated contracts when premium is rich relative to
  // realized movement, and longer-dated ones when it isn't.
  const { data: rvRows } = await supabase
    .from("realized_volatility")
    .select("symbol, rv_annualized")
    .in("symbol", TICKERS);
  const rvBySymbol = new Map<string, number | null>(
    (rvRows ?? []).map((r) => [r.symbol, r.rv_annualized !== null ? Number(r.rv_annualized) : null]),
  );

  // One batched call for every ticker's spot price, instead of one call per
  // ticker -- Tradier's chain endpoint doesn't include the underlying price
  // the way the previous provider's did.
  const spotBySymbol = new Map<string, number>();
  try {
    const quoteRes = await fetch(`${base}/markets/quotes?symbols=${TICKERS.join(",")}`, { headers });
    if (quoteRes.ok) {
      const quoteJson = await quoteRes.json();
      const raw = quoteJson?.quotes?.quote;
      const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
      for (const q of list) {
        if (q?.symbol && typeof q.last === "number" && q.last > 0) spotBySymbol.set(q.symbol, q.last);
      }
    }
  } catch {
    // handled per-ticker below via the "no spot price" error
  }

  const nearestExpiration = (dates: string[], targetDays: number, now: number) => {
    const targetMs = now + targetDays * 86400_000;
    return dates.reduce((closest, d) => {
      const dMs = new Date(d).getTime();
      const closestMs = new Date(closest).getTime();
      return Math.abs(dMs - targetMs) < Math.abs(closestMs - targetMs) ? d : closest;
    }, dates[0]);
  };

  const scanExpiration = async (ticker: string, expiration: string, spot: number, now: number) => {
    const localRows: Record<string, unknown>[] = [];
    let localCandidates = 0;

    const chainRes = await fetch(
      `${base}/markets/options/chains?symbol=${ticker}&expiration=${expiration}&greeks=true`,
      { headers },
    );
    if (!chainRes.ok) {
      throw new Error(`chain request failed: ${await chainRes.text()}`);
    }
    const chainJson = await chainRes.json();
    const options: TradierOption[] = Array.isArray(chainJson?.options?.option) ? chainJson.options.option : [];
    if (!options.length) {
      throw new Error("no option contracts returned");
    }

    const n = options.length;

    // A representative IV for this ticker right now: average IV across
    // near-the-money contracts (within 5% of spot), which is what "IV Rank"
    // is normally measured against rather than any single strike's IV.
    const atmIvs: number[] = [];
    for (const o of options) {
      const iv = o.greeks?.mid_iv || o.greeks?.smv_vol;
      if (!spot || !iv || iv <= 0) continue;
      if (Math.abs(o.strike - spot) / spot < 0.05) atmIvs.push(iv);
    }
    const currentIv = atmIvs.length ? atmIvs.reduce((a, b) => a + b, 0) / atmIvs.length : null;

    // > 1 means the market is pricing in more movement than the stock has
    // actually been making (premium looks rich relative to real behavior);
    // < 1 means the reverse (premium looks cheap relative to real behavior).
    const rv = rvBySymbol.get(ticker) ?? null;
    const ivRvRatio = currentIv !== null && rv !== null && rv > 0 ? +(currentIv / rv).toFixed(2) : null;

    let ivRank = 50;
    if (currentIv !== null) {
      const priorIvs = ivHistoryByTicker.get(ticker) ?? [];
      const allIvs = [...priorIvs, currentIv];
      const minIv = Math.min(...allIvs);
      const maxIv = Math.max(...allIvs);
      // Need a handful of real historical samples before the range is
      // meaningful -- otherwise this is just "100% because it's the only
      // point we've ever seen", which is a range-of-one, not a rank.
      ivRank = priorIvs.length >= 5 && maxIv > minIv
        ? Math.round(((currentIv - minIv) / (maxIv - minIv)) * 100)
        : Math.min(100, Math.round(currentIv * 100));
    }

    const dte = Math.round((new Date(expiration).getTime() - now) / 86400_000);

    // Expected move: how far the stock is priced to move by expiration, using
    // two independent methods that should roughly agree when the chain is
    // pricing things consistently.
    //   1) Textbook formula: stock price x IV x sqrt(time in years). This is
    //      a ONE STANDARD DEVIATION move under the lognormal-returns model
    //      IV itself is quoted against -- statistically, about a 68% chance
    //      the stock finishes within +/- this amount by expiration. A 2 SD
    //      move (~95% confidence) would be roughly double this, not "twice
    //      as likely" -- the width grows, the underlying odds don't scale
    //      linearly.
    //   2) ATM straddle: the combined price of the closest-to-money call and
    //      put. A plain sum only captures ~80% of a true 1 SD move (a known
    //      property of how straddle prices relate to the lognormal
    //      distribution), so it's scaled by 1.25 to land on the same 1 SD
    //      estimate as method 1 instead of understating it.
    // Where both exist we average them into one robust number; where only
    // one is available (e.g. no ATM IV sample this scan), we fall back to
    // whichever exists.
    let atmCallPrice: number | null = null;
    let atmPutPrice: number | null = null;
    let atmCallDiff = Infinity;
    let atmPutDiff = Infinity;
    const calls: Leg[] = [];
    const puts: Leg[] = [];
    for (const o of options) {
      const strikeI = o.strike;
      if (!spot || !strikeI) continue;
      const bidI = o.bid ?? 0;
      const askI = o.ask ?? 0;
      const priceI = o.last || (bidI + askI) / 2;
      if (!priceI) continue;
      const deltaI = o.greeks?.delta ?? 0;
      // A real, currently-tradable market needs an actual nonzero bid --
      // this is stricter than the ATM-straddle check below on purpose,
      // since spreads/diagonals combine two legs' prices together and a
      // single stale/zero-bid leg would corrupt both sides of the math.
      if (bidI > 0) {
        const leg: Leg = { strike: strikeI, price: priceI, bid: bidI, ask: askI, delta: deltaI };
        if (o.option_type === "call") calls.push(leg); else puts.push(leg);
      }
      const diff = Math.abs(strikeI - spot);
      if (o.option_type === "call" && diff < atmCallDiff) { atmCallDiff = diff; atmCallPrice = priceI; }
      if (o.option_type === "put" && diff < atmPutDiff) { atmPutDiff = diff; atmPutPrice = priceI; }
    }

    const timeYears = Math.max(dte, 0) / 365;
    const expectedMoveFormula = currentIv !== null && spot > 0
      ? spot * currentIv * Math.sqrt(timeYears)
      : null;
    const expectedMoveStraddle = atmCallPrice !== null && atmPutPrice !== null
      ? (atmCallPrice + atmPutPrice) * 1.25
      : null;
    const expectedMove = expectedMoveFormula !== null && expectedMoveStraddle !== null
      ? (expectedMoveFormula + expectedMoveStraddle) / 2
      : expectedMoveFormula ?? expectedMoveStraddle;
    const expectedMovePct = expectedMove !== null && spot > 0 ? (expectedMove / spot) * 100 : null;

    // Same IV, just re-scaled to a single trading day instead of time-to-
    // expiration -- useful for judging how much a stock could realistically
    // gap overnight, independent of how far out this particular expiration is.
    const oneDayExpectedMove = currentIv !== null && spot > 0 ? spot * currentIv * Math.sqrt(1 / 365) : null;
    const oneDayExpectedMovePct = oneDayExpectedMove !== null && spot > 0 ? (oneDayExpectedMove / spot) * 100 : null;

    const term = dte > 300 ? "LEAPS" : dte < 8 ? "Weekly" : "Monthly";

    const creditSpreads = [
      ...buildCallCreditSpreads(calls, spot, ticker, expiration, term, expectedMove, expectedMovePct !== null ? +expectedMovePct.toFixed(2) : null),
      ...buildPutCreditSpreads(puts, spot, ticker, expiration, term, expectedMove, expectedMovePct !== null ? +expectedMovePct.toFixed(2) : null),
    ];

    for (const o of options) {
      localCandidates++;
      const volume = o.volume ?? 0;
      const oi = o.open_interest ?? 0;
      // A whole expiration series occasionally shows 0 open interest while
      // volume is still populated (or vice versa) -- require real signal
      // from either field, not both at once.
      if (volume === 0 && oi === 0) continue;

      const bid = o.bid ?? 0;
      const ask = o.ask ?? 0;
      const price = o.last || (bid + ask) / 2;
      if (!price) continue;

      const delta = o.greeks?.delta ?? 0;
      const gamma = o.greeks?.gamma ?? 0;
      const dollarFlow = volume * price * 100;
      const side = o.option_type === "call" ? "C" : "P";
      const patternInfo = patternBySymbol.get(ticker);
      const { score, voi } = scoreRow(volume, oi, dollarFlow, gamma, price, ivRank, patternScore(side, patternInfo?.pattern ?? null));
      // Derive the id from the contract's actual identity (strike + side +
      // expiration) rather than its array position -- the array order isn't
      // stable across scans, which would otherwise let two different
      // contracts collide on the same id (or silently swap identities)
      // between runs. Expiration must be part of this: a ticker is scanned
      // across multiple expirations per run, so strike+side alone collides
      // whenever the same strike/side shows up at more than one expiration
      // (confirmed live -- e.g. two different RIOT $15 puts one week apart
      // both producing "RIOT-15002", causing React key collisions and
      // letting one silently overwrite the other in tracked-picks lookups).
      const strikeCents = Math.round(o.strike * 100);
      const contractId = strikeCents * 10 + (side === "C" ? 1 : 2);

      // Breakeven vs. the chain's expected move: how far the stock has to
      // move for this contract to break even, compared to how far it's
      // statistically priced to move (1 SD) by expiration. A ratio above 1
      // means breakeven needs a bigger-than-typical move to get there (a
      // more conservative premium-selling setup); below 1 means breakeven
      // sits inside the range the stock routinely moves within.
      const breakeven = side === "C" ? o.strike + price : o.strike - price;
      const breakevenMovePct = spot > 0 ? (Math.abs(breakeven - spot) / spot) * 100 : undefined;
      const beVsExpectedMove = breakevenMovePct !== undefined && expectedMovePct
        ? +(breakevenMovePct / expectedMovePct).toFixed(2)
        : null;
      const withinExpectedMove = expectedMove !== null ? Math.abs(o.strike - spot) <= expectedMove : null;

      localRows.push({
        id: `${ticker}-${contractId}-${expiration}`,
        score,
        ticker,
        cp: side,
        stockPrice: spot,
        sector: "Other",
        type: term,
        strike: o.strike,
        expiration,
        price,
        bid,
        ask,
        delta,
        gamma,
        gpRatio: +((gamma / Math.max(price, 0.5)) * 100).toFixed(2),
        ivRank,
        ivRvRatio,
        volume,
        oi,
        voi: +voi.toFixed(2),
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
        pattern: patternInfo?.pattern ?? null,
        patternConfidence: patternInfo?.confidence ?? undefined,
      });
    }

    return {
      rows: localRows, candidates: localCandidates, currentIv, creditSpreads,
      spot, dte, term, expectedMove,
      expectedMovePct: expectedMovePct !== null ? +expectedMovePct.toFixed(2) : null,
      callLegs: calls, putLegs: puts,
    };
  };

  // Covered-call / cash-secured-put candidates need genuine LEAPS contracts
  // (300+ days out), which the near-term scan never sees -- it only ever
  // targets ~45 days out. Fetch a second, explicitly long-dated expiration
  // per ticker rather than trying to stretch the existing window, since a
  // single global "top 80 by score" cutoff would otherwise let low-volume
  // LEAPS get crowded out entirely by more-liquid near-term contracts.
  const LONG_TERM_TARGET_DAYS = 365;

  const scanTicker = async (ticker: string) => {
    const spot = spotBySymbol.get(ticker);
    if (!spot) throw new Error("no spot price available");

    const expRes = await fetch(`${base}/markets/options/expirations?symbol=${ticker}&includeAllRoots=true&strikes=false`, { headers });
    if (!expRes.ok) {
      throw new Error(`expirations request failed: ${await expRes.text()}`);
    }
    const expJson = await expRes.json();
    const dates: string[] = Array.isArray(expJson?.expirations?.date) ? expJson.expirations.date : [];
    if (!dates.length) throw new Error("no expirations returned");

    const now = Date.now();
    const nearExpiration = nearestExpiration(dates, expWindowDays, now);
    const longExpiration = nearestExpiration(dates, LONG_TERM_TARGET_DAYS, now);

    const near = await scanExpiration(ticker, nearExpiration, spot, now);
    // Only bother with a second fetch if a genuinely different, further-out
    // expiration actually exists -- some tickers just don't list anything
    // near a year out.
    const long = longExpiration !== nearExpiration
      ? await scanExpiration(ticker, longExpiration, spot, now)
      : { rows: [], candidates: 0, currentIv: null, creditSpreads: [], spot, dte: 0, term: "LEAPS", expectedMove: null, expectedMovePct: null, callLegs: [] as Leg[], putLegs: [] as Leg[] };

    // Poor man's covered call / poor man's cash-secured put: pair the LEAPS
    // chain's deep-ITM leg with the near-term chain's OTM leg. Needs both
    // scans to have actually returned usable strikes.
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

  // 76 tickers x up to 3 calls each (expirations + near/long chains) is well
  // past what's safe to fire in one burst against the sandbox's rate limit.
  // Running in small concurrent batches with a short pause between them
  // keeps the sustained request rate reasonable without needing to know the
  // exact window semantics -- same pacing approach used elsewhere in this
  // app for other rate-limited providers.
  const BATCH_SIZE = 10;
  const BATCH_PAUSE_MS = 1200;
  const settled: PromiseSettledResult<Awaited<ReturnType<typeof scanTicker>>>[] = [];
  for (let i = 0; i < TICKERS.length; i += BATCH_SIZE) {
    const batch = TICKERS.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.allSettled(batch.map(scanTicker));
    settled.push(...batchResults);
    if (i + BATCH_SIZE < TICKERS.length) await new Promise((r) => setTimeout(r, BATCH_PAUSE_MS));
  }
  const rows: Record<string, unknown>[] = [];
  const leapsRows: Record<string, unknown>[] = [];
  const creditSpreads: Record<string, unknown>[] = [];
  const diagonals: Record<string, unknown>[] = [];
  const errors: Array<{ ticker: string; message: string }> = [];
  const ivSamples: Array<{ ticker: string; iv: number }> = [];
  let candidates = 0;
  settled.forEach((r, i) => {
    if (r.status === "fulfilled") {
      for (const row of r.value.rows) {
        if (row.type === "LEAPS") leapsRows.push(row);
        else rows.push(row);
      }
      creditSpreads.push(...r.value.creditSpreads);
      diagonals.push(...r.value.diagonals);
      candidates += r.value.candidates;
      if (r.value.currentIv !== null) ivSamples.push({ ticker: r.value.ticker, iv: r.value.currentIv });
    } else {
      errors.push({ ticker: TICKERS[i], message: r.reason instanceof Error ? r.reason.message : String(r.reason) });
    }
  });
  const scanned = TICKERS.length;

  if (ivSamples.length > 0) {
    await supabase.from("option_iv_history").insert(ivSamples);
  }

  rows.sort((a, b) => (b.score as number) - (a.score as number));
  const top = rows.slice(0, 80);
  // LEAPS never compete with near-term contracts for a spot here -- they're
  // naturally lower-volume/lower-score and would otherwise always lose out.
  leapsRows.sort((a, b) => (b.score as number) - (a.score as number));
  const topLeaps = leapsRows.slice(0, 150);
  // Spreads/diagonals aren't scored the same way (no volume/OI concept for a
  // constructed 2-leg position) -- rank by return on capital at risk instead
  // and cap the list so the payload doesn't balloon.
  creditSpreads.sort((a, b) => (b.returnOnRisk as number) - (a.returnOnRisk as number));
  const topSpreads = creditSpreads.slice(0, 200);
  diagonals.sort((a, b) => (b.maxGainApprox as number) - (a.maxGainApprox as number));
  const topDiagonals = diagonals.slice(0, 100);

  // Cache every successful scan and fall back to it if a run comes back
  // empty (e.g. a transient sandbox outage), so users don't see a blank
  // scanner for no real reason.
  if (top.length > 0) {
    const payload = {
      rows: top, leapsRows: topLeaps, creditSpreads: topSpreads, diagonals: topDiagonals,
      source, scanned, candidates, count: top.length, errors,
    };
    await supabase.from("options_scan_cache").upsert({ id: true, payload, scanned_at: new Date().toISOString() });
    return new Response(JSON.stringify(payload), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: cached } = await supabase
    .from("options_scan_cache")
    .select("payload, scanned_at")
    .eq("id", true)
    .maybeSingle();

  if (cached) {
    return new Response(
      JSON.stringify({ ...cached.payload, cached: true, cachedAt: cached.scanned_at, errors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  return new Response(
    JSON.stringify({
      rows: top, leapsRows: topLeaps, creditSpreads: topSpreads, diagonals: topDiagonals,
      source, scanned, candidates, count: top.length, errors,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
