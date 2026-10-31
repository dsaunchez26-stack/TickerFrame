// Capital Asset Pricing Model, applied to a portfolio of stocks and funds.
//
//   expected return of a holding = risk-free rate + beta x market risk premium
//   portfolio beta               = sum of (weight x beta)
//
// Beta is how much a holding tends to move when the S&P 500 moves (1.0 = moves
// with the market, 2.0 = twice as much, 0 = unrelated). CAPM only prices that
// market-related risk; risk specific to one company is assumed to be diversified
// away. The "risk score" is portfolio beta on a 0-100 scale: 0 = no market
// sensitivity, 50 = moves like the market (beta 1), 100 = twice as sensitive
// as the market (beta 2) or more. All of it is a model estimate under stated
// assumptions - not a forecast and not advice.

export const DEFAULT_ERP_PCT = 5; // long-run equity risk premium assumption, % per year
export const FALLBACK_RF_PCT = 4; // used only when the live Treasury yield can't be loaded

// Betas measured on one year of data are noisy; pulling them toward 1 is the
// standard correction (Blume) used by data vendors for forward-looking use.
export const adjustBeta = (raw: number) => 0.67 * raw + 0.33;

export const riskScoreFromBeta = (beta: number) => Math.min(100, Math.max(0, Math.round((beta / 2) * 100)));
export const riskBand = (score: number) => (score < 35 ? 'Lower than the market' : score <= 65 ? 'Close to the market' : 'Higher than the market');

export interface RiskInput { symbol: string; value: number; beta: number | null }

export interface RiskRow {
  symbol: string;
  value: number;
  weight: number;          // share of the priced portfolio, 0..1
  beta: number;
  expectedReturn: number;  // % per year, CAPM
  betaContribution: number; // weight x beta
  riskShare: number | null; // this holding's share of portfolio beta, 0..1 (null if portfolio beta ~ 0)
  without: { score: number; beta: number; expectedReturn: number } | null; // portfolio if this holding were removed
}

export interface RiskSummary {
  totalValue: number;
  beta: number;
  score: number;
  band: string;
  expectedReturn: number; // % per year
  marketReturn: number;   // rf + erp
  rows: RiskRow[];
  excluded: string[];     // holdings with no beta available
}

const expected = (beta: number, rf: number, erp: number) => rf + beta * erp;

export function analyzePortfolio(inputs: RiskInput[], rfPct: number, erpPct: number): RiskSummary | null {
  const priced = inputs.filter((h): h is RiskInput & { beta: number } => h.beta != null && h.value > 0);
  const excluded = inputs.filter((h) => h.beta == null && h.value > 0).map((h) => h.symbol);
  const total = priced.reduce((s, h) => s + h.value, 0);
  if (!priced.length || total <= 0) return null;

  const beta = priced.reduce((s, h) => s + (h.value / total) * h.beta, 0);
  const rows: RiskRow[] = priced
    .map((h) => {
      const weight = h.value / total;
      let without: RiskRow['without'] = null;
      if (priced.length > 1 && weight < 1) {
        const rest = (beta - weight * h.beta) / (1 - weight);
        without = { beta: rest, score: riskScoreFromBeta(rest), expectedReturn: expected(rest, rfPct, erpPct) };
      }
      return {
        symbol: h.symbol, value: h.value, weight, beta: h.beta,
        expectedReturn: expected(h.beta, rfPct, erpPct),
        betaContribution: weight * h.beta,
        riskShare: Math.abs(beta) > 0.0001 ? (weight * h.beta) / beta : null,
        without,
      };
    })
    .sort((a, b) => b.value - a.value);

  const score = riskScoreFromBeta(beta);
  return { totalValue: total, beta, score, band: riskBand(score), expectedReturn: expected(beta, rfPct, erpPct), marketReturn: rfPct + erpPct, rows, excluded };
}

export interface WhatIf {
  before: RiskSummary;
  after: RiskSummary;
  candidate: { symbol: string; beta: number; amount: number; weightAfter: number; expectedReturn: number };
}

// "If I put this much into X": the portfolio with the amount added, next to today's.
export function whatIfAdd(inputs: RiskInput[], candidate: { symbol: string; beta: number; amount: number }, rfPct: number, erpPct: number): WhatIf | null {
  const before = analyzePortfolio(inputs, rfPct, erpPct);
  if (!before || !(candidate.amount > 0)) return null;
  const sym = candidate.symbol.toUpperCase();
  const merged: RiskInput[] = inputs.some((h) => h.symbol === sym)
    ? inputs.map((h) => (h.symbol === sym ? { ...h, value: h.value + candidate.amount, beta: candidate.beta } : h))
    : [...inputs, { symbol: sym, value: candidate.amount, beta: candidate.beta }];
  const after = analyzePortfolio(merged, rfPct, erpPct);
  if (!after) return null;
  const row = after.rows.find((r) => r.symbol === sym);
  return { before, after, candidate: { symbol: sym, beta: candidate.beta, amount: candidate.amount, weightAfter: row?.weight ?? 0, expectedReturn: expected(candidate.beta, rfPct, erpPct) } };
}

export const UNCLASSIFIED = 'Not classified';

export interface GroupRisk { label: string; weight: number; riskShare: number | null; symbols: string[] }

// Roll holdings up into groups (sectors, fund types): how much of the portfolio each group is
// worth, and how much of its market risk (beta) it accounts for.
export function groupRisk(summary: RiskSummary, labelOf: (symbol: string) => string): GroupRisk[] {
  const groups = new Map<string, { weight: number; contribution: number; symbols: string[] }>();
  for (const r of summary.rows) {
    const key = labelOf(r.symbol);
    const g = groups.get(key) ?? { weight: 0, contribution: 0, symbols: [] };
    g.weight += r.weight; g.contribution += r.betaContribution; g.symbols.push(r.symbol);
    groups.set(key, g);
  }
  return [...groups.entries()]
    .map(([label, g]) => ({ label, weight: g.weight, riskShare: Math.abs(summary.beta) > 0.0001 ? g.contribution / summary.beta : null, symbols: g.symbols }))
    .sort((a, b) => b.weight - a.weight);
}

export interface Observation { key: string; text: string }

// Plain statements about the mix, produced by fixed rules and worded the same for every
// portfolio - descriptions of concentration, never instructions.
export function observations(summary: RiskSummary, groups: GroupRisk[]): Observation[] {
  const out: Observation[] = [];
  if (summary.score > 65) out.push({ key: 'high', text: `This portfolio's market sensitivity (beta ${summary.beta.toFixed(2)}) is higher than the S&P 500's, so in a market decline it has tended to fall by more than the market, and in a rise to gain by more.` });
  else if (summary.score < 35) out.push({ key: 'low', text: `This portfolio's market sensitivity (beta ${summary.beta.toFixed(2)}) is lower than the S&P 500's, so it has tended to move less than the market in both directions.` });
  // Holdings the site can't classify (funds outside its tracked list) are not a sector, so they never count as one.
  const top = groups.find((g) => g.label !== UNCLASSIFIED);
  if (top && top.weight >= 0.4 && top.riskShare != null) out.push({ key: 'group', text: `${Math.round(top.weight * 100)}% of the portfolio is in ${top.label}, and that part accounts for ${Math.round(top.riskShare * 100)}% of its market risk - so ${top.label} moves have an outsized effect.` });
  const big = summary.rows[0];
  if (big && summary.rows.length > 1 && big.weight >= 0.35) out.push({ key: 'single', text: `${big.symbol} alone is ${Math.round(big.weight * 100)}% of the portfolio. Company-specific events, which beta does not capture, have more room to matter when one holding is this large.` });
  return out;
}
