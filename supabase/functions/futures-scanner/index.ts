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

interface TastytradeQuote {
  symbol: string;
  last?: string | number;
  bid?: string | number;
  ask?: string | number;
  "prev-close"?: string | number;
  "updated-at"?: string;
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
      const instrumentsRes = await fetch(
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

    // Live pricing is a separate call, and is known to be unreliable on
    // tastytrade's sandbox specifically -- confirmed live that their cert
    // market-data service can return 502 while every other endpoint (auth,
    // instruments) works fine on the same token. Treat a failure here as
    // "prices unavailable" rather than failing the whole response, since the
    // contract specs above are genuinely useful on their own.
    let quotesError: string | null = null;
    const quotesBySymbol = new Map<string, TastytradeQuote>();
    if (contracts.length) {
      try {
        const futureParams = contracts.map((c) => `future[]=${encodeURIComponent(c.symbol)}`).join("&");
        const quotesRes = await fetch(`${BASE}/market-data/by-type?${futureParams}`, { headers: authHeaders });
        if (!quotesRes.ok) {
          quotesError = `Live pricing is temporarily unavailable (tastytrade sandbox market-data returned ${quotesRes.status}).`;
        } else {
          const quotesJson = await quotesRes.json();
          const quoteItems: TastytradeQuote[] = quotesJson?.data?.items ?? [];
          for (const q of quoteItems) quotesBySymbol.set(q.symbol, q);
        }
      } catch (e) {
        quotesError = `Live pricing is temporarily unavailable (${e instanceof Error ? e.message : String(e)}).`;
      }
    }

    const rows = contracts.map((c) => {
      const q = quotesBySymbol.get(c.symbol);
      const last = q?.last != null ? Number(q.last) : null;
      const prevClose = q?.["prev-close"] != null ? Number(q["prev-close"]) : null;
      const change = last != null && prevClose != null ? last - prevClose : null;
      const changePercent = change != null && prevClose ? (change / prevClose) * 100 : null;
      return {
        ...c,
        last,
        bid: q?.bid != null ? Number(q.bid) : null,
        ask: q?.ask != null ? Number(q.ask) : null,
        prevClose,
        change,
        changePercent,
        updatedAt: q?.["updated-at"] ?? null,
      };
    });

    return new Response(
      JSON.stringify({
        rows,
        quotesError,
        missingProducts,
        source: "tastytrade-sandbox",
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
