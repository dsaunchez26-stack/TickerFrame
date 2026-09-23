// Shared Alpaca data-fetching helpers used by options-scanner,
// option-chain-lookup, and option-quotes. Alpaca's free "Basic"/indicative
// plan needs no funded brokerage account (unlike Tradier, which requires
// one -- see the ALPACA_KEY_ID/ALPACA_SECRET_KEY secrets).
//
// IMPORTANT: the paper-trading "contracts" endpoint
// (paper-api.alpaca.markets/v2/options/contracts?status=active) looked like
// the natural way to discover a ticker's available expirations, but it only
// ever returns the current week's contracts on a paper account -- confirmed
// live: AAPL came back with exactly 2 expiration dates from that endpoint,
// while its real listed chain runs out to 2029. The options *data* API
// (data.alpaca.markets) isn't restricted the same way, so this discovers
// expirations and contract specs (strike/type) by paging through its
// snapshots directly and parsing the OCC symbol, instead of trusting the
// paper contracts endpoint at all.

export interface AlpacaChainContract {
  symbol: string; // OCC-style, e.g. "AAPL260923C00245000"
  expirationDate: string; // YYYY-MM-DD
  type: "call" | "put";
  strike: number;
  snapshot: AlpacaSnapshot;
}

export interface AlpacaSnapshot {
  latestQuote?: { ap?: number; bp?: number; t?: string };
  latestTrade?: { p?: number; t?: string };
  dailyBar?: { v?: number; c?: number };
}

export function alpacaHeaders(): Record<string, string> {
  const keyId = Deno.env.get("ALPACA_KEY_ID");
  const secretKey = Deno.env.get("ALPACA_SECRET_KEY");
  if (!keyId || !secretKey) throw new Error("ALPACA_KEY_ID/ALPACA_SECRET_KEY are not configured");
  return { "Apca-Api-Key-Id": keyId, "Apca-Api-Secret-Key": secretKey };
}

// OCC symbol format: {ROOT}{YYMMDD}{C|P}{strike*1000, 8 digits}. The root
// ticker's own length varies, but it's always exactly what was requested,
// so slicing it off the front leaves a fixed 15-character remainder to parse.
function parseOccSymbol(ticker: string, symbol: string): { expirationDate: string; type: "call" | "put"; strike: number } | null {
  const rest = symbol.startsWith(ticker) ? symbol.slice(ticker.length) : null;
  if (!rest || rest.length !== 15) return null;
  const yy = rest.slice(0, 2), mm = rest.slice(2, 4), dd = rest.slice(4, 6);
  const cp = rest[6];
  const strikeRaw = rest.slice(7);
  if ((cp !== "C" && cp !== "P") || !/^\d{8}$/.test(strikeRaw)) return null;
  return {
    expirationDate: `20${yy}-${mm}-${dd}`,
    type: cp === "C" ? "call" : "put",
    strike: Number(strikeRaw) / 1000,
  };
}

// Pages through every listed contract for a ticker (all expirations, not
// filtered), parsing each OCC symbol into strike/type/expiration alongside
// its quote/trade/volume snapshot -- one sweep covers both "what expirations
// exist" and "what does each contract cost" for the whole scan, near-term
// and LEAPS alike, so scanTicker below needs no separate calls per
// expiration. A handful of very liquid names (AAPL, SPY, TSLA) need close to
// the full page cap to reach their farthest LEAPS expiration; most of the
// tracked universe resolves in 1-2 pages.
const SNAPSHOT_PAGE_LIMIT = 1000;
const MAX_SNAPSHOT_PAGES = 5;

export async function fetchFullChain(ticker: string, headers: Record<string, string>): Promise<AlpacaChainContract[]> {
  const out: AlpacaChainContract[] = [];
  let pageToken: string | null = null;
  for (let page = 0; page < MAX_SNAPSHOT_PAGES; page++) {
    const url = new URL(`https://data.alpaca.markets/v1beta1/options/snapshots/${ticker}`);
    url.searchParams.set("limit", String(SNAPSHOT_PAGE_LIMIT));
    url.searchParams.set("feed", "indicative");
    if (pageToken) url.searchParams.set("page_token", pageToken);
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`snapshots request failed: ${await res.text()}`);
    const json = await res.json();
    const snapshots = json?.snapshots ?? {};
    for (const [symbol, snap] of Object.entries(snapshots)) {
      const parsed = parseOccSymbol(ticker, symbol);
      if (!parsed) continue;
      out.push({ symbol, expirationDate: parsed.expirationDate, type: parsed.type, strike: parsed.strike, snapshot: snap as AlpacaSnapshot });
    }
    pageToken = json?.next_page_token ?? null;
    if (!pageToken) break;
  }
  return out;
}

// Targeted lookup for when the exact expiration is already known (e.g.
// option-quotes pricing a tracked pick) -- scoped to one expiration instead
// of paging the whole chain, and confirmed NOT subject to the paper
// contracts endpoint's current-week-only restriction above (this hits the
// options data API, not the paper trading API).
export async function fetchSnapshots(ticker: string, expirationDate: string, headers: Record<string, string>): Promise<Map<string, AlpacaSnapshot>> {
  const out = new Map<string, AlpacaSnapshot>();
  let pageToken: string | null = null;
  for (let page = 0; page < 3; page++) {
    const url = new URL(`https://data.alpaca.markets/v1beta1/options/snapshots/${ticker}`);
    url.searchParams.set("expiration_date", expirationDate);
    url.searchParams.set("limit", String(SNAPSHOT_PAGE_LIMIT));
    url.searchParams.set("feed", "indicative");
    if (pageToken) url.searchParams.set("page_token", pageToken);
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`snapshots request failed: ${await res.text()}`);
    const json = await res.json();
    const snapshots = json?.snapshots ?? {};
    for (const [symbol, snap] of Object.entries(snapshots)) out.set(symbol, snap as AlpacaSnapshot);
    pageToken = json?.next_page_token ?? null;
    if (!pageToken) break;
  }
  return out;
}

// Underlying stock price + real day-over-day change, for tickers not in
// this app's main Finnhub-backed stock_cache (SPY/QQQ are added to the
// options universe for liquidity but aren't tracked-stock symbols -- see
// options-scanner.ts). One call gets both today's price and the actual
// previous close, rather than needing a second lookup or a locally-tracked
// history just to compute a real percent change.
export async function fetchStockSnapshot(symbol: string, headers: Record<string, string>): Promise<{ price: number; prevClose: number | null; changePct: number | null } | null> {
  const res = await fetch(`https://data.alpaca.markets/v2/stocks/${symbol}/snapshot`, { headers });
  if (!res.ok) return null;
  const json = await res.json();
  const price: number | null = json?.latestTrade?.p ?? json?.dailyBar?.c ?? null;
  const prevClose: number | null = json?.prevDailyBar?.c ?? null;
  if (!price) return null;
  const changePct = prevClose && prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : null;
  return { price, prevClose, changePct };
}

// A contract's current tradable price: last trade if genuinely recent
// (same day), otherwise the quote midpoint -- mirrors how the Tradier
// integration derived price (last || mid), since a stale trade from days
// ago is a worse "current price" than today's live bid/ask midpoint.
export function snapshotPrice(snap: AlpacaSnapshot | undefined): number | null {
  if (!snap) return null;
  const bid = snap.latestQuote?.bp ?? 0;
  const ask = snap.latestQuote?.ap ?? 0;
  const mid = bid > 0 && ask > 0 ? (bid + ask) / 2 : 0;
  const trade = snap.latestTrade?.p ?? 0;
  if (trade > 0 && snap.latestTrade?.t) {
    const tradeDate = snap.latestTrade.t.slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);
    if (tradeDate === today) return trade;
  }
  return mid > 0 ? mid : (trade > 0 ? trade : null);
}
