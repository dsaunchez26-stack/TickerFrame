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

  await Promise.allSettled(
    symbols.map(async (symbol) => {
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

  return new Response(JSON.stringify({ quotes }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
