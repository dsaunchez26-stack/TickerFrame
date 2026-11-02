import { describe, expect, it } from 'vitest';
import { classifyHolding, UNCLASSIFIED, BROAD_FUNDS } from '@/lib/classify';

const fund = (name: string) => ({ name, isFund: true, industry: null });

describe('classifyHolding - funds by name', () => {
  const cases: Array<[string, string, string, string]> = [
    ['SMH', 'VanEck Semiconductor ETF', 'Equity', 'Technology'],
    ['CIBR', 'First Trust Exchange-Traded Fund II First Trust NASDAQ Cybersecurity ETF', 'Equity', 'Technology'],
    ['XBI', 'State Street SPDR S&P Biotech ETF', 'Equity', 'Health Care'],
    ['XLV', 'State Street Health Care Select Sector SPDR ETF', 'Equity', 'Health Care'],
    ['URNM', 'Sprott Uranium Miners ETF', 'Equity', 'Energy'],
    ['NLR', 'VanEck Uranium and Nuclear ETF', 'Equity', 'Energy'],
    ['XLE', 'State Street Energy Select Sector SPDR ETF', 'Equity', 'Energy'],
    ['BSV', 'Vanguard Short-Term Bond ETF', 'Bonds', 'Bonds'],
    ['FBTC', 'Fidelity Wise Origin Bitcoin Fund', 'Crypto', 'Crypto'],
    ['VXUS', 'Vanguard STAR Funds Vanguard Total International Stock ETF', 'Index', BROAD_FUNDS],
    ['VOO', 'Vanguard S&P 500 ETF', 'Index', BROAD_FUNDS],
    ['JEPI', 'JPMorgan Equity Premium Income ETF', 'Index', BROAD_FUNDS],
    ['ARKK', 'ARK Innovation ETF', 'Index', BROAD_FUNDS],
  ];
  for (const [sym, name, cls, sector] of cases) {
    it(`${sym} -> ${cls} / ${sector}`, () => expect(classifyHolding(sym, fund(name))).toEqual({ assetClass: cls, sector }));
  }

  it('recognises a physical gold fund even when the name has no "ETF"', () => {
    expect(classifyHolding('GLDM', { name: 'SPDR Gold MiniShares', isFund: false, industry: null })).toEqual({ assetClass: 'Gold & Silver', sector: 'Gold & silver' });
  });
  it('does not mistake a gold miner for a gold fund', () => {
    expect(classifyHolding('GFI', { name: 'Gold Fields Ltd American Depositary Shares', isFund: false, industry: 'Metals & Mining' })).toEqual({ assetClass: 'Equity', sector: 'Materials' });
  });
});

describe('classifyHolding - stocks and unknowns', () => {
  it('uses the company industry for stocks', () => {
    expect(classifyHolding('CRDO', { name: 'Credo Technology', isFund: false, industry: 'Semiconductors' })).toEqual({ assetClass: 'Equity', sector: 'Technology' });
    expect(classifyHolding('SOFI', { name: 'SoFi', isFund: false, industry: 'Financial Services' }).sector).toBe('Financials');
  });
  it('says "not classified" instead of guessing', () => {
    expect(classifyHolding('ZZZ', null).sector).toBe(UNCLASSIFIED);
    expect(classifyHolding('ZZZ', fund('Some Mystery Fund')).sector).toBe(UNCLASSIFIED);
  });
});
