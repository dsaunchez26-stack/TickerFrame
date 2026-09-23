// VIX itself isn't a tradable equity, so it isn't available from Alpaca's
// stock data API (confirmed: a direct quote request for "VIX" returns "no
// trade found"). FRED (the Federal Reserve's public data service) publishes
// the real CBOE VIX close as series VIXCLS, free, with no API key, via a
// plain CSV export -- this is the actual VIX index level, not a volatility
// ETF price standing in for it (an ETF like VIXY trades on an unrelated
// price scale and would be misleading to relabel as "VIX"). The tradeoff:
// FRED's value is the most recent daily CLOSE, typically one business day
// behind, not an intraday tick -- disclosed via `asOf` rather than shown as
// live.
export async function fetchVix(): Promise<{ vix: number; asOf: string } | null> {
  try {
    const res = await fetch("https://fred.stlouisfed.org/graph/fredgraph.csv?id=VIXCLS");
    if (!res.ok) return null;
    const text = await res.text();
    const lines = text.trim().split("\n");
    for (let i = lines.length - 1; i >= 1; i--) {
      const [date, value] = lines[i].split(",");
      const vix = Number(value);
      if (date && Number.isFinite(vix)) return { vix, asOf: date };
    }
    return null;
  } catch {
    return null;
  }
}

export interface RegimeResult {
  label: string;
  trend: "risk-on" | "risk-off" | "neutral";
  vix: number | null;
  vixAsOf: string | null;
  spyChangePct: number | null;
  qqqChangePct: number | null;
  description: string;
}

// A simple, fully disclosed rule, not a prediction or a model: broad risk-off
// needs either an elevated VIX (>= 20, the commonly cited "elevated
// volatility" threshold) or a real down day across both index ETFs; broad
// risk-on needs a genuinely calm VIX (< 15) plus both ETFs actually up.
// Everything else is neutral. Same spirit as the two-indicator buy/sell
// signal documented on the Methodology page -- a transparent rule anyone can
// verify against the real numbers shown, not a black-box score.
export function classifyRegime(vix: number | null, spyChangePct: number | null, qqqChangePct: number | null): RegimeResult {
  const avgChange = spyChangePct !== null && qqqChangePct !== null ? (spyChangePct + qqqChangePct) / 2 : spyChangePct ?? qqqChangePct;
  let trend: RegimeResult["trend"] = "neutral";
  if ((vix !== null && vix >= 20) || (avgChange !== null && avgChange <= -0.75)) {
    trend = "risk-off";
  } else if (vix !== null && vix < 15 && avgChange !== null && avgChange > 0.25) {
    trend = "risk-on";
  }
  const label = trend === "risk-off" ? "Risk-Off" : trend === "risk-on" ? "Risk-On" : "Neutral";
  const parts: string[] = [];
  if (spyChangePct !== null) parts.push(`SPY ${spyChangePct >= 0 ? "+" : ""}${spyChangePct.toFixed(1)}%`);
  if (qqqChangePct !== null) parts.push(`QQQ ${qqqChangePct >= 0 ? "+" : ""}${qqqChangePct.toFixed(1)}%`);
  return {
    label, trend, vix: vix !== null ? +vix.toFixed(1) : null, vixAsOf: null,
    spyChangePct: spyChangePct !== null ? +spyChangePct.toFixed(2) : null,
    qqqChangePct: qqqChangePct !== null ? +qqqChangePct.toFixed(2) : null,
    description: parts.join(", "),
  };
}
