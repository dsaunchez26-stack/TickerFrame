import { corsHeaders } from "../_shared/cors.ts";

// tastytrade's OAuth + market-data API. Base host confirmed live: the host
// implied by our own JWT's "iss" claim (api.sandbox.tastyworks.com) doesn't
// actually resolve -- the real sandbox/certification host, verified by
// direct request, is api.cert.tastyworks.com.
const BASE = "https://api.cert.tastyworks.com";

// A curated set of liquid, widely-traded futures across asset classes --
// same "curated universe, not the whole market" tradeoff already made for
// stocks and options in this app.
const PRODUCTS: Array<{ code: string; name: string; sector: string }> = [
  { code: "ES", name: "E-mini S&P 500", sector: "Equity Index" },
  { code: "NQ", name: "E-mini Nasdaq 100", sector: "Equity Index" },
  { code: "YM", name: "Mini Dow", sector: "Equity Index" },
  { code: "RTY", name: "E-mini Russell 2000", sector: "Equity Index" },
  { code: "CL", name: "Crude Oil WTI", sector: "Energy" },
  { code: "NG", name: "Natural Gas", sector: "Energy" },
  { code: "RB", name: "RBOB Gasoline", sector: "Energy" },
  { code: "GC", name: "Gold", sector: "Metals" },
  { code: "SI", name: "Silver", sector: "Metals" },
  { code: "HG", name: "Copper", sector: "Metals" },
  { code: "ZN", name: "10-Year T-Note", sector: "Rates" },
  { code: "ZB", name: "30-Year T-Bond", sector: "Rates" },
  { code: "ZF", name: "5-Year T-Note", sector: "Rates" },
  { code: "6E", name: "Euro FX", sector: "Currencies" },
  { code: "6J", name: "Japanese Yen", sector: "Currencies" },
  { code: "6B", name: "British Pound", sector: "Currencies" },
  { code: "ZC", name: "Corn", sector: "Agriculture" },
  { code: "ZS", name: "Soybeans", sector: "Agriculture" },
  { code: "ZW", name: "Wheat", sector: "Agriculture" },
];

interface TastytradeFuture {
  "product-code": string;
  symbol: string;
  "streamer-symbol"?: string;
  exchange: string;
  "expiration-date": string;
  "tick-size": string;
  "contract-size"?: string;
  "notional-multiplier"?: string;
  "display-factor"?: string;
  "active-month"?: boolean;
}

// Yahoo Finance's own chart endpoint (query1.finance.yahoo.com) -- unofficial
// and undocumented (Yahoo shut down its official finance API in 2017), but it
// serves genuinely live futures quotes with no signup, no API key, and no
// funded account required. Confirmed live: every product code below resolves
// as "{code}=F" (e.g. "ES=F", "6E=F"). Unlike tastytrade's market-data
// endpoint, it doesn't expose bid/ask -- only last, previous close, day
// high/low, and volume -- so bid/ask is left null rather than estimated.
const YAHOO_CHART_BASE = "https://query1.finance.yahoo.com/v8/finance/chart";

interface YahooChartMeta {
  regularMarketPrice?: number;
  chartPreviousClose?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  regularMarketVolume?: number;
  regularMarketTime?: number;
}

interface YahooQuote {
  last: number | null;
  prevClose: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  volume: number | null;
  updatedAt: string | null;
}

async function fetchYahooQuote(code: string): Promise<YahooQuote | null> {
  const symbol = encodeURIComponent(`${code}=F`);
  const res = await fetch(`${YAHOO_CHART_BASE}/${symbol}?interval=1d&range=1d`, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; TickerframeBot/1.0)" },
  });
  if (!res.ok) return null;
  const json = await res.json();
  const meta: YahooChartMeta | undefined = json?.chart?.result?.[0]?.meta;
  if (!meta || meta.regularMarketPrice == null) return null;
  return {
    last: meta.regularMarketPrice ?? null,
    prevClose: meta.chartPreviousClose ?? null,
    dayHigh: meta.regularMarketDayHigh ?? null,
    dayLow: meta.regularMarketDayLow ?? null,
    volume: meta.regularMarketVolume ?? null,
    updatedAt: meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : null,
  };
}

// Access tokens last 15 min (confirmed via live test: expires_in=900).
// Module-level cache survives across invocations on a warm instance, so most
// requests skip the refresh round trip entirely instead of re-authenticating
// every single call.
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) return cachedToken.token;

  const clientSecret = Deno.env.get("TASTYTRADE_CLIENT_SECRET");
  const refreshToken = Deno.env.get("TASTYTRADE_REFRESH_TOKEN");
  if (!clientSecret || !refreshToken) {
    throw new Error("TASTYTRADE_CLIENT_SECRET / TASTYTRADE_REFRESH_TOKEN are not configured");
  }

  // Confirmed via live test against the real endpoint: JSON body (not form
  // encoded), no client_id needed, only client_secret + refresh_token +
  // grant_type. Do NOT send an Accept-Version header -- tastytrade's own
  // Python SDK notes the sandbox host rejects it.
  const res = await fetch(`${BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "refresh_token",
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) throw new Error(`Tastytrade token refresh failed (${res.status}): ${await res.text()}`);
  const data = await res.json();
  cachedToken = { token: data.access_token, expiresAt: Date.now() + (Number(data.expires_in) || 900) * 1000 };
  return cachedToken.token;
}

// tastytrade's sandbox/certification host is confirmed intermittently flaky
// independent of load or credentials (live-observed both 502 Bad Gateway and
// 429 Too Many Requests on the instruments endpoint, seconds apart, on an
// otherwise-working token) -- a short retry absorbs that instability instead
// of surfacing a hard error for what's usually a one-off blip.
async function fetchWithRetry(url: string, init: RequestInit, attempts = 3): Promise<Response> {
  let lastRes: Response | null = null;
  for (let i = 0; i < attempts; i++) {
    const res = await fetch(url, init);
    if (res.ok) return res;
    lastRes = res;
    if (![429, 502, 503, 504].includes(res.status)) return res;
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, 500 * (i + 1)));
  }
  return lastRes!;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const token = await getAccessToken();
    const authHeaders = { Authorization: `Bearer ${token}`, Accept: "application/json" };

    // Paginated rather than a single large per-page request -- with 19
    // product codes x however many listed months each, the item count isn't
    // bounded in a way that guarantees fitting in one page, and a silent
    // truncation here would just make the missing products' rows vanish
    // from the response with no error.
    const productCodesQuery = PRODUCTS.map((p) => `product-code[]=${encodeURIComponent(p.code)}`).join("&");
    const items: TastytradeFuture[] = [];
    const PAGE_SIZE = 250;
    for (let pageOffset = 0; ; pageOffset++) {
      const instrumentsRes = await fetchWithRetry(
        `${BASE}/instruments/futures?${productCodesQuery}&per-page=${PAGE_SIZE}&page-offset=${pageOffset}`,
        { headers: authHeaders },
      );
      if (!instrumentsRes.ok) {
        throw new Error(`Futures instruments request failed (${instrumentsRes.status}): ${await instrumentsRes.text()}`);
      }
      const instrumentsJson = await instrumentsRes.json();
      const page: TastytradeFuture[] = instrumentsJson?.data?.items ?? [];
      items.push(...page);
      const totalPages = Number(instrumentsJson?.pagination?.["total-pages"]) || 1;
      if (page.length < PAGE_SIZE || pageOffset + 1 >= totalPages) break;
    }

    // Pick the front-month (active-month) contract per product code; fall
    // back to the nearest NOT-YET-EXPIRED contract if tastytrade hasn't
    // flagged one as active for some reason. Without the expiration >= now
    // guard, this fallback could otherwise pick the most-expired historical
    // contract in the response instead of the nearest future one.
    const now = Date.now();
    const contractsByCode = new Map<string, TastytradeFuture>();
    for (const item of items) {
      const code = item["product-code"];
      if (item["active-month"]) {
        contractsByCode.set(code, item);
        continue;
      }
      const existing = contractsByCode.get(code);
      if (existing?.["active-month"]) continue;
      if (new Date(item["expiration-date"]).getTime() < now) continue;
      if (!existing || new Date(item["expiration-date"]) < new Date(existing["expiration-date"])) {
        contractsByCode.set(code, item);
      }
    }

    // Surfaced to the frontend rather than silently vanishing from the list
    // -- a product code resolving to zero usable contracts (pagination gap,
    // temporary delisting, wrong code) should be visible as "couldn't load
    // this one," not just absent with no explanation.
    const missingProducts: string[] = [];
    const contracts = PRODUCTS.map((p) => {
      const c = contractsByCode.get(p.code);
      if (!c) { missingProducts.push(p.code); return null; }
      return {
        code: p.code,
        name: p.name,
        sector: p.sector,
        symbol: c.symbol,
        exchange: c.exchange,
        expiration: c["expiration-date"],
        tickSize: Number(c["tick-size"]) || null,
        contractSize: c["contract-size"] ? Number(c["contract-size"]) : null,
        notionalMultiplier: c["notional-multiplier"] ? Number(c["notional-multiplier"]) : null,
      };
    }).filter((c): c is NonNullable<typeof c> => c !== null);

    // Live pricing comes from Yahoo's unofficial chart endpoint (see
    // fetchYahooQuote above), not tastytrade -- tastytrade's own sandbox
    // market-data service is confirmed unreliable (spontaneous 502s on an
    // otherwise-working token) and its production equivalent requires a
    // funded brokerage account. Fetched per-symbol in parallel and isolated
    // with allSettled so one product's failure doesn't blank out the rest.
    let quotesError: string | null = null;
    const quoteResults = await Promise.allSettled(contracts.map((c) => fetchYahooQuote(c.code)));
    const quotesByCode = new Map<string, YahooQuote>();
    let failures = 0;
    quoteResults.forEach((result, i) => {
      if (result.status === "fulfilled" && result.value) quotesByCode.set(contracts[i].code, result.value);
      else failures++;
    });
    if (failures > 0 && failures === contracts.length) {
      quotesError = "Live pricing is temporarily unavailable (Yahoo Finance's quote feed did not return data for any tracked product).";
    } else if (failures > 0) {
      quotesError = `Live pricing is temporarily unavailable for ${failures} of ${contracts.length} products this refresh -- the rest below are current.`;
    }

    const rows = contracts.map((c) => {
      const q = quotesByCode.get(c.code);
      const last = q?.last ?? null;
      const prevClose = q?.prevClose ?? null;
      const change = last != null && prevClose != null ? last - prevClose : null;
      const changePercent = change != null && prevClose ? (change / prevClose) * 100 : null;
      return {
        ...c,
        last,
        bid: null,
        ask: null,
        dayHigh: q?.dayHigh ?? null,
        dayLow: q?.dayLow ?? null,
        volume: q?.volume ?? null,
        prevClose,
        change,
        changePercent,
        updatedAt: q?.updatedAt ?? null,
      };
    });

    return new Response(
      JSON.stringify({
        rows,
        quotesError,
        missingProducts,
        source: "tastytrade-yahoo",
        fetchedAt: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
