import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { alpacaHeaders } from "../_shared/alpaca.ts";

// Real open/high/low/close bars for the stock popup's candle chart, from
// Alpaca's free IEX feed (IEX trades only, so highs/lows can differ slightly
// from consolidated figures -- the UI says so). Cached briefly per symbol+range.
type Range = "1D" | "3D" | "1W" | "1M" | "3M" | "1Y" | "5Y";
const CONFIG: Record<Range, { timeframe: string; lookbackDays: number; keepDays?: number; ttlMs: number }> = {
  "1D": { timeframe: "5Min", lookbackDays: 7, keepDays: 1, ttlMs: 3 * 60_000 },
  "3D": { timeframe: "30Min", lookbackDays: 9, keepDays: 3, ttlMs: 5 * 60_000 },
  "1W": { timeframe: "1Hour", lookbackDays: 12, keepDays: 5, ttlMs: 10 * 60_000 },
  "1M": { timeframe: "1Day", lookbackDays: 35, ttlMs: 30 * 60_000 },
  "3M": { timeframe: "1Day", lookbackDays: 100, ttlMs: 30 * 60_000 },
  "1Y": { timeframe: "1Day", lookbackDays: 372, ttlMs: 30 * 60_000 },
  // Research only: the quarterly signal evaluation. Needs the service-role key (checked below), never offered to the app.
  "5Y": { timeframe: "1Day", lookbackDays: 1830, ttlMs: 12 * 3600_000 },
};

interface Bar { t: string; o: number; h: number; l: number; c: number; v: number }

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const nyDate = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/New_York" });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let symbol = "";
  let range = "" as Range;
  try {
    const body = await req.json();
    symbol = typeof body?.symbol === "string" ? body.symbol.trim().toUpperCase() : "";
    range = body?.range;
  } catch { /* handled below */ }
  if (!/^[A-Z][A-Z0-9.\-]{0,9}$/.test(symbol) || !CONFIG[range]) return json({ error: "Invalid symbol or range" }, 400);
  const cfg = CONFIG[range];
  if (range === "5Y" && req.headers.get("Authorization") !== `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`) {
    return json({ error: "Not available" }, 403);
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const key = `${symbol}:${range}`;
  const { data: cached } = await supabase.from("bars_cache").select("payload, fetched_at").eq("key", key).maybeSingle();
  if (cached && Date.now() - Date.parse(cached.fetched_at) < cfg.ttlMs) return json({ bars: cached.payload, cached: true });

  // Alpaca's free plan allows ~200 calls a minute across everything that uses the key (the options
  // scanner included). Past 100 fresh bar fetches in the last minute, serve stale data or ask to retry.
  const { count: recentCalls } = await supabase.from("bars_cache").select("key", { count: "exact", head: true }).gte("fetched_at", new Date(Date.now() - 60_000).toISOString());
  if ((recentCalls ?? 0) >= 100 && range !== "5Y") {
    if (cached) return json({ bars: cached.payload, cached: true, stale: true });
    return json({ error: "Chart data is busy right now - try again in a minute" }, 429);
  }

  try {
    const start = new Date(Date.now() - cfg.lookbackDays * 86_400_000).toISOString();
    const url = `https://data.alpaca.markets/v2/stocks/${encodeURIComponent(symbol)}/bars?timeframe=${cfg.timeframe}&start=${start}&limit=10000&adjustment=split&feed=iex&sort=asc`;
    const res = await fetch(url, { headers: alpacaHeaders() });
    if (!res.ok) throw new Error(`bars provider returned ${res.status}`);
    const raw = ((await res.json())?.bars ?? []) as Array<{ t: string; o: number; h: number; l: number; c: number; v: number }>;
    let bars: Bar[] = raw.map((b) => ({ t: b.t, o: b.o, h: b.h, l: b.l, c: b.c, v: b.v }));

    // Intraday: regular session only (hourly bars start on the hour, so 9:00 holds the open).
    if (cfg.timeframe !== "1Day") {
      const from = cfg.timeframe === "1Hour" ? 540 : 570;
      bars = bars.filter((b) => {
        const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(b.t));
        const mins = Number(parts.find((p) => p.type === "hour")!.value) % 24 * 60 + Number(parts.find((p) => p.type === "minute")!.value);
        return mins >= from && mins < 960;
      });
    }

    if (cfg.keepDays) {
      const days = [...new Set(bars.map((b) => nyDate(b.t)))].slice(-cfg.keepDays);
      bars = bars.filter((b) => days.includes(nyDate(b.t)));
    }
    await supabase.from("bars_cache").upsert({ key, payload: bars, fetched_at: new Date().toISOString() }, { onConflict: "key" });
    return json({ bars, cached: false });
  } catch (e) {
    if (cached) return json({ bars: cached.payload, cached: true, stale: true });
    return json({ error: e instanceof Error ? e.message : "Bars unavailable" }, 502);
  }
});
