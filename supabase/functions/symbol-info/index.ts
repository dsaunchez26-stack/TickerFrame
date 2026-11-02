import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { alpacaHeaders } from "../_shared/alpaca.ts";
import { requireUser } from "../_shared/requireUser.ts";

// Name, fund-or-stock, and (for stocks) industry for tickers the site does not track, so the
// Portfolio page can place a holding in a sector or asset class instead of calling it "Other".
// Names come from Alpaca's asset list, industries from Finnhub's company profile.
const TTL_MS = 30 * 86_400_000;
const MAX_SYMBOLS = 40;
const FUND_NAME = /\b(etf|etn|fund|trust)\b/i;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

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
  const info: Record<string, { name: string | null; isFund: boolean; industry: string | null }> = {};
  const { data: cached } = await supabase.from("symbol_info").select("*").in("symbol", symbols);
  for (const r of cached ?? []) {
    if (Date.now() - Date.parse(r.fetched_at) < TTL_MS) info[r.symbol] = { name: r.name, isFund: r.is_fund, industry: r.industry };
  }

  const todo = symbols.filter((s) => !info[s]);
  if (todo.length) {
    const headers = alpacaHeaders();
    const finnhub = Deno.env.get("FINNHUB_API_KEY");
    for (let i = 0; i < todo.length; i += 4) {
      await Promise.all(todo.slice(i, i + 4).map(async (s) => {
        let name: string | null = null;
        try {
          const r = await fetch(`https://paper-api.alpaca.markets/v2/assets/${encodeURIComponent(s)}`, { headers });
          if (r.ok) name = ((await r.json())?.name as string) ?? null;
        } catch { /* leave null */ }
        const isFund = !!name && FUND_NAME.test(name);
        let industry: string | null = null;
        if (!isFund && finnhub) {
          try {
            const r = await fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(s)}&token=${finnhub}`);
            if (r.ok) { const p = await r.json(); industry = p?.finnhubIndustry || null; if (!name) name = p?.name || null; }
          } catch { /* leave null */ }
        }
        info[s] = { name, isFund, industry };
        await supabase.from("symbol_info").upsert({ symbol: s, name, is_fund: isFund, industry, found: !!name, fetched_at: new Date().toISOString() }, { onConflict: "symbol" });
      }));
    }
  }
  return json({ info });
});
