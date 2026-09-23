import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { alpacaHeaders, fetchFullChain, snapshotPrice } from "../_shared/alpaca.ts";
import { greeksFromPrice } from "../_shared/blackScholes.ts";

// On-demand lookup for any ticker, not limited to the curated universe the
// main scanner tracks -- if it's optionable on Alpaca, this can look it up.
// Single-ticker requests don't hit the same rate-limit ceiling the main
// scanner does, so this fetches live on every call instead of reading a
// rolling cache.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let headers: Record<string, string>;
  try {
    headers = alpacaHeaders();
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

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
    const quoteRes = await fetch(`https://data.alpaca.markets/v2/stocks/${symbol}/trades/latest`, { headers });
    if (!quoteRes.ok) throw new Error(`quote request failed: ${await quoteRes.text()}`);
    const quoteJson = await quoteRes.json();
    const spot: number | null = typeof quoteJson?.trade?.p === "number" ? quoteJson.trade.p : null;
    if (!spot) throw new Error(`no quote found for ${symbol} -- check the ticker is correct and optionable`);

    const fullChain = await fetchFullChain(symbol, headers);
    if (!fullChain.length) throw new Error(`no listed options found for ${symbol}`);
    const expirations = [...new Set(fullChain.map((c) => c.expirationDate))].sort();

    const now = Date.now();
    const targetMs = now + 30 * 86400_000;
    const defaultExpiration = expirations.reduce((closest, d) =>
      Math.abs(new Date(d).getTime() - targetMs) < Math.abs(new Date(closest).getTime() - targetMs) ? d : closest,
      expirations[0]);
    const expiration = requestedExpiration && expirations.includes(requestedExpiration) ? requestedExpiration : defaultExpiration;

    const inExp = fullChain.filter((c) => c.expirationDate === expiration);
    const dte = Math.max(1, Math.round((new Date(expiration).getTime() - now) / 86400_000));
    const timeYears = dte / 365;

    const { data: patternRow } = await supabase
      .from("stock_cache")
      .select("pattern, pattern_confidence")
      .eq("symbol", symbol)
      .maybeSingle();

    const built = inExp.map((c) => {
      const price = snapshotPrice(c.snapshot);
      const cp: "C" | "P" = c.type === "call" ? "C" : "P";
      const bid = c.snapshot.latestQuote?.bp ?? 0;
      const ask = c.snapshot.latestQuote?.ap ?? 0;
      const effectivePrice = price ?? (bid > 0 && ask > 0 ? (bid + ask) / 2 : 0);
      const { iv, delta } = greeksFromPrice(cp, effectivePrice, spot, c.strike, timeYears);
      const breakeven = cp === "C" ? c.strike + effectivePrice : c.strike - effectivePrice;
      return { strike: c.strike, cp, price: effectivePrice, bid, ask, volume: c.snapshot.dailyBar?.v ?? 0, delta, iv, breakeven };
    }).filter((r) => r.price > 0);

    const atmIvs = built.filter((r) => r.iv !== null && Math.abs(r.strike - spot) / spot < 0.05).map((r) => r.iv as number);
    const currentIv = atmIvs.length ? atmIvs.reduce((a, b) => a + b, 0) / atmIvs.length : null;
    const expectedMove = currentIv !== null ? spot * currentIv * Math.sqrt(timeYears) : null;
    const expectedMovePct = expectedMove !== null ? (expectedMove / spot) * 100 : null;

    const rows = built
      .map((r) => ({
        id: `${symbol}-${Math.round(r.strike * 100)}-${r.cp}-${expiration}`,
        ticker: symbol,
        cp: r.cp,
        strike: r.strike,
        price: +r.price.toFixed(2),
        bid: +r.bid.toFixed(2),
        ask: +r.ask.toFixed(2),
        delta: r.delta,
        volume: r.volume,
        breakeven: +r.breakeven.toFixed(2),
        withinExpectedMove: expectedMove !== null ? Math.abs(r.strike - spot) <= expectedMove : null,
      }))
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
