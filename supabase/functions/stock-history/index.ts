import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";

// Long-run closing prices for the stock chart's 5Y / 10Y / 20Y / MAX views.
// Primary source: Tiingo's end-of-day API (needs the TIINGO_API_KEY secret). Fallback,
// used when the key is missing or Tiingo fails: Yahoo Finance's unofficial chart
// endpoint (no key -- the same one the futures scanner uses). Closes are adjusted for
// stock splits so a 1990 price is comparable to today's; a second series is also
// adjusted for dividends so the chart can show total return. We fetch the full history
// once per symbol, derive both granularities from it and cache them for a day.
//   5Y, 10Y  -> weekly closes
//   20Y, MAX -> month-end closes (built from the same data)
type Range = "5Y" | "10Y" | "20Y" | "MAX";
const YEARS: Record<Range, number | null> = { "5Y": 5, "10Y": 10, "20Y": 20, MAX: null };
const KIND: Record<Range, "wk" | "mo"> = { "5Y": "wk", "10Y": "wk", "20Y": "mo", MAX: "mo" };
const TTL_MS = 24 * 3600_000;
const YAHOO = "https://query1.finance.yahoo.com/v8/finance/chart";

interface Series { t: number[]; c: number[]; a: number[] }
interface Stored { wk: Series; mo: Series; name: string | null; currency: string | null; source?: "tiingo" | "yahoo"; fallbackReason?: string }

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const round = (n: number) => Math.round(n * 100000) / 100000;

// Shared tail: weekly series in, both stored granularities out.
function finish(wk: Series, name: string | null, currency: string | null, source: "tiingo" | "yahoo"): Stored {
  if (wk.t.length < 2) throw new Error("Not enough history for that symbol");
  // Month-end resample: keep the last weekly bar of each calendar month.
  const mo: Series = { t: [], c: [], a: [] };
  let lastKey = "";
  for (let i = 0; i < wk.t.length; i++) {
    const d = new Date(wk.t[i] * 1000);
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
    if (key === lastKey) {
      const j = mo.t.length - 1;
      mo.t[j] = wk.t[i]; mo.c[j] = wk.c[i]; mo.a[j] = wk.a[i];
    } else {
      mo.t.push(wk.t[i]); mo.c.push(wk.c[i]); mo.a.push(wk.a[i]);
      lastKey = key;
    }
  }
  const tenYearsAgo = Date.now() / 1000 - 10 * 365.25 * 86400;
  const from = wk.t.findIndex((t) => t >= tenYearsAgo);
  const start = from < 0 ? Math.max(0, wk.t.length - 520) : from;
  return { wk: { t: wk.t.slice(start), c: wk.c.slice(start), a: wk.a.slice(start) }, mo, name, currency, source };
}

async function fetchYahoo(symbol: string): Promise<Stored> {
  // Yahoo spells share classes with a dash (BRK.B -> BRK-B).
  const ySym = encodeURIComponent(symbol.replace(".", "-"));
  const now = Math.floor(Date.now() / 1000);
  const res = await fetch(`${YAHOO}/${ySym}?period1=-3000000000&period2=${now}&interval=1wk`, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; TickerframeBot/1.0)" },
  });
  if (!res.ok) throw new Error(`history provider returned ${res.status}`);
  const r = (await res.json())?.chart?.result?.[0];
  const ts: number[] | undefined = r?.timestamp;
  const close: Array<number | null> | undefined = r?.indicators?.quote?.[0]?.close;
  const adj: Array<number | null> | undefined = r?.indicators?.adjclose?.[0]?.adjclose;
  if (!ts || !close) throw new Error("No history found for that symbol");

  const wk: Series = { t: [], c: [], a: [] };
  for (let i = 0; i < ts.length; i++) {
    const c = close[i];
    if (c == null || !Number.isFinite(c) || c <= 0) continue;
    const a = adj?.[i];
    wk.t.push(ts[i]);
    wk.c.push(round(c));
    wk.a.push(round(a != null && Number.isFinite(a) && a > 0 ? a : c));
  }
  const name = typeof r?.meta?.longName === "string" ? r.meta.longName : (typeof r?.meta?.shortName === "string" ? r.meta.shortName : null);
  return finish(wk, name, typeof r?.meta?.currency === "string" ? r.meta.currency : null, "yahoo");
}

// Tiingo's `close` is the raw price as printed that day; `adjClose` already has splits and
// dividends applied. We rebuild a split-only close by dividing each day by the product of
// every later split factor, then keep the last trading day of each week.
async function fetchTiingo(symbol: string, key: string): Promise<Stored> {
  const t = encodeURIComponent(symbol.replace(".", "-"));
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Token ${key}`,
    "User-Agent": "Mozilla/5.0 (compatible; TickerframeBot/1.0)",
  };
  const [res, meta] = await Promise.all([
    fetch(`https://api.tiingo.com/tiingo/daily/${t}/prices?startDate=1900-01-01&columns=date,close,adjClose,splitFactor`, { headers }),
    fetch(`https://api.tiingo.com/tiingo/daily/${t}`, { headers }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
  ]);
  if (!res.ok) throw new Error(`tiingo returned ${res.status}: ${(await res.text()).slice(0, 120).replace(/\s+/g, " ")}`);
  const rows: Array<{ date: string; close: number; adjClose: number; splitFactor?: number }> = await res.json();
  if (!Array.isArray(rows) || rows.length < 2) throw new Error("tiingo has no history for that symbol");

  const c = new Array<number>(rows.length);
  let cum = 1;
  for (let i = rows.length - 1; i >= 0; i--) {
    c[i] = rows[i].close / cum;
    const f = rows[i].splitFactor;
    if (f && Number.isFinite(f) && f > 0) cum *= f;
  }

  const wk: Series = { t: [], c: [], a: [] };
  let lastWeek = -1;
  for (let i = 0; i < rows.length; i++) {
    const sec = Math.floor(Date.parse(rows[i].date) / 1000);
    const a = rows[i].adjClose;
    if (!Number.isFinite(sec) || !Number.isFinite(c[i]) || c[i] <= 0) continue;
    const adj = Number.isFinite(a) && a > 0 ? a : c[i];
    const week = Math.floor((sec / 86400 + 3) / 7); // Monday-based week number
    if (week === lastWeek) {
      const j = wk.t.length - 1;
      wk.t[j] = sec; wk.c[j] = round(c[i]); wk.a[j] = round(adj);
    } else {
      wk.t.push(sec); wk.c.push(round(c[i])); wk.a.push(round(adj));
      lastWeek = week;
    }
  }
  return finish(wk, typeof meta?.name === "string" ? meta.name : null, "USD", "tiingo");
}

async function fetchHistory(symbol: string): Promise<Stored> {
  const key = Deno.env.get("TIINGO_API_KEY");
  let fallbackReason = key ? undefined : "no TIINGO_API_KEY set";
  if (key) {
    try {
      return await fetchTiingo(symbol, key);
    } catch (e) {
      fallbackReason = e instanceof Error ? e.message : String(e);
      console.warn(`tiingo failed for ${symbol}, falling back to yahoo:`, fallbackReason);
    }
  }
  return { ...(await fetchYahoo(symbol)), fallbackReason };
}

const slice = (s: Series, years: number | null): Series => {
  if (years == null) return s;
  const cutoff = Date.now() / 1000 - years * 365.25 * 86400;
  const i = s.t.findIndex((t) => t >= cutoff);
  const from = i < 0 ? Math.max(0, s.t.length - 2) : i;
  return { t: s.t.slice(from), c: s.c.slice(from), a: s.a.slice(from) };
};

const respond = (stored: Stored, range: Range, extra: Record<string, unknown>) => {
  const s = slice(stored[KIND[range]], YEARS[range]);
  return json({ ...s, interval: KIND[range] === "wk" ? "week" : "month", name: stored.name, currency: stored.currency, source: stored.source ?? "yahoo", ...(stored.fallbackReason ? { fallbackReason: stored.fallbackReason } : {}), ...extra });
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let symbol = "";
  let range = "" as Range;
  try {
    const body = await req.json();
    symbol = typeof body?.symbol === "string" ? body.symbol.trim().toUpperCase() : "";
    range = body?.range;
  } catch { /* handled below */ }
  if (!/^[A-Z][A-Z0-9.\-]{0,9}$/.test(symbol) || !(range in YEARS)) return json({ error: "Invalid symbol or range" }, 400);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const key = `${symbol}:all`;

  const { data: cached } = await supabase.from("history_cache").select("payload, fetched_at").eq("key", key).maybeSingle();
  if (cached && Date.now() - Date.parse(cached.fetched_at) < TTL_MS) {
    return respond(cached.payload as Stored, range, { cached: true });
  }

  // Provider politeness: past 15 fresh lookups in the last minute, serve what we have or ask the caller to retry.
  const { count: recent } = await supabase.from("history_cache").select("key", { count: "exact", head: true }).gte("fetched_at", new Date(Date.now() - 60_000).toISOString());
  if ((recent ?? 0) >= 15) {
    if (cached) return respond(cached.payload as Stored, range, { cached: true, stale: true });
    return json({ error: "Long-term history is busy right now - try again in a minute" }, 429);
  }

  try {
    const stored = await fetchHistory(symbol);
    await supabase.from("history_cache").upsert({ key, payload: stored, fetched_at: new Date().toISOString() }, { onConflict: "key" });
    return respond(stored, range, { cached: false });
  } catch (e) {
    if (cached) return respond(cached.payload as Stored, range, { cached: true, stale: true });
    return json({ error: e instanceof Error ? e.message : "History is unavailable right now" }, 502);
  }
});
