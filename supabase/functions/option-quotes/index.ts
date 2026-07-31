import { corsHeaders } from "../_shared/cors.ts";

interface ContractRequest {
  id: string;
  ticker: string;
  strike: number;
  expiration: string;
  cp: "C" | "P";
}

interface TradierOption {
  strike: number;
  bid: number | null;
  ask: number | null;
  last: number | null;
  option_type: "call" | "put";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const TRADIER_API_KEY = Deno.env.get("TRADIER_API_KEY");
  if (!TRADIER_API_KEY) {
    return new Response(JSON.stringify({ error: "TRADIER_API_KEY is not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const headers = { Authorization: `Bearer ${TRADIER_API_KEY}`, Accept: "application/json" };

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
  // Group requested contracts by (ticker, expiration) so each distinct chain
  // is only fetched once, no matter how many strikes/sides are being priced.
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
      const res = await fetch(
        `https://sandbox.tradier.com/v1/markets/options/chains?symbol=${ticker}&expiration=${expiration}`,
        { headers },
      );
      if (!res.ok) return;
      const chainJson = await res.json();
      const options: TradierOption[] = Array.isArray(chainJson?.options?.option) ? chainJson.options.option : [];
      if (!options.length) return;

      for (const c of group) {
        const match = options.find((o) =>
          Math.abs(o.strike - c.strike) < 0.01 && o.option_type === (c.cp === "C" ? "call" : "put")
        );
        if (!match) continue;
        const price = match.last || ((match.bid ?? 0) + (match.ask ?? 0)) / 2;
        if (price > 0) quotes.push({ id: c.id, price });
      }
    }),
  );

  return new Response(JSON.stringify({ quotes }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
