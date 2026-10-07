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

// The tracked universe has grown to include enough short, real tickers
// that plenty of them are also ordinary English words a question would
// naturally contain -- ALL (Allstate), NOW (ServiceNow), LOW (Lowe's),
// IT (Gartner), SO (Southern Co), ON (ON Semiconductor), HAS (Hasbro),
// WELL (Welltower), KEY (KeyCorp), COST (Costco), GAP (Gap Inc, and "gap
// up/down" is itself real trading vocabulary), A (Agilent), and more.
// Without this, "how is it doing now" would extract tickers IT and NOW
// and answer with a Gartner/ServiceNow snapshot instead of recognizing
// this as a question with no ticker in it at all. Covers common function
// words plus the specific content words above known to collide.
const COMMON_WORD_STOPLIST = new Set([
  "A", "I", "AM", "AN", "AS", "AT", "BE", "BUT", "BY", "DO", "GO", "HE", "HI", "IF", "IN", "IS", "IT", "ITS",
  "ME", "MY", "NO", "OF", "OK", "ON", "OR", "OUR", "OUT", "RE", "SO", "TO", "UP", "US", "WE",
  "ALL", "AND", "ANY", "ARE", "CAN", "COST", "DID", "DOES", "DOING", "DOWN", "FIVE", "FOR", "FROM", "GAP",
  "HAS", "HAVE", "HER", "HERE", "HIGH", "HIM", "HIS", "HOW", "INTO", "JUST", "KEY", "LOW", "NOT", "NOW",
  "OUT", "OVER", "OWN", "SOME", "TAP", "THAN", "THAT", "THE", "THEIR", "THEM", "THEN", "THERE", "THEY",
  "THIS", "WAS", "WELL", "WERE", "WHAT", "WHEN", "WHERE", "WHICH", "WHO", "WHY", "WILL", "WITH", "WOULD", "YOU", "YOUR",
]);

function extractTickers(text: string): string[] {
  const words = Array.from(new Set(text.toUpperCase().match(/\b[A-Z]{1,5}\b/g) ?? []));
  return words.filter((w) => !COMMON_WORD_STOPLIST.has(w) && TRACKED_TICKERS.includes(w));
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


// Plain-language answers about the site's terms, privacy practices and what its
// readings are. Kept in sync with the Terms, Privacy and Disclaimers pages and
// checked before every other rule so a question like "delete my portfolio data"
// reaches the privacy answer instead of the portfolio-allocation one.
function policyReply(t: string): string | null {
  const has = (...words: string[]) => words.some((w) => t.indexOf(w) !== -1);

  if (has("privacy", "my data", "personal data", "personal information", "delete my", "delete account", "delete data", "remove my data", "my portfolio data", "what data", "data do you", "cookie", "do you track", "do you sell", "slack webhook")) {
    return "Privacy in short: we store your email and (hashed) password, the holdings and alert settings you enter, your Slack webhook URL if you add one, and your assistant history. If the app errors we log the error, page and browser type, and delete those logs after 30 days. There are no ad or analytics trackers, and we don't sell personal information. You can edit or remove holdings and your webhook yourself, and email support@tickerframe.app from your account address to have your account and data deleted. Full details are on the Privacy Policy page (/privacy).";
  }
  if (has("terms of use", "terms of service", "terms and conditions", "the terms", "your terms") || (has("terms") && has("agree", "accept", "legal"))) {
    return "The Terms of Use (/terms) say, in short: Tickerframe is a research and education tool, not a registered investment adviser or broker, and nothing here is personal advice; data comes from third parties and can be delayed or wrong; you're responsible for your account and decisions; and you agree not to scrape or redistribute the data or present it to others as advice. The Disclaimers page (/legal) covers the risk of loss in more detail.";
  }
  if (has("financial advice", "investment advice", "is this advice", "disclaimer", "registered", "adviser", "advisor", "fiduciary", "liable", "liability", "legal")) {
    return "Nothing on Tickerframe is investment advice. It isn't a registered investment adviser, broker-dealer or financial planner, doesn't hold your money or place trades, and shows the same impersonal information to every visitor - readings aren't tailored to your finances or goals, and the site doesn't take payment to promote any security. Investing can lose money, so do your own research and talk to a licensed professional. See Disclaimers (/legal) and Terms of Use (/terms).";
  }
  if ((has("bullish", "bearish", "neutral")) && has("mean", "what is", "what does", "what's", "how", "calculated", "work", "score")) {
    return "A reading is a summary of what technical indicators show right now, not an instruction. Each stock earns points for price above its 20-day average (+2) and the 9-day average above it (+1), MACD above its signal line (+2), RSI at or under 30 (+2) or at or over 70 (-2), and Bollinger %B at or under 0.05 (+1) or at or over 0.95 (-1). 5 or more points reads Bullish, -5 or fewer reads Bearish, in between is Neutral, and the score (-100 to +100) shows how close a Neutral is to either side. It isn't a prediction and hasn't been shown to forecast returns - open any stock's \"Why this reading\" panel to see every input.";
  }
  if (has("delayed", "delay", "real-time", "real time", "data source", "where does the data", "where do you get", "data come from", "data provider")) {
    return "Prices come from Finnhub and may lag by about 15 minutes; options data comes from Alpaca's free feed (no Open Interest - greeks and implied volatility are calculated here); futures prices come from Yahoo Finance with contract specs from tastytrade; insider filings from SEC EDGAR; the VIX from FRED. Any of it can be delayed, incomplete or wrong. The Methodology page lists every source.";
  }
  if (has("demo")) {
    return "Demo mode runs the site on a saved snapshot of real data instead of live data - prices and readings don't update, anything you add stays in your browser tab, and the assistant and live option-chain lookup are off. A banner at the top says so, with an Exit demo button.";
  }
  return null;
}

async function buildReply(supabase: ReturnType<typeof createClient>, userId: string | null, text: string, t: string): Promise<string> {
  const policy = policyReply(t);
  if (policy) return policy;

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
    return "Name two tracked tickers and I'll pull their real Balance Sheet and Growth scores side by side - e.g. \"compare NVDA vs AMD\".";
  }

  // --- Top signals right now ---
  if (t.indexOf("buy signal") !== -1 || t.indexOf("bullish") !== -1 || t.indexOf("top pick") !== -1 || t.indexOf("top 3") !== -1 || t.indexOf("best stock") !== -1 || t.indexOf("best setup") !== -1) {
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
  if ((t.indexOf("portfolio") !== -1 || t.indexOf("alloc") !== -1 || t.indexOf("round out") !== -1 || t.indexOf("diversif") !== -1) && t.indexOf("news") === -1) {
    return await portfolioFit(supabase, userId);
  }

  // --- Everything below is static, accurate documentation of how the
  // site's real features work -- doesn't need live data, so it's safe to
  // answer without an LLM. ---
  const docs: Array<{ test: boolean; reply: string }> = [
    { test: t.indexOf("sector rotation") !== -1,
      reply: "Sector Rotation compares each sector's recent price momentum against its average fundamental quality - balance sheet plus growth scores. Sectors the market has been pricing down that still clear a real quality bar get flagged as Contrarian Candidates. It's a research starting point, not a buy signal." },
    { test: t.indexOf("sector") !== -1,
      reply: "Every tracked stock is grouped into a broad sector (Technology, Health Care, Financials, and so on) so its valuation and quality scores get compared to real peers instead of the whole market at once. Ask \"what sector is AAPL in\" and I'll look it up." },
    { test: t.indexOf("chart") !== -1 || t.indexOf("candlestick") !== -1 || t.indexOf("history") !== -1,
      reply: "Every stock's Price Chart has 1D/3D/1W views from real intraday history, plus 1M/3M/1Y as daily closes accumulate (no historical backfill exists, so those fill in for real over time). Toggle candlesticks vs. a line view and Bollinger Bands from any chart." },
    { test: t.indexOf("rsi") !== -1 || t.indexOf("relative strength") !== -1,
      reply: "RSI measures how overbought or oversold a stock is, 0-100. At or under 30 is generally called oversold and at or over 70 overbought. Here it's one of several inputs - alongside trend and MACD momentum - to the bullish/neutral/bearish reading, and it describes recent price action rather than predicting what comes next." },
    { test: t.indexOf("macd") !== -1,
      reply: "MACD compares a fast and slow moving average to gauge momentum. This site checks whether MACD is above or below its own signal line (building or fading momentum) and counts it as one input to the bullish/neutral/bearish reading." },
    { test: t.indexOf("moving average") !== -1 || /\bsma\b/.test(t) || /\bema\b/.test(t),
      reply: "The moving average on each chart adapts its period to how much history is available, so it's meaningful even on a short intraday series instead of a fixed period that'd be blank at the start." },
    { test: t.indexOf("bollinger") !== -1,
      reply: "Bollinger Bands plot two lines two standard deviations above and below a moving average - price pressing the upper band means it's stretched to the upside relative to its own recent range, the lower band the opposite. Toggle them on from any Price Chart." },
    { test: t.indexOf("timeframe") !== -1 || t.indexOf("time frame") !== -1 || t.indexOf("how far back") !== -1,
      reply: "Charts offer 1D, 3D, and 1W from real 5-minute intraday samples, plus 1M/3M/1Y from daily closes. The longer views are genuinely new - no data provider backfills them - so they'll be sparse until enough real days pass." },
    { test: t.indexOf("volume") !== -1,
      reply: "Volume isn't reliable here - the market data plan behind this site doesn't return real trading volume, so it always shows N/A rather than a fabricated number. Price, RSI, MACD, and patterns are all real." },
    { test: t.indexOf("pattern") !== -1 || t.indexOf("breakout") !== -1 || t.indexOf("breakdown") !== -1 || t.indexOf("flag") !== -1 || t.indexOf("consolidat") !== -1,
      reply: "The Pattern Hub lists every stock currently showing a detected chart pattern - breakouts, breakdowns, bull/bear flags - from rule-based detection on recent intraday price action. 'Consolidation' is the neutral default most stocks sit in." },
    { test: t.indexOf("p/e") !== -1 || t.indexOf("pe ratio") !== -1 || t.indexOf("p/b") !== -1 || t.indexOf("p/s") !== -1 || t.indexOf("valuation") !== -1,
      reply: "P/E, P/B, and P/S are scored against each stock's own sector median, not one flat cutoff for the whole market. The Value Radar screens show each stock's multiple next to its sector's typical range." },
    { test: t.indexOf("balance sheet") !== -1,
      reply: "Balance Sheet Strength scores debt/equity, current ratio, and net margin against sector peers rather than one flat cutoff - a highly-leveraged utility isn't penalized the way a highly-leveraged software company would be." },
    { test: t.indexOf("growth score") !== -1 || t.indexOf("growth & momentum") !== -1,
      reply: "Growth & Momentum scores revenue growth, EPS growth, and recent earnings-surprise history against sector peers, so a mature staples company and a hypergrowth software name aren't held to the same bar." },
    { test: t.indexOf("small cap") !== -1 || t.indexOf("small-cap") !== -1,
      reply: "The Small-Cap Value screen filters to roughly $300M-$2B market cap and blends sector-relative valuation with Balance Sheet and Growth scores. Its Strict Value Filters toggle (on by default) goes further, requiring P/S under 2x, debt-to-equity under 0.5, and a positive net margin as hard cutoffs -- not just 'cheap and small' but 'cheap, small, profitable, and low-debt.'" },
    { test: t.indexOf("short") !== -1 && (t.indexOf("candidate") !== -1 || t.indexOf("squeeze") !== -1),
      reply: "Weak Balance Sheets pairs a weak Balance Sheet score with an overbought technical reading. It flags the real risk up front: weak-fundamentals stocks that are heavily shorted are exactly the setups most prone to squeezes." },
    { test: t.indexOf("iv rank") !== -1 || t.indexOf("iv/rv") !== -1 || t.indexOf("implied vol") !== -1,
      reply: "IV Rank shows how rich an option's current implied volatility is relative to that stock's own recent IV history. IV/RV compares it to the stock's actual realized volatility instead - above 1x means the options market is pricing in more movement than the stock has actually been making." },
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
    { test: t.indexOf("what is a future") !== -1 || t.indexOf("what's a future") !== -1 || t.indexOf("what are futures") !== -1,
      reply: "A futures contract is an agreement to buy or sell a set quantity of something -- an index, a commodity, a currency -- at a set price on a set future date. Unlike a stock, you don't pay the full contract value up front; you post margin, and gains/losses are settled daily against that margin. That's what makes futures leveraged: a small price move can produce a large dollar gain or loss relative to the margin actually posted." },
    { test: t.indexOf("contract multiplier") !== -1 || t.indexOf("contract size") !== -1,
      reply: "The contract multiplier is the real, exchange-defined dollar value of a one-point move in a futures contract -- it's why futures P&L isn't just quantity times price. A $1 move in gold is worth a different dollar amount per contract than a $1 move in the S&P, because each product has its own multiplier. The Risk Calculator's Futures mode uses each contract's real multiplier, not a naive quantity-times-price guess." },
    { test: t.indexOf("tick size") !== -1 || t.indexOf("tick value") !== -1,
      reply: "Tick size is the minimum price increment a futures contract can move. Tick value is that tick size multiplied by the contract multiplier -- the actual dollar amount one tick is worth. Both are shown as real, exchange-defined specs on the Futures page for every contract." },
    { test: t.indexOf("futures") !== -1,
      reply: "Futures shows front-month contracts across major products, and you can track positions in your Portfolio the same as stocks and options -- target/stop alerts and big-move alerts cover them too. There's no historical price chart for futures yet - quotes only for now." },
    { test: t.indexOf("risk calculator") !== -1 || t.indexOf("position siz") !== -1,
      reply: "The Risk Calculator (under Tools) has three modes -- stock, option, and futures -- each sizing a position and its dollar risk/reward from your entry, stop, and target. The futures mode uses the contract's real exchange-defined multiplier, not a naive quantity times price." },
    { test: t.indexOf("alert") !== -1 || t.indexOf("notif") !== -1 || t.indexOf("slack") !== -1,
      reply: "Settings lets you wire up Slack alerts for insider buys, target/stop-loss hits, big price moves, new chart patterns, upcoming earnings, and new small-cap value ideas." },
    { test: t.indexOf("performance") !== -1 || t.indexOf("track record") !== -1,
      reply: "The Performance page auto-tracks every pick you've added against its target and stop, so you can see real outcomes over time." },
    { test: t.indexOf("what can you do") !== -1 || t.indexOf("what can this") !== -1 || t.indexOf("features") !== -1,
      reply: "Quite a bit: live stock signals with RSI/MACD/patterns, an options scanner and income-strategy screens, futures quotes and portfolio tracking, fundamentals-based value screens (Sector Rotation, Dividend Income), insider-activity tracking, a portfolio tracker with auto-tracked performance, a stock/option/futures risk calculator, and Slack alerts. Ask about any of those, or a specific ticker." },
    { test: (t.indexOf("should i buy") !== -1 || t.indexOf("should i sell") !== -1 || t.indexOf("what should i") !== -1 || t.indexOf("what to buy") !== -1 || t.indexOf("what to sell") !== -1 || t.indexOf("recommend") !== -1 || t.indexOf("guarantee") !== -1),
      reply: "I can show you what the data says - the bullish/bearish reading, scores, valuation versus sector - but I can't tell you what to buy or sell, and nothing here is tailored to your situation. This site is research and education only, not financial advice." },
  ];

  const hit = docs.find((d) => d.test);
  if (hit) return hit.reply;

  return "I can answer from this site's own cached data - try a tracked ticker (\"how is AAPL performing\"), a comparison (\"compare NVDA vs AMD\"), your portfolio, insider activity, or a concept like RSI, P/E, or covered calls.";
}

async function tickerSnapshot(supabase: ReturnType<typeof createClient>, ticker: string): Promise<string> {
  const [{ data: cache }, { data: fund }] = await Promise.all([
    supabase.from("stock_cache").select("price, change_percent, rsi, macd, signal, pattern").eq("symbol", ticker).maybeSingle(),
    supabase.from("stock_fundamentals").select("sector, balance_sheet_score, growth_score").eq("symbol", ticker).maybeSingle(),
  ]);
  if (!cache) return `${ticker} hasn't been scanned yet - it may have just been added to the tracked list.`;

  const parts = [
    `${ticker} is at $${Number(cache.price).toFixed(2)} (${fmtPct(cache.change_percent !== null ? Number(cache.change_percent) : null)} today).`,
    `RSI ${cache.rsi !== null ? Number(cache.rsi).toFixed(1) : "n/a"}, MACD ${cache.macd !== null ? Number(cache.macd).toFixed(3) : "n/a"}, reading: ${cache.signal === "buy" ? "bullish" : cache.signal === "sell" ? "bearish" : "neutral"}.`,
  ];
  if (cache.pattern && cache.pattern !== "consolidation") parts.push(`Pattern detected: ${cache.pattern}.`);
  if (fund) parts.push(`Sector: ${broadSector(ticker, fund.sector)}. Balance Sheet ${fund.balance_sheet_score}, Growth ${fund.growth_score}.`);
  return parts.join(" ");
}

async function compareTickers(supabase: ReturnType<typeof createClient>, a: string, b: string): Promise<string> {
  const { data: rows } = await supabase
    .from("stock_fundamentals")
    .select("symbol, sector, balance_sheet_score, growth_score, pe_ratio")
    .in("symbol", [a, b]);
  const ra = rows?.find((r) => r.symbol === a);
  const rb = rows?.find((r) => r.symbol === b);
  if (!ra || !rb) return `I don't have fundamentals scanned yet for ${!ra ? a : b} - try again after the next scan, or pick two tickers that are further along in the tracked list.`;
  const lead = ra.growth_score + ra.balance_sheet_score >= rb.growth_score + rb.balance_sheet_score ? a : b;
  return `${a}: Growth ${ra.growth_score}, Balance Sheet ${ra.balance_sheet_score}${ra.pe_ratio ? `, P/E ${Number(ra.pe_ratio).toFixed(1)}` : ""}.\n${b}: Growth ${rb.growth_score}, Balance Sheet ${rb.balance_sheet_score}${rb.pe_ratio ? `, P/E ${Number(rb.pe_ratio).toFixed(1)}` : ""}.\n${lead} screens stronger on the combined score right now.`;
}

async function topSignals(supabase: ReturnType<typeof createClient>): Promise<string> {
  const { data: bulls } = await supabase.from("stock_cache").select("symbol, rsi, signal_score, pattern").eq("signal", "buy").order("signal_score", { ascending: false }).limit(3);
  if (!bulls || bulls.length === 0) return "No stock is reading clearly bullish right now. The Top 50 and Stocks pages show every stock's current reading and score.";
  const lines = bulls.map((r) => `${r.symbol} (score ${r.signal_score !== null && r.signal_score > 0 ? "+" : ""}${r.signal_score ?? "n/a"}, RSI ${r.rsi !== null ? Number(r.rsi).toFixed(1) : "n/a"}${r.pattern && r.pattern !== "consolidation" ? `, ${r.pattern}` : ""})`);
  return `Strongest bullish readings right now: ${lines.join(", ")}. That describes what the indicators show today - it's not a recommendation to buy, and the full list is on the Stocks pages.`;
}

async function insiderActivity(supabase: ReturnType<typeof createClient>, userId: string | null): Promise<string> {
  let tickers: string[] | null = null;
  if (userId) {
    const { data: positions } = await supabase.from("portfolio").select("symbol").eq("user_id", userId);
    tickers = Array.from(new Set((positions ?? []).map((p) => p.symbol)));
    if (tickers.length === 0) return "You don't have any tracked portfolio positions yet, so there's nothing to scope insider activity to - try asking generally instead.";
  }

  let query = supabase.from("insider_activity").select("ticker, filer_name, filer_title, total_value, filing_date").eq("form_type", "4").order("filing_date", { ascending: false }).limit(3);
  if (tickers) query = query.in("ticker", tickers);
  const { data: filings } = await query;

  if (!filings || filings.length === 0) {
    return tickers ? "No open-market insider purchases have crossed for your tracked holdings recently." : "No open-market insider purchases have crossed recently. Check back after the next scan, or see the Insider Activity screen for the full history.";
  }
  const lines = filings.map((f) => `${f.ticker} - ${f.filer_name}${f.filer_title ? ` (${f.filer_title})` : ""}${f.total_value ? `, $${Number(f.total_value).toLocaleString()}` : ""} on ${f.filing_date}`);
  return `Recent open-market insider buys: ${lines.join("; ")}.`;
}

async function newsForUser(supabase: ReturnType<typeof createClient>, userId: string | null): Promise<string> {
  if (!userId) return "News & Catalysts surfaces earnings dates and filings from this site's own scans - sign in and ask again to scope it to your tracked holdings, or browse the screen directly.";
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

  if (lines.length === 0) return "Nothing notable crossed for your tracked holdings in the last few days - no upcoming earnings within 3 days, no new filings.";
  return `Here's what's on the News & Catalysts screen for your holdings: ${lines.join("; ")}.`;
}

async function portfolioFit(supabase: ReturnType<typeof createClient>, userId: string | null): Promise<string> {
  if (!userId) return "Sign in and ask again to see how your own holdings are spread across asset classes and sectors - the Portfolio page also shows this under Asset allocation.";

  const { data: positions } = await supabase.from("portfolio").select("symbol, quantity, buy_price").eq("user_id", userId);
  const held = positions ?? [];
  if (held.length === 0) return "You don't have any tracked portfolio positions yet - add some on the Portfolio page and ask again.";

  const symbols = Array.from(new Set(held.map((p) => p.symbol)));
  const [{ data: cache }, { data: fund }] = await Promise.all([
    supabase.from("stock_cache").select("symbol, price, asset_class").in("symbol", symbols),
    supabase.from("stock_fundamentals").select("symbol, sector").in("symbol", symbols),
  ]);
  const priceBy = new Map((cache ?? []).map((r) => [r.symbol, Number(r.price)]));
  const classBy = new Map((cache ?? []).map((r) => [r.symbol, r.asset_class as string]));
  const sectorRaw = new Map((fund ?? []).map((r) => [r.symbol, r.sector as string | null]));

  let total = 0;
  const byClass = new Map<string, number>();
  const bySector = new Map<string, number>();
  for (const p of held) {
    const value = (priceBy.get(p.symbol) ?? Number(p.buy_price)) * Number(p.quantity);
    total += value;
    const cls = classBy.get(p.symbol) ?? "Equity";
    byClass.set(cls, (byClass.get(cls) ?? 0) + value);
    if (cls === "Equity") {
      const sec = broadSector(p.symbol, sectorRaw.get(p.symbol) ?? null);
      bySector.set(sec, (bySector.get(sec) ?? 0) + value);
    }
  }
  if (total <= 0) return "I couldn't price your holdings right now - try again after the next price refresh.";
  const fmt = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k === "Equity" ? "individual stocks" : k} ${((v / total) * 100).toFixed(0)}%`).join(", ");
  const sectors = [...bySector.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k} ${((v / total) * 100).toFixed(0)}%`).join(", ");
  return `By value, your tracked holdings are: ${fmt(byClass)}.${sectors ? ` Largest stock sectors: ${sectors}.` : ""} This just describes your current mix - it isn't a suggestion about what to hold. The Portfolio page's Asset allocation card shows the same breakdown.`;
}
