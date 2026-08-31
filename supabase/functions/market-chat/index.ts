import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { TRACKED_TICKERS } from "../_shared/symbols.ts";
import { broadSector } from "../_shared/sectorMapping.ts";

// A real, working replacement for a "market-chat" function that never
// existed at all -- MarketChat.tsx (the floating widget) has called this
// endpoint since it was written, and every message has failed with a 404
// the whole time. There's no LLM API key configured anywhere in this
// project, so this deliberately isn't a general-purpose language model:
// it's a rule-based assistant that recognizes a fixed set of intents
// (a tracked ticker's current reading, portfolio questions, feature
// explanations) and answers from this site's own real, live data -- never
// fabricated numbers, never a guess at what an LLM might have said.

interface Msg { role: string; content: string }

function sseChunk(text: string): string {
  const payload = JSON.stringify({ choices: [{ delta: { content: text } }] });
  return `data: ${payload}\n\ndata: [DONE]\n\n`;
}

function extractTickers(text: string): string[] {
  const words = Array.from(new Set(text.toUpperCase().match(/\b[A-Z]{1,5}\b/g) ?? []));
  return words.filter((w) => TRACKED_TICKERS.includes(w));
}

function fmtPct(v: number | null): string {
  if (v === null || Number.isNaN(v)) return "n/a";
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Best-effort identity: needed for "my portfolio" questions, but every
  // other intent works fine for an unauthenticated or unrecognized caller.
  let userId: string | null = null;
  const authHeader = req.headers.get("Authorization");
  if (authHeader) {
    const token = authHeader.replace(/^Bearer\s+/i, "");
    try {
      const { data } = await supabase.auth.getUser(token);
      userId = data.user?.id ?? null;
    } catch { /* treat as anonymous */ }
  }

  let messages: Msg[] = [];
  try {
    const body = await req.json();
    messages = Array.isArray(body?.messages) ? body.messages : [];
  } catch { /* no body */ }

  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const text = (lastUser?.content ?? "").trim();
  const t = text.toLowerCase();

  let reply: string;
  try {
    reply = await buildReply(supabase, userId, text, t);
  } catch (e) {
    reply = `Something went wrong looking that up: ${e instanceof Error ? e.message : String(e)}`;
  }

  return new Response(sseChunk(reply), {
    headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
  });
});

async function buildReply(supabase: ReturnType<typeof createClient>, userId: string | null, text: string, t: string): Promise<string> {
  const tickersMentioned = extractTickers(text);

  // --- A specific tracked ticker's current reading ---
  if (tickersMentioned.length === 1 && (t.indexOf("perform") !== -1 || t.indexOf("doing") !== -1 || t.indexOf("how is") !== -1 || t.indexOf("how's") !== -1 || t.indexOf("rsi") !== -1 || t.indexOf("macd") !== -1 || t.indexOf("chart") !== -1 || t.indexOf("price") !== -1)) {
    return await tickerSnapshot(supabase, tickersMentioned[0]);
  }

  // --- Compare two tracked tickers ---
  if (tickersMentioned.length >= 2 && (t.indexOf("compare") !== -1 || t.indexOf(" vs") !== -1 || t.indexOf("versus") !== -1)) {
    return await compareTickers(supabase, tickersMentioned[0], tickersMentioned[1]);
  }
  if (t.indexOf("compare") !== -1 || t.indexOf(" vs ") !== -1 || t.indexOf("versus") !== -1) {
    return "Name two tracked tickers and I'll pull their real Balance Sheet and Growth scores side by side — e.g. \"compare NVDA vs AMD\".";
  }

  // --- Top signals right now ---
  if (t.indexOf("buy signal") !== -1 || t.indexOf("top pick") !== -1 || t.indexOf("top 3") !== -1 || t.indexOf("best stock") !== -1 || t.indexOf("best setup") !== -1) {
    return await topSignals(supabase);
  }

  // --- Insider activity (portfolio-scoped if they say "my") ---
  if (t.indexOf("insider") !== -1) {
    const scopeToPortfolio = userId && (t.indexOf("my") !== -1 || t.indexOf("portfolio") !== -1);
    return await insiderActivity(supabase, scopeToPortfolio ? userId : null);
  }

  // --- News on a portfolio / holdings ---
  if (t.indexOf("news") !== -1 || t.indexOf("headline") !== -1 || t.indexOf("catalyst") !== -1) {
    return await newsForUser(supabase, userId);
  }

  // --- Portfolio fit / diversification ---
  if ((t.indexOf("portfolio") !== -1 || t.indexOf("round out") !== -1 || t.indexOf("diversif") !== -1) && t.indexOf("news") === -1) {
    return await portfolioFit(supabase, userId);
  }

  // --- Everything below is static, accurate documentation of how the
  // site's real features work -- doesn't need live data, so it's safe to
  // answer without an LLM. ---
  const docs: Array<{ test: boolean; reply: string }> = [
    { test: t.indexOf("sector rotation") !== -1,
      reply: "Sector Rotation compares each sector's recent price momentum against its average fundamental quality — balance sheet plus growth scores. Sectors the market has been pricing down that still clear a real quality bar get flagged as Contrarian Candidates. It's a research starting point, not a buy signal." },
    { test: t.indexOf("sector") !== -1,
      reply: "Every tracked stock is grouped into a broad sector (Technology, Health Care, Financials, and so on) so its valuation and quality scores get compared to real peers instead of the whole market at once. Ask \"what sector is AAPL in\" and I'll look it up." },
    { test: t.indexOf("chart") !== -1 || t.indexOf("candlestick") !== -1 || t.indexOf("history") !== -1,
      reply: "Every stock's Price Chart has 1D/3D/1W views from real intraday history, plus 1M/3M/1Y as daily closes accumulate (no historical backfill exists, so those fill in for real over time). Toggle candlesticks vs. a line view and Bollinger Bands from any chart." },
    { test: t.indexOf("rsi") !== -1 || t.indexOf("relative strength") !== -1,
      reply: "RSI measures how overbought or oversold a stock is, 0-100. Below 35 with price still above its 20-day average can flag a bounce setup here; above 68 flags overbought. It's one of two conditions (with MACD momentum) behind this site's buy/sell signal." },
    { test: t.indexOf("macd") !== -1,
      reply: "MACD compares a fast and slow moving average to gauge momentum. This site checks MACD's own signal line before firing a buy or sell — RSI alone can stay 'oversold' through a real downtrend, so requiring MACD agreement cuts down on that false-positive pattern." },
    { test: t.indexOf("moving average") !== -1 || t.indexOf(" sma") !== -1 || t.indexOf(" ema") !== -1,
      reply: "The moving average on each chart adapts its period to how much history is available, so it's meaningful even on a short intraday series instead of a fixed period that'd be blank at the start." },
    { test: t.indexOf("bollinger") !== -1,
      reply: "Bollinger Bands plot two lines two standard deviations above and below a moving average — price pressing the upper band means it's stretched to the upside relative to its own recent range, the lower band the opposite. Toggle them on from any Price Chart." },
    { test: t.indexOf("timeframe") !== -1 || t.indexOf("time frame") !== -1 || t.indexOf("how far back") !== -1,
      reply: "Charts offer 1D, 3D, and 1W from real 5-minute intraday samples, plus 1M/3M/1Y from daily closes. The longer views are genuinely new — no data provider backfills them — so they'll be sparse until enough real days pass." },
    { test: t.indexOf("volume") !== -1,
      reply: "Volume isn't reliable here — the market data plan behind this site doesn't return real trading volume, so it always shows N/A rather than a fabricated number. Price, RSI, MACD, and patterns are all real." },
    { test: t.indexOf("pattern") !== -1 || t.indexOf("breakout") !== -1 || t.indexOf("breakdown") !== -1 || t.indexOf("flag") !== -1 || t.indexOf("consolidat") !== -1,
      reply: "The Pattern Hub lists every stock currently showing a detected chart pattern — breakouts, breakdowns, bull/bear flags — from rule-based detection on recent intraday price action. 'Consolidation' is the neutral default most stocks sit in." },
    { test: t.indexOf("p/e") !== -1 || t.indexOf("pe ratio") !== -1 || t.indexOf("p/b") !== -1 || t.indexOf("p/s") !== -1 || t.indexOf("valuation") !== -1,
      reply: "P/E, P/B, and P/S are scored against each stock's own sector median, not one flat cutoff for the whole market. The Value Radar screens show each stock's multiple next to its sector's typical range." },
    { test: t.indexOf("balance sheet") !== -1,
      reply: "Balance Sheet Strength scores debt/equity, current ratio, and net margin against sector peers rather than one flat cutoff — a highly-leveraged utility isn't penalized the way a highly-leveraged software company would be." },
    { test: t.indexOf("growth score") !== -1 || t.indexOf("growth & momentum") !== -1,
      reply: "Growth & Momentum scores revenue growth, EPS growth, and recent earnings-surprise history against sector peers, so a mature staples company and a hypergrowth software name aren't held to the same bar." },
    { test: t.indexOf("small cap") !== -1 || t.indexOf("small-cap") !== -1,
      reply: "The Small-Cap Value screen filters to roughly $300M-$2B market cap and blends sector-relative valuation with Balance Sheet and Growth scores, so it's not just 'cheap and small' but 'cheap, small, and still sound.'" },
    { test: t.indexOf("short") !== -1 && (t.indexOf("candidate") !== -1 || t.indexOf("squeeze") !== -1),
      reply: "Short Candidates pairs a weak Balance Sheet score with an overbought technical reading. It flags the real risk up front: weak-fundamentals stocks that are heavily shorted are exactly the setups most prone to squeezes." },
    { test: t.indexOf("iv rank") !== -1 || t.indexOf("iv/rv") !== -1 || t.indexOf("implied vol") !== -1,
      reply: "IV Rank shows how rich an option's current implied volatility is relative to that stock's own recent IV history. IV/RV compares it to the stock's actual realized volatility instead — above 1x means the options market is pricing in more movement than the stock has actually been making." },
    { test: t.indexOf("covered call") !== -1,
      reply: "A covered call sells a call against stock you already own, collecting premium in exchange for capping your upside at the strike. The Income Strategies screen ranks these by annualized yield, prioritizing contracts beyond the stock's expected move over the single highest number." },
    { test: t.indexOf("cash-secured put") !== -1 || t.indexOf("cash secured put") !== -1,
      reply: "A cash-secured put sells a put with the cash set aside to buy the stock if assigned. Same ranking logic as covered calls: safety before raw yield." },
    { test: t.indexOf("credit spread") !== -1,
      reply: "A credit spread sells one option and buys a further-out one as protection, capping max loss at the strike width minus the credit collected." },
    { test: t.indexOf("diagonal") !== -1 || t.indexOf("stock replacement") !== -1 || t.indexOf("leaps") !== -1,
      reply: "Stock-replacement diagonals use a longer-dated deep-in-the-money option in place of owning the stock outright, then sell shorter-dated options against it for income." },
    { test: t.indexOf("delta") !== -1 || t.indexOf("gamma") !== -1 || t.indexOf("what is a call") !== -1 || t.indexOf("what is a put") !== -1,
      reply: "A call gives the right to buy at the strike price by expiration; a put the right to sell. Delta approximates how much the option moves per $1 move in the stock; gamma is how fast delta itself changes." },
    { test: t.indexOf("dividend") !== -1 || t.indexOf("yield") !== -1,
      reply: "Dividend Income ranks payers on more than raw yield: yield is capped rather than an unbounded multiplier, weighed against payout-ratio safety, 52-week price stability, and Balance Sheet Strength." },
    { test: t.indexOf("penny stock") !== -1,
      reply: "Penny Stocks is a dedicated screen for the lower-priced names in the tracked universe, using the same signal and pattern detection as everywhere else." },
    { test: t.indexOf("futures") !== -1,
      reply: "Futures shows front-month contracts across major products. There's no historical price chart for futures yet — quotes only for now." },
    { test: t.indexOf("risk calculator") !== -1 || t.indexOf("position siz") !== -1,
      reply: "The Risk Calculator (under Tools) sizes a position from your account size, risk-per-trade, and stop distance." },
    { test: t.indexOf("alert") !== -1 || t.indexOf("notif") !== -1 || t.indexOf("slack") !== -1,
      reply: "Settings lets you wire up Slack alerts for insider buys, target/stop-loss hits, big price moves, new chart patterns, upcoming earnings, and new small-cap value ideas." },
    { test: t.indexOf("performance") !== -1 || t.indexOf("track record") !== -1,
      reply: "The Performance page auto-tracks every pick you've added against its target and stop, so you can see real outcomes over time." },
    { test: t.indexOf("what can you do") !== -1 || t.indexOf("what can this") !== -1 || t.indexOf("features") !== -1,
      reply: "Quite a bit: live stock signals with RSI/MACD/patterns, an options scanner and income-strategy screens, fundamentals-based value screens (Sector Rotation, Dividend Income), insider-activity tracking, a portfolio tracker with auto-tracked performance, a risk calculator, and Slack alerts. Ask about any of those, or a specific ticker." },
    { test: (t.indexOf("should i buy") !== -1 || t.indexOf("should i sell") !== -1 || t.indexOf("guarantee") !== -1),
      reply: "I can show you what the data says — score, signal, valuation versus sector — but I can't tell you whether to actually buy or sell. This site is research and education only, not financial advice." },
  ];

  const hit = docs.find((d) => d.test);
  if (hit) return hit.reply;

  return "I can answer from this site's own cached data — try a tracked ticker (\"how is AAPL performing\"), a comparison (\"compare NVDA vs AMD\"), your portfolio, insider activity, or a concept like RSI, P/E, or covered calls.";
}

async function tickerSnapshot(supabase: ReturnType<typeof createClient>, ticker: string): Promise<string> {
  const [{ data: cache }, { data: fund }] = await Promise.all([
    supabase.from("stock_cache").select("price, change_percent, rsi, macd, signal, pattern").eq("symbol", ticker).maybeSingle(),
    supabase.from("stock_fundamentals").select("sector, balance_sheet_score, growth_score").eq("symbol", ticker).maybeSingle(),
  ]);
  if (!cache) return `${ticker} hasn't been scanned yet — it may have just been added to the tracked list.`;

  const parts = [
    `${ticker} is at $${Number(cache.price).toFixed(2)} (${fmtPct(cache.change_percent !== null ? Number(cache.change_percent) : null)} today).`,
    `RSI ${cache.rsi ?? "n/a"}, MACD ${cache.macd !== null ? Number(cache.macd).toFixed(3) : "n/a"}, signal: ${cache.signal ?? "hold"}.`,
  ];
  if (cache.pattern && cache.pattern !== "consolidation") parts.push(`Pattern detected: ${cache.pattern}.`);
  if (fund) parts.push(`Sector: ${fund.sector ?? "unclassified"}. Balance Sheet ${fund.balance_sheet_score}, Growth ${fund.growth_score}.`);
  return parts.join(" ");
}

async function compareTickers(supabase: ReturnType<typeof createClient>, a: string, b: string): Promise<string> {
  const { data: rows } = await supabase
    .from("stock_fundamentals")
    .select("symbol, sector, balance_sheet_score, growth_score, pe_ratio")
    .in("symbol", [a, b]);
  const ra = rows?.find((r) => r.symbol === a);
  const rb = rows?.find((r) => r.symbol === b);
  if (!ra || !rb) return `I don't have fundamentals scanned yet for ${!ra ? a : b} — try again after the next scan, or pick two tickers that are further along in the tracked list.`;
  const lead = ra.growth_score + ra.balance_sheet_score >= rb.growth_score + rb.balance_sheet_score ? a : b;
  return `${a}: Growth ${ra.growth_score}, Balance Sheet ${ra.balance_sheet_score}${ra.pe_ratio ? `, P/E ${Number(ra.pe_ratio).toFixed(1)}` : ""}.\n${b}: Growth ${rb.growth_score}, Balance Sheet ${rb.balance_sheet_score}${rb.pe_ratio ? `, P/E ${Number(rb.pe_ratio).toFixed(1)}` : ""}.\n${lead} screens stronger on the combined score right now.`;
}

async function topSignals(supabase: ReturnType<typeof createClient>): Promise<string> {
  const { data: buys } = await supabase.from("stock_cache").select("symbol, rsi, macd, pattern").eq("signal", "buy").order("rsi", { ascending: true }).limit(3);
  if (!buys || buys.length === 0) return "Nothing is clearing a full buy signal (RSI oversold + MACD confirmation) right now — that's normal outside of real pullbacks. Stock Signals always has the live, ranked list.";
  const lines = buys.map((r) => `${r.symbol} (RSI ${r.rsi}${r.pattern && r.pattern !== "consolidation" ? `, ${r.pattern}` : ""})`);
  return `Live buy signals right now: ${lines.join(", ")}. Full ranked list is on Stock Signals.`;
}

async function insiderActivity(supabase: ReturnType<typeof createClient>, userId: string | null): Promise<string> {
  let tickers: string[] | null = null;
  if (userId) {
    const { data: positions } = await supabase.from("portfolio").select("symbol").eq("user_id", userId);
    tickers = Array.from(new Set((positions ?? []).map((p) => p.symbol)));
    if (tickers.length === 0) return "You don't have any tracked portfolio positions yet, so there's nothing to scope insider activity to — try asking generally instead.";
  }

  let query = supabase.from("insider_activity").select("ticker, filer_name, filer_title, total_value, filing_date").eq("form_type", "4").order("filing_date", { ascending: false }).limit(3);
  if (tickers) query = query.in("ticker", tickers);
  const { data: filings } = await query;

  if (!filings || filings.length === 0) {
    return tickers ? "No open-market insider purchases have crossed for your tracked holdings recently." : "No open-market insider purchases have crossed recently. Check back after the next scan, or see the Insider Activity screen for the full history.";
  }
  const lines = filings.map((f) => `${f.ticker} — ${f.filer_name}${f.filer_title ? ` (${f.filer_title})` : ""}${f.total_value ? `, $${Number(f.total_value).toLocaleString()}` : ""} on ${f.filing_date}`);
  return `Recent open-market insider buys: ${lines.join("; ")}.`;
}

async function newsForUser(supabase: ReturnType<typeof createClient>, userId: string | null): Promise<string> {
  if (!userId) return "News & Catalysts surfaces earnings dates and filings from this site's own scans — sign in and ask again to scope it to your tracked holdings, or browse the screen directly.";
  const { data: positions } = await supabase.from("portfolio").select("symbol").eq("user_id", userId);
  const tickers = Array.from(new Set((positions ?? []).map((p) => p.symbol)));
  if (tickers.length === 0) return "You don't have any tracked portfolio positions yet, so there's no news to scope to them.";

  const today = new Date().toISOString().slice(0, 10);
  const soon = new Date(Date.now() + 3 * 86400_000).toISOString().slice(0, 10);
  const [{ data: earnings }, { data: filings }] = await Promise.all([
    supabase.from("earnings_calendar").select("symbol, next_earnings_date").in("symbol", tickers).gte("next_earnings_date", today).lte("next_earnings_date", soon),
    supabase.from("insider_activity").select("ticker, filing_date, form_type").in("ticker", tickers).order("filing_date", { ascending: false }).limit(3),
  ]);

  const lines: string[] = [];
  for (const e of earnings ?? []) lines.push(`${e.symbol} reports earnings on ${e.next_earnings_date}`);
  for (const f of filings ?? []) lines.push(`${f.ticker} has a ${f.form_type === "4" ? "Form 4 insider filing" : f.form_type} from ${f.filing_date}`);

  if (lines.length === 0) return "Nothing notable crossed for your tracked holdings in the last few days — no upcoming earnings within 3 days, no new filings.";
  return `Here's what's on the News & Catalysts screen for your holdings: ${lines.join("; ")}.`;
}

async function portfolioFit(supabase: ReturnType<typeof createClient>, userId: string | null): Promise<string> {
  if (!userId) return "Sign in and ask again to get this scoped to your actual holdings — in general, the Quality Screen and Sector Rotation are the two screens worth cross-referencing against whatever sectors you're already concentrated in.";

  const { data: positions } = await supabase.from("portfolio").select("symbol").eq("user_id", userId);
  const heldSymbols = Array.from(new Set((positions ?? []).map((p) => p.symbol)));
  if (heldSymbols.length === 0) return "You don't have any tracked portfolio positions yet — add some on the Portfolio page and ask again.";

  const { data: allFund } = await supabase.from("stock_fundamentals").select("symbol, sector, balance_sheet_score, growth_score");
  const rows = allFund ?? [];
  const heldSectors = new Set(rows.filter((r) => heldSymbols.includes(r.symbol)).map((r) => broadSector(r.symbol, r.sector)));

  const candidates = rows
    .filter((r) => !heldSymbols.includes(r.symbol) && !heldSectors.has(broadSector(r.symbol, r.sector)))
    .filter((r) => r.balance_sheet_score >= 60 && r.growth_score >= 55)
    .sort((a, b) => (b.balance_sheet_score + b.growth_score) - (a.balance_sheet_score + a.growth_score))
    .slice(0, 3);

  if (candidates.length === 0) return "Your tracked holdings already span most of the sectors with strong-scoring names right now, so nothing obviously underrepresented stood out.";
  const lines = candidates.map((c) => `${c.symbol} (${broadSector(c.symbol, c.sector)}, Balance Sheet ${c.balance_sheet_score}, Growth ${c.growth_score})`);
  return `Your holdings don't currently touch ${Array.from(heldSectors).length ? "some sectors that" : "sectors that"} score well elsewhere. A few names outside your existing sector exposure that screen well: ${lines.join(", ")}.`;
}
