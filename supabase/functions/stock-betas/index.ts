import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { alpacaHeaders } from "../_shared/alpaca.ts";
import { requireUser } from "../_shared/requireUser.ts";

// Beta = how much a stock tends to move when the S&P 500 (SPY) moves, from about a
// year of daily returns: cov(stock, market) / var(market). Also returns R-squared (how
// much of the stock's movement the market explains -- the rest is company-specific
// risk CAPM does not see), annualized volatility, and the 10-year Treasury yield
// (FRED) as the risk-free rate. Cached for a day per ticker.
const TTL_MS = 24 * 3600_000;
const RF_TTL_MS = 12 * 3600_000;
const MIN_OBSERVATIONS = 100;
const MAX_SYMBOLS = 40;

interface Beta { beta: number; r2: number | null; volatility: number | null; observations: number }

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function dailyCloses(symbol: string): Promise<Map<string, number>> {
  const start = new Date(Date.now() - 372 * 86_400_000).toISOString();
  const url = `https://data.alpaca.markets/v2/stocks/${encodeURIComponent(symbol)}/bars?timeframe=1Day&start=${start}&limit=10000&adjustment=split&feed=iex&sort=asc`;
  const res = await fetch(url, { headers: alpacaHeaders() });
  if (!res.ok) throw new Error(`bars ${symbol} ${res.status}`);
  const bars = ((await res.json())?.bars ?? []) as Array<{ t: string; c: number }>;
  return new Map(bars.map((b) => [b.t.slice(0, 10), b.c]));
}

// Returns are taken between consecutive dates BOTH series traded, so a missing day
// in one series (thin IEX volume) stretches the period for both equally.
function computeBeta(stock: Map<string, number>, market: Map<string, number>): Beta | null {
  const dates = [...stock.keys()].filter((d) => market.has(d)).sort();
  if (dates.length < MIN_OBSERVATIONS + 1) return null;
  const rs: number[] = [], rm: number[] = [];
  for (let i = 1; i < dates.length; i++) {
    const s0 = stock.get(dates[i - 1])!, s1 = stock.get(dates[i])!, m0 = market.get(dates[i - 1])!, m1 = market.get(dates[i])!;
    if (s0 > 0 && m0 > 0) { rs.push(s1 / s0 - 1); rm.push(m1 / m0 - 1); }
  }
  const n = rs.length;
  if (n < MIN_OBSERVATIONS) return null;
  const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  const ms = mean(rs), mm = mean(rm);
  let cov = 0, vm = 0, vs = 0;
  for (let i = 0; i < n; i++) { cov += (rs[i] - ms) * (rm[i] - mm); vm += (rm[i] - mm) ** 2; vs += (rs[i] - ms) ** 2; }
  if (vm === 0) return null;
  const beta = cov / vm;
  const r2 = vs > 0 ? (cov * cov) / (vm * vs) : null;
  const volatility = Math.sqrt(vs / (n - 1)) * Math.sqrt(252) * 100;
  return { beta, r2, volatility, observations: n };
}

async function riskFreeRate(supabase: ReturnType<typeof createClient>) {
  const { data: cached } = await supabase.from("risk_inputs").select("value, as_of, updated_at").eq("key", "rf_10y").maybeSingle();
  if (cached && Date.now() - Date.parse(cached.updated_at) < RF_TTL_MS) return { ratePct: Number(cached.value), asOf: cached.as_of as string | null };
  try {
    const res = await fetch("https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS10");
    if (!res.ok) throw new Error(String(res.status));
    const lines = (await res.text()).trim().split("\n").slice(1).map((l) => l.split(","));
    const last = [...lines].reverse().find(([, v]) => v && v !== "." && Number.isFinite(Number(v)));
    if (!last) throw new Error("no value");
    await supabase.from("risk_inputs").upsert({ key: "rf_10y", value: Number(last[1]), as_of: last[0], updated_at: new Date().toISOString() }, { onConflict: "key" });
    return { ratePct: Number(last[1]), asOf: last[0] };
  } catch {
    return cached ? { ratePct: Number(cached.value), asOf: cached.as_of as string | null } : null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const denied = await requireUser(req);
  if (denied) return denied;

  let symbols: string[] = [];
  try {
    const body = await req.json();
    symbols = Array.isArray(body?.symbols) ? body.symbols.map((s: unknown) => String(s).trim().toUpperCase()) : [];
  } catch { /* handled below */ }
  symbols = [...new Set(symbols)].filter((s) => /^[A-Z][A-Z0-9.\-]{0,9}$/.test(s)).slice(0, MAX_SYMBOLS);
  if (!symbols.length) return json({ error: "No valid symbols" }, 400);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const betas: Record<string, Beta & { asOf: string }> = {};
  const { data: cached } = await supabase.from("beta_cache").select("*").in("symbol", symbols);
  for (const r of cached ?? []) {
    if (Date.now() - Date.parse(r.computed_at) < TTL_MS) betas[r.symbol] = { beta: Number(r.beta), r2: r.r_squared == null ? null : Number(r.r_squared), volatility: r.volatility == null ? null : Number(r.volatility), observations: r.observations ?? 0, asOf: r.computed_at };
  }
  if (symbols.includes("SPY")) betas["SPY"] = { beta: 1, r2: 1, volatility: null, observations: 0, asOf: new Date().toISOString() };

  const todo = symbols.filter((s) => !betas[s]);
  const missing: string[] = [];
  if (todo.length) {
    let market: Map<string, number>;
    try { market = await dailyCloses("SPY"); } catch { return json({ error: "Market data is unavailable right now" }, 502); }
    for (let i = 0; i < todo.length; i += 4) {
      await Promise.all(todo.slice(i, i + 4).map(async (s) => {
        try {
          const b = computeBeta(await dailyCloses(s), market);
          if (!b) { missing.push(s); return; }
          const now = new Date().toISOString();
          betas[s] = { ...b, asOf: now };
          await supabase.from("beta_cache").upsert({ symbol: s, beta: b.beta, r_squared: b.r2, volatility: b.volatility, observations: b.observations, computed_at: now }, { onConflict: "symbol" });
        } catch { missing.push(s); }
      }));
    }
  }

  return json({ betas, missing, riskFree: await riskFreeRate(supabase) });
});
