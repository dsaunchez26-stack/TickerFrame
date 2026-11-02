import { broadSector } from '@/lib/sectorMapping';

// Which asset class and sector a holding belongs to, for tickers the site does not track
// closely. Stocks use the industry tag from the company profile; funds are placed from their
// name (a semiconductor ETF is technology exposure, a bitcoin fund is crypto, and so on).
// Anything that can't be placed says so instead of being filed under a vague "Other".
export const UNCLASSIFIED = 'Not classified';
export const BROAD_FUNDS = 'Broad & international funds';

export interface HoldingClass { assetClass: string; sector: string }
export interface SymbolInfo { name: string | null; isFund: boolean; industry: string | null }

const SECTOR_RULES: Array<[RegExp, string]> = [
  [/semiconductor|software|cyber|cloud|internet|artificial intelligence|robotic|information technology|\btech(nology)?\b|\bai\b|data center/, 'Technology'],
  [/health|biotech|pharma|medical|genom|life science|medicine/, 'Health Care'],
  [/financ|\bbank|insurance|brokerage|fintech/, 'Financials'],
  [/uranium|nuclear|\benergy\b|\boil\b|\bgas\b|solar|clean energy|renewable|petroleum|\bcoal\b|midstream/, 'Energy'],
  [/utilit/, 'Utilities'],
  [/consumer staples|\bfood\b|beverage|household|grocery/, 'Consumer Staples'],
  [/consumer discretionary|retail|travel|leisure|homebuild|automotive|\bgaming\b|e-?commerce|restaurant/, 'Consumer Discretionary'],
  [/industrial|aerospace|defense|transportation|infrastructure|airline|shipping|machinery/, 'Industrials'],
  [/materials|mining|miners|metals|copper|lithium|steel|rare earth|timber/, 'Materials'],
  [/communication|\bmedia\b|telecom|entertainment|social/, 'Communication Services'],
];

const BROAD = /s&p ?500|s&p total|total (stock )?market|total international|international|ex-?u\.?s|emerging|developed|\bworld\b|\beafe\b|\bglobal\b|china|japan|europe|india|pacific|large.?cap|mid.?cap|small.?cap|nasdaq.?100|russell|dow jones|extended market|dividend|\bgrowth\b|\bvalue\b|\bequity\b|quality|momentum|innovation|premium income/;

export function classifyHolding(symbol: string, info: SymbolInfo | null | undefined): HoldingClass {
  const name = (info?.name ?? '').toLowerCase();
  if (!info || (!name && !info.industry)) return { assetClass: 'Equity', sector: UNCLASSIFIED };

  // Individual stocks: the company's own industry tag.
  if (!info.isFund && info.industry) return { assetClass: 'Equity', sector: broadSector(symbol, info.industry) };

  const physicalGold = /minishares|spdr gold|ishares gold|bullion|physical|gold (trust|shares)/.test(name);
  const isFundLike = info.isFund || physicalGold;
  if (!isFundLike) return { assetClass: 'Equity', sector: UNCLASSIFIED };

  if (/bitcoin|ethereum|\bcrypto|digital asset/.test(name)) return { assetClass: 'Crypto', sector: 'Crypto' };
  if (/\b(gold|silver)\b/.test(name) && !/miner|mining/.test(name)) return { assetClass: 'Gold & Silver', sector: 'Gold & silver' };
  if (/bond|treasur|fixed income|aggregate|\bmuni|\btips\b|high.?yield|floating rate|credit|short.?term (govt|government)/.test(name)) return { assetClass: 'Bonds', sector: 'Bonds' };
  if (/real estate|\breit\b|\bproperty\b/.test(name)) return { assetClass: 'Real Estate', sector: 'Real estate' };
  if (/commodit|\bwti\b|crude/.test(name)) return { assetClass: 'Commodities', sector: 'Commodities' };

  for (const [re, sector] of SECTOR_RULES) if (re.test(name)) return { assetClass: 'Equity', sector };
  if (BROAD.test(name)) return { assetClass: 'Index', sector: BROAD_FUNDS };
  return { assetClass: 'Equity', sector: UNCLASSIFIED };
}
