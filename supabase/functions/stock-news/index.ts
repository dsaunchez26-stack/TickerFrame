import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";

// Headlines only: title, outlet, link, time. Each links out to the publisher --
// we don't copy article text. Company news for a ticker, or general market
// news when no symbol is given. Cached for 10 minutes so a busy page costs one
// provider call, not one per visitor.
const TTL_MS = 10 * 60_000;
const MAX_ITEMS = 10;

interface NewsItem { headline: string; source: string; url: string; datetime: number }

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const clean = (raw: unknown): NewsItem[] => {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: NewsItem[] = [];
  for (const r of raw) {
    const headline = typeof r?.headline === "string" ? r.headline.trim() : "";
    const url = typeof r?.url === "string" ? r.url : "";
    if (!headline || !url.startsWith("https://")) continue;
    const key = headline.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ headline, source: typeof r.source === "string" ? r.source : "", url, datetime: Number(r.datetime) || 0 });
  }
  return out.sort((a, b) => b.datetime - a.datetime).slice(0, MAX_ITEMS);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const FINNHUB_API_KEY = Deno.env.get("FINNHUB_API_KEY");
  if (!FINNHUB_API_KEY) return json({ error: "FINNHUB_API_KEY is not configured" }, 500);

  let symbol = "";
  try {
    const body = await req.json();
    if (typeof body?.symbol === "string") symbol = body.symbol.trim().toUpperCase();
  } catch { /* no body = market news */ }
  if (symbol && !/^[A-Z][A-Z0-9.\-]{0,9}$/.test(symbol)) return json({ error: "Invalid symbol" }, 400);

  const key = symbol ? `stock:${symbol}` : "market";
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: cached } = await supabase.from("news_cache").select("payload, fetched_at").eq("key", key).maybeSingle();
  if (cached && Date.now() - Date.parse(cached.fetched_at) < TTL_MS) {
    return json({ items: cached.payload, cached: true, fetchedAt: cached.fetched_at });
  }

  const today = new Date();
  const from = new Date(today.getTime() - 7 * 86_400_000);
  const ymd = (d: Date) => d.toISOString().slice(0, 10);
  const url = symbol
    ? `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(symbol)}&from=${ymd(from)}&to=${ymd(today)}&token=${FINNHUB_API_KEY}`
    : `https://finnhub.io/api/v1/news?category=general&token=${FINNHUB_API_KEY}`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`news provider returned ${res.status}`);
    const items = clean(await res.json());
    const fetchedAt = new Date().toISOString();
    await supabase.from("news_cache").upsert({ key, payload: items, fetched_at: fetchedAt }, { onConflict: "key" });
    return json({ items, cached: false, fetchedAt });
  } catch (e) {
    // Serve the stale copy rather than an error if the provider hiccups.
    if (cached) return json({ items: cached.payload, cached: true, stale: true, fetchedAt: cached.fetched_at });
    return json({ error: e instanceof Error ? e.message : "News is unavailable right now" }, 502);
  }
});
