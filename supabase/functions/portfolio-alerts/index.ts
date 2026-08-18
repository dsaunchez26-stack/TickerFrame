import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { logCronRun } from "../_shared/logCronRun.ts";
import { isMarketOpen } from "../_shared/marketHours.ts";
import { broadSector } from "../_shared/sectorMapping.ts";
import { computeSectorBenchmarks, relativeScore } from "../_shared/sectorRelativeValuation.ts";
import { PATTERN_BIAS } from "../_shared/patternBias.ts";

// Checks every signed-up user's held tickers (portfolio stock positions +
// underlying tickers of tracked option picks) for:
//   1. new insider buy filings
//   2. target-gain/stop-loss crossings on portfolio positions
//   3. newly-qualifying small-cap value ideas
//   4. big intraday price moves
//   5. new bullish/bearish chart patterns
//   6. earnings reports coming up within 3 days
// ...then posts whatever's new straight to that user's Slack webhook. Runs
// every 30 minutes during market hours via cron; sent_alerts is the dedupe
// log so the same filing/hit/idea/move/pattern/earnings date isn't
// re-posted on every run.

const IDEA_MIN_CAP = 300, IDEA_MAX_CAP = 2000, IDEA_MIN_BALANCE = 40, IDEA_MIN_GROWTH = 30, IDEA_MIN_SCORE = 65;
const absolutePeToScore = (pe: number) => Math.max(0, Math.min(100, 100 - pe * 2.5));
const absolutePbToScore = (pb: number) => Math.max(0, Math.min(100, 100 - pb * 20));
const absolutePsToScore = (ps: number) => Math.max(0, Math.min(100, 100 - ps * 30));

const BIG_MOVE_PCT = 6;
const EARNINGS_LOOKAHEAD_DAYS = 3;

function isoWeek(d: Date): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${week}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const finnhubKey = Deno.env.get("FINNHUB_API_KEY");

  if (!isMarketOpen()) {
    await logCronRun(supabase, "portfolio-alerts", true, 0, "market closed, skipped");
    return new Response(JSON.stringify({ skipped: "market closed" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // One-shot dedupe check + insert helper shared by every alert type below.
  const alreadySent = async (key: string) => {
    const { data } = await supabase.from("sent_alerts").select("id").eq("alert_key", key).maybeSingle();
    return !!data;
  };

  try {
    const { data: settings } = await supabase
      .from("user_notification_settings")
      .select("user_id, slack_webhook_url, alerts_insider, alerts_target_stop, alerts_value_ideas, alerts_big_move, alerts_pattern, alerts_earnings")
      .not("slack_webhook_url", "is", null);

    const activeUsers = (settings ?? []).filter(s => s.slack_webhook_url && (
      s.alerts_insider || s.alerts_target_stop || s.alerts_value_ideas
      || s.alerts_big_move || s.alerts_pattern || s.alerts_earnings
    ));
    if (!activeUsers.length) {
      await logCronRun(supabase, "portfolio-alerts", true, 0, "no users with alerts configured");
      return new Response(JSON.stringify({ sent: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Idea screening only needs to run once total, not once per user.
    let ideaCandidates: { symbol: string; sector: string; composite: number }[] = [];
    if (activeUsers.some(u => u.alerts_value_ideas)) {
      const { data: fundamentals } = await supabase
        .from("stock_fundamentals")
        .select("symbol, sector, market_cap, balance_sheet_score, growth_score, pe_ratio, pb_ratio, ps_ratio");
      const rows = fundamentals ?? [];
      const benchmarks = computeSectorBenchmarks(rows);
      ideaCandidates = rows
        .filter(r => r.market_cap !== null && r.market_cap >= IDEA_MIN_CAP && r.market_cap <= IDEA_MAX_CAP
          && r.balance_sheet_score >= IDEA_MIN_BALANCE && r.growth_score >= IDEA_MIN_GROWTH)
        .map(r => {
          const sector = broadSector(r.symbol, r.sector);
          const benchmark = benchmarks.get(sector);
          const parts: number[] = [];
          if (r.pe_ratio !== null) parts.push(relativeScore(r.pe_ratio, benchmark?.medianPE ?? null) ?? absolutePeToScore(r.pe_ratio));
          if (r.pb_ratio !== null && r.pb_ratio > 0) parts.push(relativeScore(r.pb_ratio, benchmark?.medianPB ?? null) ?? absolutePbToScore(r.pb_ratio));
          if (r.ps_ratio !== null && r.ps_ratio > 0) parts.push(relativeScore(r.ps_ratio, benchmark?.medianPS ?? null) ?? absolutePsToScore(r.ps_ratio));
          if (!parts.length) return null;
          const valuationScore = parts.reduce((a, b) => a + b, 0) / parts.length;
          const composite = (valuationScore + r.balance_sheet_score + r.growth_score) / 3;
          return { symbol: r.symbol, sector, composite };
        })
        .filter((v): v is { symbol: string; sector: string; composite: number } => v !== null && v.composite >= IDEA_MIN_SCORE);
    }

    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const week = isoWeek(now);
    let totalSent = 0;

    for (const user of activeUsers) {
      const lines: string[] = [];
      const newKeys: string[] = [];

      const { data: positions } = await supabase
        .from("portfolio")
        .select("symbol, buy_price, target_gain_pct, stop_loss_pct")
        .eq("user_id", user.user_id);
      const { data: optionPicks } = await supabase
        .from("option_tracked_picks")
        .select("row")
        .eq("user_id", user.user_id);

      const heldSymbols = new Set<string>();
      for (const p of positions ?? []) heldSymbols.add(p.symbol);
      for (const o of optionPicks ?? []) {
        const ticker = (o.row as { ticker?: string } | null)?.ticker;
        if (ticker) heldSymbols.add(ticker);
      }
      const symbols = Array.from(heldSymbols);

      // --- Insider buys on held tickers ---
      if (user.alerts_insider && symbols.length) {
        const { data: filings } = await supabase
          .from("insider_activity")
          .select("id, ticker, filer_name, filer_title, shares, price_per_share, total_value, filing_date, form_type, filing_url")
          .in("ticker", symbols)
          .eq("form_type", "4")
          .gte("filing_date", new Date(now.getTime() - 3 * 86400_000).toISOString().slice(0, 10))
          .order("filing_date", { ascending: false });

        for (const f of filings ?? []) {
          const key = `insider:${user.user_id}:${f.id}`;
          if (await alreadySent(key)) continue;
          const value = f.total_value ? `$${Number(f.total_value).toLocaleString()}` : "undisclosed value";
          lines.push(`🟢 *${f.ticker}* — ${f.filer_name}${f.filer_title ? ` (${f.filer_title})` : ""} bought ${value} in stock on ${f.filing_date}`);
          newKeys.push(key);
        }
      }

      // --- Shared market-data lookup: tracked stock_cache first, Finnhub
      // live quote as a fallback for anything held but not in the ~114-
      // symbol tracked universe (most real brokerage holdings, in practice).
      // Feeds both the target/stop-loss and big-move checks below.
      const needsMarketData = user.alerts_target_stop || user.alerts_big_move;
      const marketData = new Map<string, { price: number; changePercent: number | null }>();
      if (needsMarketData && symbols.length) {
        const { data: cached } = await supabase
          .from("stock_cache")
          .select("symbol, price, change_percent")
          .in("symbol", symbols);
        for (const c of cached ?? []) {
          if (c.price) marketData.set(c.symbol, { price: Number(c.price), changePercent: c.change_percent !== null ? Number(c.change_percent) : null });
        }
        const missing = symbols.filter(s => !marketData.has(s));
        if (missing.length && finnhubKey) {
          await Promise.allSettled(missing.map(async (symbol) => {
            try {
              const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${finnhubKey}`);
              const q = await res.json();
              if (typeof q.c === "number" && q.c > 0) marketData.set(symbol, { price: q.c, changePercent: typeof q.dp === "number" ? q.dp : null });
            } catch { /* skip this symbol this run */ }
          }));
        }
      }

      // --- Target gain / stop loss hits ---
      if (user.alerts_target_stop) {
        const withThresholds = (positions ?? []).filter(p => p.target_gain_pct !== null || p.stop_loss_pct !== null);
        for (const p of withThresholds) {
          const key = `targetstop:${user.user_id}:${p.symbol}:${today}`;
          if (await alreadySent(key)) continue;
          const price = marketData.get(p.symbol)?.price;
          if (price === undefined || !p.buy_price) continue;

          const gainPct = ((price - Number(p.buy_price)) / Number(p.buy_price)) * 100;
          if (p.target_gain_pct !== null && gainPct >= Number(p.target_gain_pct)) {
            lines.push(`🎯 *${p.symbol}* hit your +${Number(p.target_gain_pct)}% target — currently +${gainPct.toFixed(1)}% ($${price.toFixed(2)})`);
            newKeys.push(key);
          } else if (p.stop_loss_pct !== null && gainPct <= -Number(p.stop_loss_pct)) {
            lines.push(`🔻 *${p.symbol}* hit your -${Number(p.stop_loss_pct)}% stop-loss — currently ${gainPct.toFixed(1)}% ($${price.toFixed(2)})`);
            newKeys.push(key);
          }
        }
      }

      // --- Big intraday moves ---
      if (user.alerts_big_move) {
        for (const symbol of symbols) {
          const md = marketData.get(symbol);
          if (!md || md.changePercent === null || Math.abs(md.changePercent) < BIG_MOVE_PCT) continue;
          const key = `bigmove:${user.user_id}:${symbol}:${today}`;
          if (await alreadySent(key)) continue;
          const dir = md.changePercent >= 0 ? "up" : "down";
          const emoji = md.changePercent >= 0 ? "🚀" : "⚠️";
          lines.push(`${emoji} *${symbol}* is ${dir} ${Math.abs(md.changePercent).toFixed(1)}% today ($${md.price.toFixed(2)}) — worth deciding whether to act`);
          newKeys.push(key);
        }
      }

      // --- New bullish/bearish chart patterns (tracked universe only) ---
      if (user.alerts_pattern && symbols.length) {
        const { data: patternRows } = await supabase
          .from("stock_cache")
          .select("symbol, pattern, pattern_confidence")
          .in("symbol", symbols)
          .not("pattern", "is", null);
        for (const r of patternRows ?? []) {
          const meta = r.pattern ? PATTERN_BIAS[r.pattern] : null;
          if (!meta || meta.bias === "neutral") continue;
          const key = `pattern:${user.user_id}:${r.symbol}:${r.pattern}:${today}`;
          if (await alreadySent(key)) continue;
          const emoji = meta.bias === "bullish" ? "📈" : "📉";
          const conf = r.pattern_confidence !== null ? ` (${r.pattern_confidence}% confidence)` : "";
          lines.push(`${emoji} *${r.symbol}* — ${meta.label} pattern detected${conf}`);
          newKeys.push(key);
        }
      }

      // --- Earnings coming up within a few days ---
      if (user.alerts_earnings && symbols.length) {
        const cutoff = new Date(now.getTime() + EARNINGS_LOOKAHEAD_DAYS * 86400_000).toISOString().slice(0, 10);
        const { data: tracked } = await supabase
          .from("earnings_calendar")
          .select("symbol, next_earnings_date, hour")
          .in("symbol", symbols)
          .gte("next_earnings_date", today)
          .lte("next_earnings_date", cutoff);
        const trackedSymbols = new Set((tracked ?? []).map(t => t.symbol));
        const upcoming = [...(tracked ?? [])];

        const untracked = symbols.filter(s => !trackedSymbols.has(s));
        if (untracked.length && finnhubKey) {
          await Promise.allSettled(untracked.map(async (symbol) => {
            try {
              const res = await fetch(`https://finnhub.io/api/v1/calendar/earnings?from=${today}&to=${cutoff}&symbol=${symbol}&token=${finnhubKey}`);
              const json = await res.json();
              const events: Array<{ date: string; hour: string | null }> = Array.isArray(json?.earningsCalendar) ? json.earningsCalendar : [];
              const next = events.filter(e => e.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0];
              if (next) upcoming.push({ symbol, next_earnings_date: next.date, hour: next.hour });
            } catch { /* skip this symbol this run */ }
          }));
        }

        for (const e of upcoming) {
          const key = `earnings:${user.user_id}:${e.symbol}:${e.next_earnings_date}`;
          if (await alreadySent(key)) continue;
          const when = e.hour === "bmo" ? "before market open" : e.hour === "amc" ? "after market close" : "";
          lines.push(`📅 *${e.symbol}* reports earnings on ${e.next_earnings_date}${when ? ` (${when})` : ""}`);
          newKeys.push(key);
        }
      }

      // --- New small-cap value ideas ---
      if (user.alerts_value_ideas) {
        for (const c of ideaCandidates) {
          const key = `idea:${user.user_id}:${c.symbol}:${week}`;
          if (await alreadySent(key)) continue;
          lines.push(`💎 *${c.symbol}* (${c.sector}) is scoring ${c.composite.toFixed(0)}/100 on this week's small-cap value screen`);
          newKeys.push(key);
        }
      }

      if (!lines.length) continue;

      const text = `*Tickerframe Alerts*\n${lines.join("\n")}`;
      try {
        const res = await fetch(user.slack_webhook_url!, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        if (res.ok) {
          if (newKeys.length) {
            await supabase.from("sent_alerts").insert(newKeys.map(alert_key => ({ alert_key })));
          }
          totalSent += lines.length;
        }
      } catch { /* webhook unreachable this run -- retried next cycle since keys weren't marked sent */ }
    }

    await logCronRun(supabase, "portfolio-alerts", true, totalSent, `${activeUsers.length} users checked`);
    return new Response(JSON.stringify({ sent: totalSent }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    await logCronRun(supabase, "portfolio-alerts", false, 0, String(err));
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
