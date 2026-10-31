import { describe, expect, it } from 'vitest';
import { adjustBeta, analyzePortfolio, riskBand, riskScoreFromBeta, whatIfAdd } from '@/lib/capm';
import { computeBeta } from '@/lib/beta';

const RF = 4, ERP = 5;

describe('risk score', () => {
  it('maps beta 0 / 1 / 2+ to 0 / 50 / 100 and clamps', () => {
    expect(riskScoreFromBeta(0)).toBe(0);
    expect(riskScoreFromBeta(1)).toBe(50);
    expect(riskScoreFromBeta(2)).toBe(100);
    expect(riskScoreFromBeta(3.4)).toBe(100);
    expect(riskScoreFromBeta(-0.5)).toBe(0);
  });
  it('describes the band without advising', () => {
    expect(riskBand(20)).toBe('Lower than the market');
    expect(riskBand(50)).toBe('Close to the market');
    expect(riskBand(80)).toBe('Higher than the market');
  });
  it('pulls noisy betas toward 1', () => {
    expect(adjustBeta(1)).toBeCloseTo(1, 5);
    expect(adjustBeta(0)).toBeCloseTo(0.33, 5);
    expect(adjustBeta(2)).toBeCloseTo(1.67, 5);
  });
});

describe('analyzePortfolio', () => {
  const inputs = [
    { symbol: 'AAA', value: 6000, beta: 1.5 },
    { symbol: 'BBB', value: 3000, beta: 0.5 },
    { symbol: 'CCC', value: 1000, beta: 1.0 },
  ];
  const s = analyzePortfolio(inputs, RF, ERP)!;

  it('portfolio beta is the value-weighted average', () => {
    expect(s.beta).toBeCloseTo(0.6 * 1.5 + 0.3 * 0.5 + 0.1 * 1.0, 6); // 1.15
    expect(Math.abs(s.score - 57.5)).toBeLessThanOrEqual(0.5); // 1.15 / 2 = 57.5%
  });
  it('expected return is rf + beta x premium, per holding and overall', () => {
    expect(s.expectedReturn).toBeCloseTo(RF + 1.15 * ERP, 6);
    expect(s.marketReturn).toBe(9);
    const a = s.rows.find((r) => r.symbol === 'AAA')!;
    expect(a.expectedReturn).toBeCloseTo(RF + 1.5 * ERP, 6);
  });
  it('risk shares add up to 100%', () => {
    expect(s.rows.reduce((t, r) => t + (r.riskShare ?? 0), 0)).toBeCloseTo(1, 6);
    expect(s.rows[0].symbol).toBe('AAA'); // largest first
  });
  it('shows what the portfolio would look like without each holding', () => {
    const a = s.rows.find((r) => r.symbol === 'AAA')!;
    expect(a.without!.beta).toBeCloseTo((0.3 * 0.5 + 0.1 * 1.0) / 0.4, 6); // 0.625
    expect(a.without!.score).toBeLessThan(s.score);
  });
  it('leaves out holdings with no beta and says so', () => {
    const r = analyzePortfolio([...inputs, { symbol: 'ZZZ', value: 500, beta: null }], RF, ERP)!;
    expect(r.excluded).toEqual(['ZZZ']);
    expect(r.beta).toBeCloseTo(s.beta, 6);
  });
  it('returns null with nothing to price, and no "without" for a single holding', () => {
    expect(analyzePortfolio([{ symbol: 'X', value: 100, beta: null }], RF, ERP)).toBeNull();
    expect(analyzePortfolio([{ symbol: 'X', value: 100, beta: 1.2 }], RF, ERP)!.rows[0].without).toBeNull();
  });
});

describe('whatIfAdd', () => {
  const inputs = [{ symbol: 'AAA', value: 8000, beta: 1.4 }, { symbol: 'BBB', value: 2000, beta: 1.0 }];
  it('lowers risk when a low-beta fund is added, and raises it for a high-beta one', () => {
    const low = whatIfAdd(inputs, { symbol: 'BND', beta: 0.1, amount: 5000 }, RF, ERP)!;
    expect(low.after.score).toBeLessThan(low.before.score);
    expect(low.after.expectedReturn).toBeLessThan(low.before.expectedReturn);
    const high = whatIfAdd(inputs, { symbol: 'XYZ', beta: 2.2, amount: 5000 }, RF, ERP)!;
    expect(high.after.score).toBeGreaterThan(high.before.score);
    expect(high.candidate.weightAfter).toBeCloseTo(5000 / 15000, 6);
  });
  it('adds to an existing holding instead of duplicating it', () => {
    const r = whatIfAdd(inputs, { symbol: 'aaa', beta: 1.4, amount: 2000 }, RF, ERP)!;
    expect(r.after.rows.filter((x) => x.symbol === 'AAA')).toHaveLength(1);
  });
});

describe('computeBeta', () => {
  const dates = Array.from({ length: 200 }, (_, i) => new Date(Date.UTC(2026, 0, 1) + i * 86400000).toISOString().slice(0, 10));
  const market = new Map<string, number>(); let m = 100;
  dates.forEach((d, i) => { m *= 1 + 0.01 * Math.sin(i * 1.7); market.set(d, m); });
  it('recovers a known beta', () => {
    const stock = new Map<string, number>();
    let p = 50, prev = 100;
    for (const d of dates) { const mk = market.get(d)!; p *= 1 + 1.5 * (mk / prev - 1); prev = mk; stock.set(d, p); }
    const r = computeBeta(stock, market)!;
    expect(r.beta).toBeCloseTo(1.5, 1);
    expect(r.r2).toBeGreaterThan(0.99);
  });
  it('refuses to guess from too little data', () => {
    const short = new Map([...market].slice(0, 30));
    expect(computeBeta(short, short)).toBeNull();
  });
});

import { groupRisk, observations } from '@/lib/capm';

describe('groups and observations', () => {
  const inputs = [
    { symbol: 'T1', value: 4000, beta: 1.6 },
    { symbol: 'T2', value: 3000, beta: 1.4 },
    { symbol: 'U1', value: 3000, beta: 0.4 },
  ];
  const s = analyzePortfolio(inputs, 4, 5)!;
  const groups = groupRisk(s, (sym) => (sym.startsWith('T') ? 'Technology' : 'Utilities'));
  it('rolls up weight and risk share by group', () => {
    expect(groups[0].label).toBe('Technology');
    expect(groups[0].weight).toBeCloseTo(0.7, 6);
    expect(groups[0].riskShare! + groups[1].riskShare!).toBeCloseTo(1, 6);
    expect(groups[0].riskShare!).toBeGreaterThan(groups[0].weight); // higher-beta group carries more risk than its weight
  });
  it('flags concentration in neutral language', () => {
    const o = observations(s, groups).map((x) => x.text).join(' ');
    expect(o).toContain('70% of the portfolio is in Technology');
    expect(o).not.toMatch(/\b(should|consider|buy|sell|reduce)\b/i);
  });
  it('says nothing about a balanced portfolio', () => {
    const bal = analyzePortfolio([{ symbol: 'A', value: 1, beta: 1 }, { symbol: 'B', value: 1, beta: 1 }, { symbol: 'C', value: 1, beta: 1 }, { symbol: 'D', value: 1, beta: 1 }], 4, 5)!;
    expect(observations(bal, groupRisk(bal, (x) => x))).toHaveLength(0);
  });
});
