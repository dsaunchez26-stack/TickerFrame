import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// Same tracked universe as fetch-stock-data -- no point counting mentions of
// a ticker we can't show any other data for.
const SYMBOLS: Array<{ symbol: string; name: string }> = [
  { symbol: "AAPL", name: "Apple Inc" }, { symbol: "NVDA", name: "NVIDIA Corp" },
  { symbol: "TSLA", name: "Tesla Inc" }, { symbol: "AMD", name: "Advanced Micro Devices" },
  { symbol: "META", name: "Meta Platforms" }, { symbol: "MSFT", name: "Microsoft Corp" },
  { symbol: "GOOGL", name: "Alphabet Inc" }, { symbol: "AMZN", name: "Amazon.com Inc" },
  { symbol: "SPY", name: "SPDR S&P 500 ETF" }, { symbol: "QQQ", name: "Invesco QQQ Trust" },
  { symbol: "PLTR", name: "Palantir Technologies" }, { symbol: "NFLX", name: "Netflix Inc" },
  { symbol: "DIS", name: "Walt Disney Co" }, { symbol: "JPM", name: "JPMorgan Chase & Co" },
  { symbol: "BAC", name: "Bank of America Corp" }, { symbol: "XOM", name: "Exxon Mobil Corp" },
  { symbol: "JNJ", name: "Johnson & Johnson" }, { symbol: "KO", name: "Coca-Cola Co" },
  { symbol: "WMT", name: "Walmart Inc" }, { symbol: "V", name: "Visa Inc" },
  { symbol: "CRM", name: "Salesforce Inc" }, { symbol: "ORCL", name: "Oracle Corp" },
  { symbol: "INTC", name: "Intel Corp" }, { symbol: "ADBE", name: "Adobe Inc" },
  { symbol: "UBER", name: "Uber Technologies" }, { symbol: "SOFI", name: "SoFi Technologies" },
  { symbol: "NIO", name: "NIO Inc" }, { symbol: "PLUG", name: "Plug Power Inc" },
  { symbol: "SIRI", name: "Sirius XM Holdings" }, { symbol: "NOK", name: "Nokia Corp" },
  { symbol: "F", name: "Ford Motor Co" }, { symbol: "GPRO", name: "GoPro Inc" },
  { symbol: "CLOV", name: "Clover Health Investments" }, { symbol: "BBAI", name: "BigBear.ai Holdings" },
  { symbol: "MARA", name: "MARA Holdings" }, { symbol: "RIOT", name: "Riot Platforms" },
  { symbol: "SNDL", name: "SNDL Inc" }, { symbol: "LCID", name: "Lucid Group" },
  { symbol: "CHPT", name: "ChargePoint Holdings" }, { symbol: "FCEL", name: "FuelCell Energy" },
  { symbol: "IQ", name: "iQIYI Inc" }, { symbol: "SNOW", name: "Snowflake Inc" },
  { symbol: "DDOG", name: "Datadog Inc" }, { symbol: "NET", name: "Cloudflare Inc" },
  { symbol: "SHOP", name: "Shopify Inc" }, { symbol: "PYPL", name: "PayPal Holdings" },
  { symbol: "ROKU", name: "Roku Inc" }, { symbol: "SNAP", name: "Snap Inc" },
  { symbol: "ABNB", name: "Airbnb Inc" }, { symbol: "DASH", name: "DoorDash Inc" },
  { symbol: "TGT", name: "Target Corp" }, { symbol: "LULU", name: "Lululemon Athletica" },
  { symbol: "NKE", name: "Nike Inc" }, { symbol: "SBUX", name: "Starbucks Corp" },
  { symbol: "CMG", name: "Chipotle Mexican Grill" }, { symbol: "MS", name: "Morgan Stanley" },
  { symbol: "SCHW", name: "Charles Schwab Corp" }, { symbol: "COF", name: "Capital One Financial" },
  { symbol: "MRNA", name: "Moderna Inc" }, { symbol: "GILD", name: "Gilead Sciences" },
  { symbol: "CVS", name: "CVS Health Corp" }, { symbol: "BA", name: "Boeing Co" },
  { symbol: "GE", name: "General Electric Co" }, { symbol: "FDX", name: "FedEx Corp" },
  { symbol: "UPS", name: "United Parcel Service" }, { symbol: "DAL", name: "Delta Air Lines" },
  { symbol: "UAL", name: "United Airlines Holdings" }, { symbol: "AAL", name: "American Airlines Group" },
  { symbol: "LUV", name: "Southwest Airlines Co" }, { symbol: "MU", name: "Micron Technology" },
  { symbol: "QCOM", name: "Qualcomm Inc" }, { symbol: "RIVN", name: "Rivian Automotive" },
  { symbol: "GM", name: "General Motors Co" }, { symbol: "T", name: "AT&T Inc" },
  { symbol: "VZ", name: "Verizon Communications" }, { symbol: "CMCSA", name: "Comcast Corp" },
];

interface RedditPost {
  data: { title: string; selftext?: string; score: number; permalink: string };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const counts = new Map<string, { count: number; titles: string[] }>();

  try {
    // Reddit's public JSON endpoint needs no API key, but is stricter about
    // a descriptive User-Agent and can rate-limit or block server IPs
    // without warning -- if this fails, we fall back to the last successful
    // scan already stored rather than showing nothing.
    const res = await fetch("https://www.reddit.com/r/wallstreetbets/hot.json?limit=100", {
      headers: { "User-Agent": "web:tickerframe-wsb-tracker:1.0.0 (by /u/tickerframe)" },
    });
    if (!res.ok) throw new Error(`reddit request failed: ${res.status}`);
    const json = await res.json();
    const posts: RedditPost[] = Array.isArray(json?.data?.children) ? json.data.children : [];

    for (const post of posts) {
      const title = post.data?.title ?? "";
      for (const { symbol, name } of SYMBOLS) {
        // "$TICKER" always counts (the standard finance-social convention
        // for disambiguating a ticker from an ordinary word). A bare
        // uppercase ticker only counts for 3+ letter symbols -- 1-2 letter
        // tickers like "F", "T", "V", "GM", "MS" are far too likely to be
        // ordinary words or abbreviations rather than a real mention.
        const dollarPattern = new RegExp(`\\$${symbol}\\b`, "i");
        const barePattern = symbol.length >= 3 ? new RegExp(`\\b${symbol}\\b`) : null;
        if (dollarPattern.test(title) || (barePattern && barePattern.test(title))) {
          const entry = counts.get(symbol) ?? { count: 0, titles: [] };
          entry.count += 1;
          if (entry.titles.length < 3) entry.titles.push(title);
          counts.set(symbol, entry);
        }
      }
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e), usedCache: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Upsert every tracked symbol (including zero-mention ones this scan), not
  // just the ones that showed up -- otherwise a ticker that was trending
  // yesterday but wasn't mentioned at all in this scan would keep showing
  // its stale nonzero count forever.
  const now = new Date().toISOString();
  const rows = SYMBOLS.map(({ symbol, name }) => {
    const entry = counts.get(symbol);
    return {
      ticker: symbol,
      name,
      mention_count: entry?.count ?? 0,
      sample_titles: entry?.titles ?? [],
      scanned_at: now,
    };
  });

  await supabase.from("wsb_mentions").upsert(rows, { onConflict: "ticker" });

  return new Response(JSON.stringify({ scanned: rows.length, mentioned: rows.filter((r) => r.mention_count > 0).length }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
