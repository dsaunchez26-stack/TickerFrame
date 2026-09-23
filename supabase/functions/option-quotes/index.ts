import { corsHeaders } from "../_shared/cors.ts";
import { alpacaHeaders, fetchSnapshots, snapshotPrice } from "../_shared/alpaca.ts";

interface ContractRequest {
  id: string;
  ticker: string;
  strike: number;
  expiration: string;
  cp: "C" | "P";
}

// Builds the OCC-style contract symbol Alpaca's snapshot response is keyed
// by, directly from the (ticker, expiration, strike, side) a tracked pick
// already stores -- avoids a second lookup just to find the matching
// contract, since the symbol is fully determined by those four fields.
function occSymbol(c: ContractRequest): string {
  const [y, m, d] = c.expiration.split("-");
  const yymmdd = `${y.slice(2)}${m}${d}`;
  const strike8 = String(Math.round(c.strike * 1000)).padStart(8, "0");
  return `${c.ticker}${yymmdd}${c.cp}${strike8}`;
}

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

  let contracts: ContractRequest[] = [];
  try {
    const body = await req.json();
    contracts = Array.isArray(body?.contracts) ? body.contracts : [];
  } catch {
    // no body
  }

  if (!contracts.length) {
    return new Response(JSON.stringify({ quotes: [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // A tracked pick's "current price" has to be the same option contract's
  // current premium, not the underlying stock's price -- comparing a $0.78
  // option premium against a ~$210 stock price produces a nonsense P/L.
  // Group requested contracts by (ticker, expiration) so each distinct
  // expiration's snapshots are only fetched once, no matter how many
  // strikes/sides are being priced.
  const groups = new Map<string, ContractRequest[]>();
  for (const c of contracts) {
    const key = `${c.ticker}|${c.expiration}`;
    const list = groups.get(key) ?? [];
    list.push(c);
    groups.set(key, list);
  }

  const quotes: Array<{ id: string; price: number }> = [];

  await Promise.allSettled(
    Array.from(groups.entries()).map(async ([key, group]) => {
      const [ticker, expiration] = key.split("|");
      const snapshots = await fetchSnapshots(ticker, expiration, headers).catch(() => new Map());
      for (const c of group) {
        const price = snapshotPrice(snapshots.get(occSymbol(c)));
        if (price !== null && price > 0) quotes.push({ id: c.id, price });
      }
    }),
  );

  return new Response(JSON.stringify({ quotes }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
