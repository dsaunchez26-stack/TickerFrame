import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { TRACKED_TICKERS } from "../_shared/symbols.ts";
import { logCronRun } from "../_shared/logCronRun.ts";

// Same tracked equity universe as fundamentals-scanner/fetch-stock-data --
// see _shared/symbols.ts. This used to be its own hand-copied ~74-symbol
// list that never got updated when the other three functions grew to 115,
// silently missing insider-activity coverage on every ticker added since.
const SYMBOLS = TRACKED_TICKERS;

// SEC requires a descriptive User-Agent with contact info on every request
// to www.sec.gov / data.sec.gov / efts.sec.gov, or it starts throttling /
// blocking traffic -- this isn't optional the way a browser UA string is.
const SEC_UA = "Tickerframe/1.0 (research tool; contact: support@tickerframe.app)";
const secHeaders = { "User-Agent": SEC_UA, "Accept": "application/json" };

const FORM4_LOOKBACK_DAYS = 30;
const SCHEDULE_LOOKBACK_DAYS = 90;
const MIN_FORM4_VALUE = 50_000; // filter noise at the source; UI can raise the floor further
const MAX_FORM4_PER_TICKER = 15;

function cikNoLeadingZeros(cik10: string) {
  return String(Number(cik10));
}
function accessionNoDashes(accession: string) {
  return accession.replace(/-/g, "");
}
function filingIndexUrl(cik10: string, accession: string) {
  return `https://www.sec.gov/Archives/edgar/data/${cikNoLeadingZeros(cik10)}/${accessionNoDashes(accession)}/${accession}-index.htm`;
}

// Bounded (non-greedy but tag-scoped) extraction so a missing inner <value>
// -- e.g. <transactionPricePerShare><footnoteId .../></transactionPricePerShare>
// for a non-purchase transaction code -- can't accidentally match a <value>
// belonging to a different sibling tag further down the document.
function innerBlock(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return m ? m[1] : null;
}
function nestedValue(xml: string, tag: string): string | null {
  const inner = innerBlock(xml, tag);
  if (inner === null) return null;
  const v = inner.match(/<value>([^<]*)<\/value>/);
  return v ? v[1].trim() : null;
}
function directTag(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
  return m ? m[1].trim() : null;
}

interface Form4Transaction {
  transactionDate: string;
  transactionCode: string;
  shares: number;
  pricePerShare: number;
  sharesOwnedAfter: number | null;
}

function parseForm4(xml: string): { ownerName: string | null; title: string | null; transactions: Form4Transaction[] } {
  const ownerBlock = innerBlock(xml, "reportingOwner") ?? xml;
  const ownerName = directTag(ownerBlock, "rptOwnerName");
  const relationship = innerBlock(ownerBlock, "reportingOwnerRelationship") ?? "";
  const titleParts: string[] = [];
  if (directTag(relationship, "isDirector") === "true") titleParts.push("Director");
  if (directTag(relationship, "isTenPercentOwner") === "true") titleParts.push("10% Owner");
  const officerTitle = directTag(relationship, "officerTitle");
  if (directTag(relationship, "isOfficer") === "true") titleParts.push(officerTitle || "Officer");
  const title = titleParts.length ? titleParts.join(", ") : null;

  const transactions: Form4Transaction[] = [];
  const blocks = xml.matchAll(/<nonDerivativeTransaction>([\s\S]*?)<\/nonDerivativeTransaction>/g);
  for (const m of blocks) {
    const block = m[1];
    const codingBlock = innerBlock(block, "transactionCoding") ?? block;
    const code = directTag(codingBlock, "transactionCode");
    const amountsBlock = innerBlock(block, "transactionAmounts") ?? block;
    const acquiredDisposed = nestedValue(amountsBlock, "transactionAcquiredDisposedCode");
    if (code !== "P" || acquiredDisposed !== "A") continue;

    const shares = Number(nestedValue(amountsBlock, "transactionShares"));
    const price = Number(nestedValue(amountsBlock, "transactionPricePerShare"));
    if (!shares || !price) continue; // footnote-only price (no numeric value) -- can't compute a dollar figure

    const date = nestedValue(block, "transactionDate");
    const ownedAfterStr = nestedValue(block, "sharesOwnedFollowingTransaction");
    transactions.push({
      transactionDate: date ?? "",
      transactionCode: code,
      shares,
      pricePerShare: price,
      sharesOwnedAfter: ownedAfterStr ? Number(ownedAfterStr) : null,
    });
  }
  return { ownerName, title, transactions };
}

async function withConcurrency<T, R>(items: T[], limit: number, pauseMs: number, fn: (item: T) => Promise<R>): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = [];
  for (let i = 0; i < items.length; i += limit) {
    const batch = items.slice(i, i + limit);
    const batchResults = await Promise.allSettled(batch.map(fn));
    results.push(...batchResults);
    if (i + limit < items.length) await new Promise((r) => setTimeout(r, pauseMs));
  }
  return results;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const errors: Array<{ ticker: string; message: string }> = [];

  try {
    // 1. Resolve our tracked tickers to SEC CIKs.
    const tickerRes = await fetch("https://www.sec.gov/files/company_tickers.json", { headers: secHeaders });
    if (!tickerRes.ok) throw new Error(`company_tickers.json failed: ${tickerRes.status}`);
    const tickerJson = await tickerRes.json() as Record<string, { cik_str: number; ticker: string; title: string }>;
    const cikByTicker = new Map<string, string>();
    for (const entry of Object.values(tickerJson)) {
      if (SYMBOLS.includes(entry.ticker)) cikByTicker.set(entry.ticker, String(entry.cik_str).padStart(10, "0"));
    }

    const form4Cutoff = new Date(Date.now() - FORM4_LOOKBACK_DAYS * 86400_000);
    const rows: Record<string, unknown>[] = [];

    // 2. Per-ticker: find recent Form 4 filings, then fetch + parse each one's raw XML.
    const perTicker = SYMBOLS.map((ticker) => ({ ticker, cik: cikByTicker.get(ticker) })).filter((t) => t.cik);
    await withConcurrency(perTicker, 8, 1000, async ({ ticker, cik }) => {
      const cik10 = cik!;
      const subRes = await fetch(`https://data.sec.gov/submissions/CIK${cik10}.json`, { headers: secHeaders });
      if (!subRes.ok) throw new Error(`submissions fetch failed for ${ticker}: ${subRes.status}`);
      const sub = await subRes.json();
      const recent = sub?.filings?.recent;
      if (!recent?.form) return;

      const form4s: Array<{ accessionNumber: string; primaryDocument: string; filingDate: string }> = [];
      for (let i = 0; i < recent.form.length; i++) {
        if (recent.form[i] !== "4") continue;
        if (new Date(recent.filingDate[i]) < form4Cutoff) continue;
        form4s.push({ accessionNumber: recent.accessionNumber[i], primaryDocument: recent.primaryDocument[i], filingDate: recent.filingDate[i] });
        if (form4s.length >= MAX_FORM4_PER_TICKER) break;
      }
      if (!form4s.length) return;

      await withConcurrency(form4s, 5, 600, async (filing) => {
        const basename = filing.primaryDocument.split("/").pop()!;
        const xmlUrl = `https://www.sec.gov/Archives/edgar/data/${cikNoLeadingZeros(cik10)}/${accessionNoDashes(filing.accessionNumber)}/${basename}`;
        const xmlRes = await fetch(xmlUrl, { headers: secHeaders });
        if (!xmlRes.ok) return;
        const xml = await xmlRes.text();
        const parsed = parseForm4(xml);
        parsed.transactions.forEach((tx, idx) => {
          const totalValue = tx.shares * tx.pricePerShare;
          if (totalValue < MIN_FORM4_VALUE) return;
          rows.push({
            id: `${filing.accessionNumber}-${idx}`,
            ticker,
            form_type: "4",
            filer_name: parsed.ownerName ?? "Unknown",
            filer_title: parsed.title,
            transaction_code: tx.transactionCode,
            transaction_date: tx.transactionDate || filing.filingDate,
            shares: tx.shares,
            price_per_share: tx.pricePerShare,
            total_value: totalValue,
            shares_owned_after: tx.sharesOwnedAfter,
            filing_date: filing.filingDate,
            accession_number: filing.accessionNumber,
            filing_url: filingIndexUrl(cik10, filing.accessionNumber),
          });
        });
      });
    }).then((settled) => {
      settled.forEach((r, i) => {
        if (r.status === "rejected") errors.push({ ticker: perTicker[i].ticker, message: r.reason instanceof Error ? r.reason.message : String(r.reason) });
      });
    });

    // 3. Schedule 13D/13G (5%+ holders): one full-text-search call covers every
    // tracked ticker at once (comma-separated CIKs), since there's no per-share
    // price to extract we don't need the per-filing document fetch Form 4 needs.
    const trackedCiks = new Set(cikByTicker.values());
    const cikList = Array.from(trackedCiks).join(",");
    const scheduleCutoff = new Date(Date.now() - SCHEDULE_LOOKBACK_DAYS * 86400_000).toISOString().slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);
    const ftsUrl = `https://efts.sec.gov/LATEST/search-index?q=%22%22&forms=SCHEDULE+13D,SCHEDULE+13G&ciks=${cikList}&dateRange=custom&startdt=${scheduleCutoff}&enddt=${today}`;
    const ftsRes = await fetch(ftsUrl, { headers: secHeaders });
    if (ftsRes.ok) {
      const ftsJson = await ftsRes.json();
      const hits = ftsJson?.hits?.hits ?? [];
      const tickerByCik = new Map(Array.from(cikByTicker.entries()).map(([t, c]) => [c, t]));
      for (const hit of hits) {
        const src = hit._source;
        const subjectCik = (src.ciks?.[0] as string | undefined)?.padStart(10, "0");
        if (!subjectCik || !trackedCiks.has(subjectCik)) continue; // only keep filings ABOUT our tracked tickers, not filed BY one of them
        const ticker = tickerByCik.get(subjectCik);
        if (!ticker) continue;
        const filerName = (src.display_names?.[1] as string | undefined)?.replace(/\s*\(CIK \d+\)\s*$/, "").trim() ?? "Unknown filer";
        rows.push({
          id: `${src.adsh}-0`,
          ticker,
          form_type: src.form,
          filer_name: filerName,
          filer_title: "5%+ Holder",
          transaction_code: null,
          transaction_date: null,
          shares: null,
          price_per_share: null,
          total_value: null,
          shares_owned_after: null,
          filing_date: src.file_date,
          accession_number: src.adsh,
          filing_url: filingIndexUrl(subjectCik, src.adsh),
        });
      }
    } else {
      errors.push({ ticker: "*", message: `full-text search failed: ${ftsRes.status}` });
    }

    // Full-text search can return multiple hits for the same filing (one
    // per indexed document/exhibit within it), which would otherwise submit
    // the same id twice in one upsert batch -- Postgres rejects that
    // ("ON CONFLICT DO UPDATE command cannot affect row a second time").
    const dedupedRows = Array.from(new Map(rows.map((r) => [r.id as string, r])).values());

    if (dedupedRows.length) {
      const { error: upsertError } = await supabase.from("insider_activity").upsert(dedupedRows, { onConflict: "id" });
      if (upsertError) throw upsertError;
    }

    await logCronRun(supabase, "insider-scanner", true, dedupedRows.length, errors.length ? `${errors.length} ticker errors` : null);

    return new Response(JSON.stringify({ scanned: perTicker.length, found: dedupedRows.length, errors }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error
      ? e.message
      : (e && typeof e === "object" ? JSON.stringify(e) : String(e));
    await logCronRun(supabase, "insider-scanner", false, 0, message);
    return new Response(JSON.stringify({ error: message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
