export interface CreditSpreadRow {
  id: string;
  ticker: string;
  strategy: 'call_credit_spread' | 'put_credit_spread';
  term: string;
  expiration: string;
  stockPrice: number;
  shortStrike: number;
  longStrike: number;
  width: number;
  shortDelta: number;
  netCredit: number;
  maxLoss: number;
  maxGain: number;
  returnOnRisk: number; // percent, over the life of the contract -- not annualized
  expectedMovePct: number | null;
  withinExpectedMove: boolean | null;
}

export interface DiagonalRow {
  id: string;
  ticker: string;
  strategy: 'poor_mans_covered_call' | 'poor_mans_cash_secured_put';
  stockPrice: number;
  longStrike: number;
  longDelta: number;
  longPrice: number;
  longExpiration: string;
  shortStrike: number;
  shortDelta: number;
  shortPrice: number;
  shortExpiration: string;
  netDebit: number;
  maxLossApprox: number;
  maxGainApprox: number;
  expectedMovePct: number | null;
  withinExpectedMove: boolean | null;
}
