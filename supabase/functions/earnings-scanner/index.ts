import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { TRACKED_TICKERS } from "../_shared/symbols.ts";
import { logCronRun } from "../_shared/logCronRun.ts";

// Same tracked universe as fundamentals-scanner/fetch-stock-data -- see _shared/symbols.ts.
const SYMBOLS = TRACKED_TICKERS;

interface EarningsEvent { date: string; hour?: string | null; symbol: string }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const FINNHUB_API_KEY = Deno.env.get("FINNHUB_API_KEY");
  if (!FINNHUB_API_KEY) {
    return new Response(JSON.stringify({ error: "FINNHUB_API_KEY is not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const errors: Array<{ symbol: string; message: string }> = [];

  // Same "stalest first, capped batch" approach as fundamentals-scanner --
  // Finnhub's free tier is ~60 req/min, and one call per symbol for ~116
  // symbols would take longer than Supabase's 150s edge function idle
  // timeout if attempted in one shot. Processing whichever symbols have
  // gone longest without a refresh (never-scanned ones first) means every
  // symbol eventually gets covered across successive daily runs instead of
  // a fixed tail permanently never being reached.
  const BATCH_LIMIT = 60;
  const { data: existingRows } = await supabase
    .from("earnings_calendar")
    .select("symbol, updated_at")
    .in("symbol", SYMBOLS);
  const updatedAtBySymbol = new Map((existingRows ?? []).map((r) => [r.symbol, r.updated_at]));
  const batch = [...SYMBOLS].sort((a, b) => {
    const aTime = updatedAtBySymbol.get(a);
    const bTime = updatedAtBySymbol.get(b);
    if (!aTime && !bTime) return 0;
    if (!aTime) return -1;
    if (!bTime) return 1;
    return new Date(aTime).getTime() - new Date(bTime).getTime();
  }).slice(0, BATCH_LIMIT);

  const from = new Date().toISOString().slice(0, 10);
  const to = new Date(Date.now() + 180 * 86400_000).toISOString().slice(0, 10);

  const rows: Record<string, unknown>[] = [];
  const BATCH_SIZE = 3;
  const BATCH_PAUSE_MS = 3600;
  for (let i = 0; i < batch.length; i += BATCH_SIZE) {
    const chunk = batch.slice(i, i + BATCH_SIZE);
    const settled = await Promise.allSettled(chunk.map(async (symbol) => {
      const res = await fetch(`https://finnhub.io/api/v1/calendar/earnings?from=${from}&to=${to}&symbol=${symbol}&token=${FINNHUB_API_KEY}`);
      if (!res.ok) throw new Error(`earnings calendar fetch failed: ${res.status}`);
      const json = await res.json();
      const events: EarningsEvent[] = Array.isArray(json?.earningsCalendar) ? json.earningsCalendar : [];
      // Take the soonest future date -- a symbol can have more than one
      // entry in a 180-day window (estimated + confirmed, or two quarters).
      const next = events
        .filter((e) => e.date >= from)
        .sort((a, b) => a.date.localeCompare(b.date))[0];
      return { symbol, next: next ?? null };
    }));
    settled.forEach((r, idx) => {
      if (r.status === "fulfilled") {
        rows.push({
          symbol: r.value.symbol,
          next_earnings_date: r.value.next?.date ?? null,
          hour: r.value.next?.hour ?? null,
          updated_at: new Date().toISOString(),
        });
      } else {
        errors.push({ symbol: chunk[idx], message: r.reason instanceof Error ? r.reason.message : String(r.reason) });
      }
    });
    if (i + BATCH_SIZE < batch.length) await new Promise((r) => setTimeout(r, BATCH_PAUSE_MS));
  }

  if (rows.length) {
    const { error: upsertError } = await supabase.from("earnings_calendar").upsert(rows, { onConflict: "symbol" });
    if (upsertError) {
      await logCronRun(supabase, "earnings-scanner", false, 0, upsertError.message);
      return new Response(JSON.stringify({ error: upsertError.message }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  await logCronRun(supabase, "earnings-scanner", true, rows.length, errors.length ? `${errors.length} symbol errors` : null);

  return new Response(JSON.stringify({ scanned: batch.length, tracked: SYMBOLS.length, errors }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
