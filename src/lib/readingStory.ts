import type { Stock } from '@/lib/mockData';
import { signalFactors, type SignalFactor } from '@/lib/signalBreakdown';

// Turns the indicator points behind a reading into plain sentences. Pure and
// deterministic -- no model call, so it costs nothing, can't drift from the
// score, and every sentence traces to a number the user can see. It describes
// what the data shows; it never says what to do.

export interface FundamentalsInput {
  balance_sheet_score: number;
  growth_score: number;
  pe_ratio: number | null;
  week52_low: number | null;
  week52_high: number | null;
  dividend_yield: number | null;
  revenue_growth_yoy: number | null;
  net_margin: number | null;
}

export interface ReadingStory {
  tone: 'bullish' | 'bearish' | 'neutral';
  headline: string;
  shortTerm: string[];
  longTerm: string[] | null;
  conflict: string | null;
  flips: string[];
}

const BUY_AT = 5;
const labelFor = (points: number): 'bullish' | 'bearish' | 'neutral' =>
  points >= BUY_AT ? 'bullish' : points <= -BUY_AT ? 'bearish' : 'neutral';
const money = (n: number) => `$${n.toFixed(2)}`;
const strength = (score: number) => (score >= 65 ? 'strong' : score >= 40 ? 'about average' : 'weak');

const total = (factors: SignalFactor[]) => factors.reduce((sum, f) => sum + (f.points ?? 0), 0);

export function buildReadingStory(s: Stock, f?: FundamentalsInput | null): ReadingStory | null {
  if (s.signalScore == null) return null;
  const factors = signalFactors(s);
  const pts = (key: string) => factors.find((x) => x.key === key)?.points ?? 0;
  const points = total(factors);
  const tone = labelFor(points);

  const trendUp = pts('trend') > 0;
  const trendDown = pts('trend') < 0;
  const momUp = (s.macdHistogram ?? 0) > 0;
  const momDown = (s.macdHistogram ?? 0) < 0;
  const hot = s.rsi >= 70;
  const cold = s.rsi <= 30;

  // ---- headline ----
  let headline: string;
  if (tone === 'bullish') {
    headline = hot
      ? `${s.symbol} is trending up with momentum behind it, though it has risen fast.`
      : `${s.symbol} is trending up and momentum is behind it.`;
  } else if (tone === 'bearish') {
    headline = cold
      ? `${s.symbol} is trending down with momentum behind it, though it has already fallen a lot.`
      : `${s.symbol} is trending down and momentum is behind it.`;
  } else if (trendUp && hot) {
    headline = `${s.symbol} has been rising, but it has risen fast and looks stretched, which holds the reading at Neutral.`;
  } else if (trendDown && cold) {
    headline = `${s.symbol} has been falling, but it has dropped fast and looks stretched, which holds the reading at Neutral.`;
  } else if (trendUp && momDown) {
    headline = `${s.symbol} is still above its recent average, but its momentum is fading.`;
  } else if (trendDown && momUp) {
    headline = `${s.symbol} is below its recent average, but its momentum is turning up.`;
  } else if (trendUp || trendDown) {
    headline = `${s.symbol} leans ${trendUp ? 'up' : 'down'} in the short term, but not strongly enough for a clear reading.`;
  } else {
    headline = `${s.symbol} shows no clear short-term direction right now.`;
  }

  // ---- short-term (price action) ----
  const shortTerm: string[] = [];
  const gap = s.sma20 > 0 ? ((s.price / s.sma20 - 1) * 100) : 0;
  if (trendUp) shortTerm.push(`The price (${money(s.price)}) is ${Math.abs(gap).toFixed(1)}% above its recent average (${money(s.sma20)}), so the short-term trend is up.`);
  else if (trendDown) shortTerm.push(`The price (${money(s.price)}) is ${Math.abs(gap).toFixed(1)}% below its recent average (${money(s.sma20)}), so the short-term trend is down.`);
  else shortTerm.push(`The price is right at its recent average (${money(s.sma20)}), so there's no trend either way.`);

  if (pts('ema') > 0) shortTerm.push('The very latest prices are running above the slightly older ones, which means the move is recent and still going.');
  else if (pts('ema') < 0) shortTerm.push('The very latest prices are running below the slightly older ones, which means the weakness is recent.');

  if (momUp) shortTerm.push('Momentum is positive: price moves have been getting stronger lately.');
  else if (momDown) shortTerm.push('Momentum is negative: price moves have been getting weaker lately.');

  if (hot) shortTerm.push(`RSI is ${s.rsi.toFixed(0)}, in the "overbought" zone - the price has climbed quickly, and that is a spot where traders watch for a pause. It takes points off the score.`);
  else if (cold) shortTerm.push(`RSI is ${s.rsi.toFixed(0)}, in the "oversold" zone - the price has dropped quickly, and that is a spot where traders watch for a bounce. It adds points to the score.`);
  else shortTerm.push(`RSI is ${s.rsi.toFixed(0)}, in the normal range, so the move isn't unusually stretched.`);

  const b = s.bollingerPctB;
  if (b != null && b >= 0.95) shortTerm.push('The price is pressed against the top of its recent trading range.');
  else if (b != null && b <= 0.05) shortTerm.push('The price is pressed against the bottom of its recent trading range.');

  // ---- long-term (company financials) ----
  let longTerm: string[] | null = null;
  let conflict: string | null = null;
  if (f) {
    longTerm = [
      `Financial health is ${strength(f.balance_sheet_score)} (${f.balance_sheet_score}/100) compared with similar companies, based on debt, cash on hand and profit margin.`,
      `Growth is ${strength(f.growth_score)} (${f.growth_score}/100) compared with similar companies, based on sales and earnings growth.`,
    ];
    if (f.week52_low != null && f.week52_high != null && f.week52_high > f.week52_low) {
      const pos = Math.round(((s.price - f.week52_low) / (f.week52_high - f.week52_low)) * 100);
      const clamped = Math.min(100, Math.max(0, pos));
      longTerm.push(`Over the past year it has traded between ${money(f.week52_low)} and ${money(f.week52_high)}; today it sits ${clamped}% of the way up that range.`);
    }
    if (f.pe_ratio != null && f.pe_ratio > 0) longTerm.push(`It trades at ${f.pe_ratio.toFixed(1)} times its yearly earnings (P/E).`);
    if (f.dividend_yield != null && f.dividend_yield > 0) longTerm.push(`It pays a dividend yielding ${f.dividend_yield.toFixed(2)}% a year.`);

    const solid = f.balance_sheet_score >= 65 && f.growth_score >= 40;
    const shaky = f.balance_sheet_score < 40 || f.growth_score < 40;
    if (tone === 'bearish' && solid) {
      conflict = 'Recent price action is weak, but the company\'s financials are healthy. These measure different things: the reading above looks only at recent price movement, not at how the business is doing over the long run.';
    } else if (tone === 'bullish' && shaky) {
      conflict = 'Recent price action is strong, but the company\'s financials are on the weaker side. The reading above looks only at recent price movement, so a rising price here is not a sign the business itself is strong.';
    }
  }

  // ---- what would change it ----
  const flips: string[] = [];
  const reading = (key: string, newPoints: number) => labelFor(points - pts(key) + newPoints);
  const add = (key: string, newPoints: number, cond: string) => {
    const was = pts(key);
    if (was === newPoints) return;
    const next = reading(key, newPoints);
    if (next !== tone) flips.push(`If ${cond}, the reading would turn ${next === 'neutral' ? 'Neutral' : next === 'bullish' ? 'Bullish' : 'Bearish'}.`);
  };
  if (trendUp) add('trend', -2, `the price falls below its recent average (${money(s.sma20)})`);
  if (trendDown) add('trend', 2, `the price rises above its recent average (${money(s.sma20)})`);
  if (pts('ema') > 0) add('ema', -1, 'the latest prices slip below the older ones');
  if (pts('ema') < 0) add('ema', 1, 'the latest prices climb above the older ones');
  if (momUp) add('macd', -2, 'momentum turns negative');
  if (momDown) add('macd', 2, 'momentum turns positive');
  if (hot || cold) add('rsi', 0, 'RSI moves back into its normal 30-70 range');
  if (b != null && (b >= 0.95 || b <= 0.05)) add('bb', 0, 'the price moves back inside its recent trading range');

  return { tone, headline, shortTerm, longTerm, conflict, flips: flips.slice(0, 3) };
}
