import { corsHeaders } from "../_shared/cors.ts";

// Live lookup for portfolio holdings that fall outside the ~76-symbol
// tracked universe in stock_cache. Same Finnhub source, just fetched
// on-demand for whatever arbitrary symbol the user actually holds,
// instead of silently defaulting to $0 today-change for anything untracked.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const FINNHUB_API_KEY = Deno.env.get("FINNHUB_API_KEY");
  if (!FINNHUB_API_KEY) {
    return new Response(JSON.stringify({ error: "FINNHUB_API_KEY is not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let symbols: string[] = [];
  try {
    const body = await req.json();
    symbols = Array.isArray(body?.symbols) ? body.symbols.filter((s: unknown) => typeof s === "string") : [];
  } catch {
    // no body
  }

  if (!symbols.length) {
    return new Response(JSON.stringify({ quotes: {} }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const quotes: Record<string, { price: number; prevClose: number; changePercent: number }> = {};

  // Firing every symbol as one unpaced Promise.allSettled burst (the
  // original approach here) works fine for the common case -- a handful of
  // untracked portfolio holdings -- but silently falls over for anything
  // larger: e.g. a search/lookup that happens to batch several symbols at
  // once genuinely exceeds Finnhub's free-tier rate limit and comes back
  // with zeroed quotes indistinguishable from "this symbol doesn't exist".
  // Same small-batch-with-pause pacing as fetch-stock-data, which already
  // proved this is what's actually needed to stay under the ceiling.
  const BATCH_SIZE = 3;
  const BATCH_PAUSE_MS = 3600;
  for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
    const batch = symbols.slice(i, i + BATCH_SIZE);
    await Promise.allSettled(
      batch.map(async (symbol) => {
        const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_API_KEY}`);
        const quote = await res.json();
        if (!quote || typeof quote.c !== "number" || quote.c === 0) return;
        quotes[symbol] = {
          price: quote.c,
          prevClose: quote.pc ?? quote.c,
          changePercent: quote.dp ?? 0,
        };
      }),
    );
    if (i + BATCH_SIZE < symbols.length) await new Promise((r) => setTimeout(r, BATCH_PAUSE_MS));
  }

  return new Response(JSON.stringify({ quotes }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
