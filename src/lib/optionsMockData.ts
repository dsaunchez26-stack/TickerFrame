// Mock options data generator. Replace with Tradier API calls when token is ready.
export type CallPut = 'C' | 'P';
export type PrintType = 'SWEEP' | 'BLOCK' | 'SPLIT';

export interface OptionRow {
  id: string;
  score: number;
  ticker: string;
  cp: CallPut;
  stockPrice: number;
  sector: string;
  type: string;
  strike: number;
  expiration: string;
  price: number;
  bid: number;
  ask: number;
  delta: number;
  gamma: number;
  gpRatio: number;
  ivRank: number;
  ivRegime?: 'cheap' | 'neutral' | 'expensive';
  ivRankIsReal?: boolean;
  ivPct?: number;
  // Current IV / the underlying's realized volatility -- > 1 means the
  // options market is pricing in more movement than the stock has actually
  // been making (premium rich relative to real behavior), < 1 the reverse.
  // Null when there isn't yet a realized-vol estimate for this ticker.
  ivRvRatio?: number | null;
  volume: number;
  oi: number;
  voi: number;
  dollarFlow: number;
  printType: PrintType;
  aggression?: 'ABOVE_ASK' | 'ASK_SIDE' | 'MID' | 'BID_SIDE' | 'BELOW_BID';
  breakeven?: number;
  breakevenMovePct?: number | null;
  expectedMovePct?: number | null;
  oneDayExpectedMovePct?: number | null;
  beVsExpectedMove?: number | null;
  withinExpectedMove?: boolean | null;
  earningsInDays: number | null;
  earningsBeforeExpiry?: boolean;
  squeeze: number;
  pattern?: string | null;
  patternConfidence?: number;
  contributions?: Array<{ name: string; contrib: number }>;
}

const TICKERS = [
  { t: 'NVDA', s: 'Tech', p: 142.30 },
  { t: 'AAPL', s: 'Tech', p: 232.10 },
  { t: 'TSLA', s: 'Auto', p: 358.40 },
  { t: 'AMD', s: 'Tech', p: 128.55 },
  { t: 'META', s: 'Tech', p: 612.20 },
  { t: 'MSFT', s: 'Tech', p: 442.80 },
  { t: 'GOOGL', s: 'Tech', p: 198.45 },
  { t: 'AMZN', s: 'Consumer', p: 218.30 },
  { t: 'SPY', s: 'ETF', p: 612.40 },
  { t: 'QQQ', s: 'ETF', p: 528.10 },
  { t: 'COIN', s: 'Crypto', p: 285.60 },
  { t: 'MSTR', s: 'Crypto', p: 412.20 },
  { t: 'PLTR', s: 'Tech', p: 78.40 },
  { t: 'AVGO', s: 'Tech', p: 184.50 },
  { t: 'NFLX', s: 'Media', p: 882.10 },
  { t: 'JPM', s: 'Finance', p: 248.60 },
  { t: 'XOM', s: 'Energy', p: 118.20 },
  { t: 'BA', s: 'Industrial', p: 178.90 },
];

const PRINTS: PrintType[] = ['SWEEP', 'BLOCK', 'SPLIT'];

function rand(seed: number) {
  let x = seed;
  return () => {
    x = (x * 9301 + 49297) % 233280;
    return x / 233280;
  };
}

export function generateScannerRows(seed = 7): OptionRow[] {
  const rng = rand(seed);
  const rows: OptionRow[] = [];
  for (let i = 0; i < 80; i++) {
    const t = TICKERS[Math.floor(rng() * TICKERS.length)];
    const isCall = rng() > 0.45;
    const dte = Math.floor(rng() * 60) + 2;
    const exp = new Date();
    exp.setDate(exp.getDate() + dte);
    const strike = Math.round(t.p * (isCall ? 1 + rng() * 0.15 : 1 - rng() * 0.15));
    const delta = (isCall ? 1 : -1) * (0.18 + rng() * 0.47);
    const gamma = 0.005 + rng() * 0.05;
    const price = Math.max(0.05, Math.abs(t.p - strike) * 0.05 + rng() * 4);
    const volume = Math.floor(50 + rng() * 18000);
    const oi = Math.floor(50 + rng() * 25000);
    const voi = +(volume / Math.max(oi, 1)).toFixed(2);
    const dollarFlow = Math.floor(volume * price * 100);
    const ivRank = Math.floor(rng() * 100);
    const squeeze = Math.floor(rng() * 100);

    const liquidity = Math.min(25, Math.log10(volume + 1) * 6);
    const flowScore = Math.min(30, voi * 8 + Math.log10(dollarFlow + 1) * 1.5);
    const gpd = (gamma * 1000) / Math.max(price, 0.5);
    const gammaScore = Math.min(25, gpd * 3);
    const ivScore = Math.max(0, 10 - ivRank / 10);
    const earnings = rng() > 0.7 ? Math.floor(rng() * 35) : null;
    const catalyst = (earnings !== null && earnings < 14 ? 6 : 0) + (squeeze > 70 ? 4 : 0);
    const score = Math.min(100, Math.round(liquidity + flowScore + gammaScore + ivScore + catalyst));

    rows.push({
      id: `${t.t}-${i}`,
      score,
      ticker: t.t,
      cp: isCall ? 'C' : 'P',
      stockPrice: t.p,
      sector: t.s,
      type: dte > 365 ? 'LEAPS' : dte < 8 ? 'Weekly' : 'Monthly',
      strike,
      expiration: exp.toISOString().slice(0, 10),
      price: +price.toFixed(2),
      bid: +Math.max(0, price - 0.05).toFixed(2),
      ask: +(price + 0.05).toFixed(2),
      delta: +delta.toFixed(3),
      gamma: +gamma.toFixed(4),
      gpRatio: +(gamma / Math.max(price, 0.5) * 100).toFixed(2),
      ivRank,
      volume,
      oi,
      voi,
      dollarFlow,
      printType: PRINTS[Math.floor(rng() * PRINTS.length)],
      earningsInDays: earnings,
      squeeze,
    });
  }
  return rows;
}

export interface FlowPrint {
  id: string;
  ticker: string;
  contract: string;
  contracts: number;
  dollarValue: number;
  bullish: boolean;
  time: string;
}

export function generateFlow(seed = 13): FlowPrint[] {
  const rng = rand(seed);
  const out: FlowPrint[] = [];
  for (let i = 0; i < 40; i++) {
    const t = TICKERS[Math.floor(rng() * TICKERS.length)];
    const isCall = rng() > 0.4;
    const strike = Math.round(t.p * (0.9 + rng() * 0.2));
    const dte = Math.floor(rng() * 40) + 2;
    const exp = new Date();
    exp.setDate(exp.getDate() + dte);
    const contracts = Math.floor(100 + rng() * 8000);
    const price = +(0.5 + rng() * 8).toFixed(2);
    const time = new Date(Date.now() - i * 90_000).toLocaleTimeString();
    out.push({
      id: `${t.t}-${i}-flow`,
      ticker: t.t,
      contract: `${t.t} ${exp.toISOString().slice(2, 10).replace(/-/g, '')} ${isCall ? 'C' : 'P'}${strike}`,
      contracts,
      dollarValue: contracts * price * 100,
      bullish: isCall,
      time,
    });
  }
  return out;
}

export interface WeekendGap {
  ticker: string;
  direction: 'up' | 'down';
  gapPct: number;
  continuationRate: number;
  avgGapSize: number;
}

export function generateGaps(seed = 19): WeekendGap[] {
  const rng = rand(seed);
  return TICKERS.slice(0, 8).map(t => ({
    ticker: t.t,
    direction: rng() > 0.5 ? 'up' : 'down',
    gapPct: +(rng() * 4 + 0.3).toFixed(2),
    continuationRate: Math.floor(rng() * 60 + 30),
    avgGapSize: +(rng() * 2 + 0.5).toFixed(2),
  }));
}

export interface AnalystChange {
  ticker: string;
  firm: string;
  oldTarget: number;
  newTarget: number;
  pctChange: number;
  action: string;
  date: string;
}

export function generateAnalysts(seed = 23): AnalystChange[] {
  const rng = rand(seed);
  const firms = ['Goldman Sachs', 'Morgan Stanley', 'JPMorgan', 'Wedbush', 'BofA', 'Wells Fargo', 'Barclays', 'Citi'];
  const actions = ['Raised', 'Lowered', 'Maintained', 'Initiated'];
  return Array.from({ length: 14 }, (_, i) => {
    const t = TICKERS[Math.floor(rng() * TICKERS.length)];
    const oldT = Math.round(t.p * (0.9 + rng() * 0.2));
    const newT = Math.round(oldT * (0.85 + rng() * 0.35));
    const d = new Date();
    d.setDate(d.getDate() - Math.floor(rng() * 10));
    return {
      ticker: t.t,
      firm: firms[Math.floor(rng() * firms.length)],
      oldTarget: oldT,
      newTarget: newT,
      pctChange: +(((newT - oldT) / oldT) * 100).toFixed(1),
      action: actions[Math.floor(rng() * actions.length)],
      date: d.toISOString().slice(0, 10),
    };
  });
}

export const TICKER_LIST = TICKERS;

export interface MacroEvent { date: string; name: string; kind: 'FOMC' | 'CPI' | 'PPI' | 'NFP' | 'PCE' | 'GDP'; }
export const MACRO_EVENTS_2026: MacroEvent[] = [
  { date: '2026-01-13', name: 'CPI Release', kind: 'CPI' },
  { date: '2026-01-14', name: 'PPI Release', kind: 'PPI' },
  { date: '2026-01-28', name: 'FOMC Decision', kind: 'FOMC' },
  { date: '2026-01-30', name: 'PCE Release', kind: 'PCE' },
  { date: '2026-02-06', name: 'Nonfarm Payrolls', kind: 'NFP' },
  { date: '2026-02-11', name: 'CPI Release', kind: 'CPI' },
  { date: '2026-02-12', name: 'PPI Release', kind: 'PPI' },
  { date: '2026-02-27', name: 'PCE Release', kind: 'PCE' },
  { date: '2026-03-06', name: 'Nonfarm Payrolls', kind: 'NFP' },
  { date: '2026-03-11', name: 'CPI Release', kind: 'CPI' },
  { date: '2026-03-12', name: 'PPI Release', kind: 'PPI' },
  { date: '2026-03-18', name: 'FOMC Decision', kind: 'FOMC' },
  { date: '2026-03-26', name: 'GDP (Q4 final)', kind: 'GDP' },
  { date: '2026-03-27', name: 'PCE Release', kind: 'PCE' },
  { date: '2026-04-03', name: 'Nonfarm Payrolls', kind: 'NFP' },
  { date: '2026-04-14', name: 'CPI Release', kind: 'CPI' },
  { date: '2026-04-15', name: 'PPI Release', kind: 'PPI' },
  { date: '2026-04-29', name: 'FOMC Decision', kind: 'FOMC' },
  { date: '2026-04-30', name: 'GDP (Q1 advance)', kind: 'GDP' },
  { date: '2026-05-01', name: 'PCE Release', kind: 'PCE' },
  { date: '2026-05-08', name: 'Nonfarm Payrolls', kind: 'NFP' },
  { date: '2026-05-13', name: 'CPI Release', kind: 'CPI' },
  { date: '2026-05-14', name: 'PPI Release', kind: 'PPI' },
  { date: '2026-05-29', name: 'PCE Release', kind: 'PCE' },
  { date: '2026-06-05', name: 'Nonfarm Payrolls', kind: 'NFP' },
  { date: '2026-06-10', name: 'CPI Release', kind: 'CPI' },
  { date: '2026-06-11', name: 'PPI Release', kind: 'PPI' },
  { date: '2026-06-17', name: 'FOMC Decision', kind: 'FOMC' },
  { date: '2026-06-26', name: 'PCE Release', kind: 'PCE' },
  { date: '2026-07-02', name: 'Nonfarm Payrolls', kind: 'NFP' },
  { date: '2026-07-15', name: 'CPI Release', kind: 'CPI' },
  { date: '2026-07-16', name: 'PPI Release', kind: 'PPI' },
  { date: '2026-07-29', name: 'FOMC Decision', kind: 'FOMC' },
  { date: '2026-07-31', name: 'PCE Release', kind: 'PCE' },
  { date: '2026-08-07', name: 'Nonfarm Payrolls', kind: 'NFP' },
  { date: '2026-08-12', name: 'CPI Release', kind: 'CPI' },
  { date: '2026-08-13', name: 'PPI Release', kind: 'PPI' },
  { date: '2026-08-28', name: 'PCE Release', kind: 'PCE' },
  { date: '2026-09-04', name: 'Nonfarm Payrolls', kind: 'NFP' },
  { date: '2026-09-10', name: 'CPI Release', kind: 'CPI' },
  { date: '2026-09-11', name: 'PPI Release', kind: 'PPI' },
  { date: '2026-09-16', name: 'FOMC Decision', kind: 'FOMC' },
  { date: '2026-09-25', name: 'PCE Release', kind: 'PCE' },
  { date: '2026-10-02', name: 'Nonfarm Payrolls', kind: 'NFP' },
  { date: '2026-10-14', name: 'CPI Release', kind: 'CPI' },
  { date: '2026-10-15', name: 'PPI Release', kind: 'PPI' },
  { date: '2026-10-28', name: 'FOMC Decision', kind: 'FOMC' },
  { date: '2026-10-30', name: 'PCE Release', kind: 'PCE' },
  { date: '2026-11-06', name: 'Nonfarm Payrolls', kind: 'NFP' },
  { date: '2026-11-12', name: 'CPI Release', kind: 'CPI' },
  { date: '2026-11-13', name: 'PPI Release', kind: 'PPI' },
  { date: '2026-11-25', name: 'PCE Release', kind: 'PCE' },
  { date: '2026-12-04', name: 'Nonfarm Payrolls', kind: 'NFP' },
  { date: '2026-12-09', name: 'FOMC Decision', kind: 'FOMC' },
  { date: '2026-12-10', name: 'CPI Release', kind: 'CPI' },
  { date: '2026-12-11', name: 'PPI Release', kind: 'PPI' },
  { date: '2026-12-23', name: 'PCE Release', kind: 'PCE' },
];
