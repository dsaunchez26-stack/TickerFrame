import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// On-demand lookup for any ticker, not limited to the curated universe the
// main scanner tracks -- if it's optionable on Tradier, this can look it up.
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const TRADIER_API_KEY = Deno.env.get("TRADIER_API_KEY");
  if (!TRADIER_API_KEY) {
    return new Response(JSON.stringify({ error: "TRADIER_API_KEY is not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const base = "https://sandbox.tradier.com/v1";
  const headers = { Authorization: `Bearer ${TRADIER_API_KEY}`, Accept: "application/json" };

  let symbol = "";
  let requestedExpiration: string | null = null;
  try {
    const body = await req.json();
    symbol = typeof body?.symbol === "string" ? body.symbol.toUpperCase().trim() : "";
    requestedExpiration = typeof body?.expiration === "string" ? body.expiration : null;
  } catch {
    // no body
  }
  if (!symbol) {
    return new Response(JSON.stringify({ error: "symbol is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const [quoteRes, expRes] = await Promise.all([
      fetch(`${base}/markets/quotes?symbols=${symbol}`, { headers }),
      fetch(`${base}/markets/options/expirations?symbol=${symbol}&includeAllRoots=true&strikes=false`, { headers }),
    ]);

    if (!quoteRes.ok) throw new Error(`quote request failed: ${await quoteRes.text()}`);
    const quoteJson = await quoteRes.json();
    const quote = Array.isArray(quoteJson?.quotes?.quote) ? quoteJson.quotes.quote[0] : quoteJson?.quotes?.quote;
    const spot = typeof quote?.last === "number" ? quote.last : null;
    if (!spot) throw new Error(`no quote found for ${symbol} -- check the ticker is correct and optionable`);

    if (!expRes.ok) throw new Error(`expirations request failed: ${await expRes.text()}`);
    const expJson = await expRes.json();
    const expirations: string[] = Array.isArray(expJson?.expirations?.date) ? expJson.expirations.date : [];
    if (!expirations.length) throw new Error(`no listed options found for ${symbol}`);

    // Default to the expiration closest to 30 days out if the caller didn't
    // ask for a specific one, or didn't ask for one that's actually listed.
    const now = Date.now();
    const targetMs = now + 30 * 86400_000;
    const defaultExpiration = expirations.reduce((closest, d) =>
      Math.abs(new Date(d).getTime() - targetMs) < Math.abs(new Date(closest).getTime() - targetMs) ? d : closest,
      expirations[0]);
    const expiration = requestedExpiration && expirations.includes(requestedExpiration) ? requestedExpiration : defaultExpiration;

    const chainRes = await fetch(`${base}/markets/options/chains?symbol=${symbol}&expiration=${expiration}&greeks=true`, { headers });
    if (!chainRes.ok) throw new Error(`chain request failed: ${await chainRes.text()}`);
    const chainJson = await chainRes.json();
    const options: TradierOption[] = Array.isArray(chainJson?.options?.option) ? chainJson.options.option : [];

    const { data: patternRow } = await supabase
      .from("stock_cache")
      .select("pattern, pattern_confidence")
      .eq("symbol", symbol)
      .maybeSingle();

    // Same 1-SD expected-move estimate the main scanner uses: stock price x
    // ATM IV x sqrt(time in years).
    const atmIvs = options
      .filter((o) => Math.abs(o.strike - spot) / spot < 0.05)
      .map((o) => o.greeks?.mid_iv || o.greeks?.smv_vol)
      .filter((iv): iv is number => !!iv && iv > 0);
    const currentIv = atmIvs.length ? atmIvs.reduce((a, b) => a + b, 0) / atmIvs.length : null;
    const dte = Math.max(1, Math.round((new Date(expiration).getTime() - now) / 86400_000));
    const expectedMove = currentIv !== null ? spot * currentIv * Math.sqrt(dte / 365) : null;
    const expectedMovePct = expectedMove !== null ? (expectedMove / spot) * 100 : null;

    const rows = options
      .map((o) => {
        const bid = o.bid ?? 0;
        const ask = o.ask ?? 0;
        const price = o.last || (bid + ask) / 2;
        const side = o.option_type === "call" ? "C" : "P";
        const breakeven = side === "C" ? o.strike + price : o.strike - price;
        return {
          id: `${symbol}-${Math.round(o.strike * 100)}-${side}-${expiration}`,
          ticker: symbol,
          cp: side,
          strike: o.strike,
          price: +price.toFixed(2),
          bid: +bid.toFixed(2),
          ask: +ask.toFixed(2),
          delta: o.greeks?.delta ?? 0,
          volume: o.volume ?? 0,
          oi: o.open_interest ?? 0,
          breakeven: +breakeven.toFixed(2),
          withinExpectedMove: expectedMove !== null ? Math.abs(o.strike - spot) <= expectedMove : null,
        };
      })
      .sort((a, b) => a.strike - b.strike);

    return new Response(JSON.stringify({
      symbol, spot, expirations, expiration,
      expectedMovePct: expectedMovePct !== null ? +expectedMovePct.toFixed(2) : null,
      pattern: patternRow?.pattern ?? null,
      patternConfidence: patternRow?.pattern_confidence ?? null,
      rows,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
