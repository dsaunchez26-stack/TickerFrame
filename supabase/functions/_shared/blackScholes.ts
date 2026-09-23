// Self-computed option greeks and implied volatility. Alpaca's free/indicative
// options feed (see _shared/alpaca.ts) gives real bid/ask/last/volume but no
// greeks and no IV -- those aren't raw market facts the way open interest is,
// they're a deterministic function of price/strike/spot/time, so computing
// them here from real inputs produces the same numbers any vendor's "greeks"
// field would, rather than approximating or guessing anything.

// No live risk-free-rate feed on this site -- a fixed short-term-T-bill-ish
// rate is a standard, small-impact simplification for retail options math
// (a +/-1% error here moves computed IV by a fraction of a point).
export const RISK_FREE_RATE = 0.045;

// Abramowitz & Stegun 7.1.26 rational approximation, max error ~1.5e-7 --
// plenty precise for option greeks (no native erf/normCdf in the Deno std lib).
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const t = 1 / (1 + p * ax);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax);
  return sign * y;
}

function normCdf(x: number): number {
  return 0.5 * (1 + erf(x / Math.SQRT2));
}

function normPdf(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

interface BsInputs {
  spot: number;
  strike: number;
  timeYears: number;
  vol: number;
  rate?: number;
}

function d1d2({ spot, strike, timeYears, vol, rate = RISK_FREE_RATE }: BsInputs): { d1: number; d2: number } {
  const sqrtT = Math.sqrt(timeYears);
  const d1 = (Math.log(spot / strike) + (rate + (vol * vol) / 2) * timeYears) / (vol * sqrtT);
  return { d1, d2: d1 - vol * sqrtT };
}

export function bsPrice(cp: "C" | "P", inputs: BsInputs): number {
  const { spot, strike, timeYears, rate = RISK_FREE_RATE } = inputs;
  if (timeYears <= 0 || inputs.vol <= 0) {
    return cp === "C" ? Math.max(0, spot - strike) : Math.max(0, strike - spot);
  }
  const { d1, d2 } = d1d2(inputs);
  const discountedStrike = strike * Math.exp(-rate * timeYears);
  return cp === "C"
    ? spot * normCdf(d1) - discountedStrike * normCdf(d2)
    : discountedStrike * normCdf(-d2) - spot * normCdf(-d1);
}

export function bsDelta(cp: "C" | "P", inputs: BsInputs): number {
  if (inputs.timeYears <= 0 || inputs.vol <= 0) {
    const itm = cp === "C" ? inputs.spot > inputs.strike : inputs.spot < inputs.strike;
    return cp === "C" ? (itm ? 1 : 0) : (itm ? -1 : 0);
  }
  const { d1 } = d1d2(inputs);
  return cp === "C" ? normCdf(d1) : normCdf(d1) - 1;
}

export function bsGamma(inputs: BsInputs): number {
  if (inputs.timeYears <= 0 || inputs.vol <= 0) return 0;
  const { d1 } = d1d2(inputs);
  return normPdf(d1) / (inputs.spot * inputs.vol * Math.sqrt(inputs.timeYears));
}

// Solves for the volatility that reprices this contract to its real observed
// market price -- bisection rather than Newton-Raphson: no derivative
// needed, and it can't diverge or overshoot on the near-zero-vega contracts
// (deep ITM/OTM, very short-dated) where Newton-Raphson is notoriously
// unstable. 60 iterations over [0.01, 5.0] narrows the bracket to about
// 1e-17 of its original width, far past the precision this data supports.
export function impliedVol(cp: "C" | "P", marketPrice: number, spot: number, strike: number, timeYears: number, rate = RISK_FREE_RATE): number | null {
  if (marketPrice <= 0 || spot <= 0 || strike <= 0 || timeYears <= 0) return null;
  const intrinsic = cp === "C" ? Math.max(0, spot - strike) : Math.max(0, strike - spot);
  // A quoted price at or below intrinsic value has no time value left to
  // solve a volatility from -- a real option can never trade below
  // intrinsic, so this is a stale/bad quote, not a genuine near-zero-IV
  // contract.
  if (marketPrice <= intrinsic) return null;

  let lo = 0.01, hi = 5.0;
  const priceAt = (vol: number) => bsPrice(cp, { spot, strike, timeYears, vol, rate });
  if (priceAt(lo) > marketPrice) return null;
  if (priceAt(hi) < marketPrice) return null;

  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (priceAt(mid) < marketPrice) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

// Convenience: given a real market price, returns IV plus the delta/gamma
// consistent with that same solved IV -- the three numbers always agree
// with each other because they all come from one Black-Scholes evaluation,
// unlike stitching together IV from one source and greeks from another.
export function greeksFromPrice(cp: "C" | "P", marketPrice: number, spot: number, strike: number, timeYears: number): { iv: number | null; delta: number; gamma: number } {
  const iv = impliedVol(cp, marketPrice, spot, strike, timeYears);
  if (iv === null) {
    // No solvable IV (bad/stale quote) -- fall back to a deep ITM/OTM-style
    // delta from intrinsic value alone rather than a fabricated greek.
    const itm = cp === "C" ? spot > strike : spot < strike;
    return { iv: null, delta: cp === "C" ? (itm ? 1 : 0) : (itm ? -1 : 0), gamma: 0 };
  }
  return {
    iv,
    delta: bsDelta(cp, { spot, strike, timeYears, vol: iv }),
    gamma: bsGamma({ spot, strike, timeYears, vol: iv }),
  };
}
