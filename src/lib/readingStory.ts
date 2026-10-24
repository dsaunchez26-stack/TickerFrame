import type { Stock } from '@/lib/mockData';
import { BULLISH_AT, pillarPoints, totalPoints } from '@/lib/signalBreakdown';
import type { LongTermContext } from '@/lib/longTerm';

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
  pastYear: string[] | null;
  longTerm: string[] | null;
  conflict: string | null;
  flips: string[];
}

const labelFor = (points: number): 'bullish' | 'bearish' | 'neutral' =>
  points >= BULLISH_AT ? 'bullish' : points <= -BULLISH_AT ? 'bearish' : 'neutral';
const money = (n: number) => `$${n.toFixed(2)}`;
const strength = (score: number) => (score >= 65 ? 'strong' : score >= 40 ? 'about average' : 'weak');

export function buildReadingStory(s: Stock, f?: FundamentalsInput | null, lt?: LongTermContext | null): ReadingStory | null {
  if (s.signalScore == null) return null;
  const pil = pillarPoints(s);
  const points = totalPoints(s);
  const tone = labelFor(points);

  const trendUp = pil.trend > 0;
  const trendDown = pil.trend < 0;
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
  if (s.price > s.sma20) shortTerm.push(`The price (${money(s.price)}) is ${Math.abs(gap).toFixed(1)}% above its recent average (${money(s.sma20)}).`);
  else if (s.price < s.sma20) shortTerm.push(`The price (${money(s.price)}) is ${Math.abs(gap).toFixed(1)}% below its recent average (${money(s.sma20)}).`);
  else shortTerm.push(`The price is right at its recent average (${money(s.sma20)}).`);

  if (s.ema9 > s.sma20) shortTerm.push(s.price > s.sma20 ? 'The very latest prices are running above the slightly older ones, so the move is recent and still going.' : 'The very latest prices are running above the slightly older ones, a first sign of a turn upward.');
  else if (s.ema9 < s.sma20) shortTerm.push(s.price < s.sma20 ? 'The very latest prices are running below the slightly older ones, so the weakness is recent.' : 'The very latest prices are running below the slightly older ones, a first sign of a turn downward.');

  if (momUp) shortTerm.push('Momentum is positive: price moves have been getting stronger lately.');
  else if (momDown) shortTerm.push('Momentum is negative: price moves have been getting weaker lately.');

  if (hot) shortTerm.push(`RSI is ${s.rsi.toFixed(0)}, in the "overbought" zone - the price has climbed quickly, and that is a spot where traders watch for a pause. It takes points off the score.`);
  else if (cold) shortTerm.push(`RSI is ${s.rsi.toFixed(0)}, in the "oversold" zone - the price has dropped quickly, and that is a spot where traders watch for a bounce. It adds points to the score.`);
  else shortTerm.push(`RSI is ${s.rsi.toFixed(0)}, in the normal range, so the move isn't unusually stretched.`);

  const b = s.bollingerPctB;
  if (b != null && b >= 0.95) shortTerm.push('The price is pressed against the top of its recent trading range.');
  else if (b != null && b <= 0.05) shortTerm.push('The price is pressed against the bottom of its recent trading range.');

  // ---- past year (price context, not part of the reading) ----
  let pastYear: string[] | null = null;
  if (lt) {
    pastYear = [];
    const sgn = (n: number) => `${n >= 0 ? 'up' : 'down'} ${Math.abs(n).toFixed(1)}%`;
    if (lt.return12m != null) {
      const vsMarket = lt.marketReturn12m != null ? `, compared with ${lt.marketReturn12m >= 0 ? '+' : ''}${lt.marketReturn12m.toFixed(1)}% for the S&P 500 (SPY)` : '';
      pastYear.push(`Over the past 12 months it is ${sgn(lt.return12m)}${vsMarket}.`);
    }
    if (lt.return3m != null) pastYear.push(`Over the past 3 months it is ${sgn(lt.return3m)}.`);
    if (lt.fromHigh != null) pastYear.push(lt.fromHigh > -1 ? 'It is at or within 1% of its 52-week high.' : `It is ${Math.abs(lt.fromHigh).toFixed(1)}% below its 52-week high${lt.fromLow != null ? ` and ${lt.fromLow.toFixed(1)}% above its 52-week low` : ''}.`);
    if (lt.vs200 != null) pastYear.push(`It trades ${Math.abs(lt.vs200).toFixed(1)}% ${lt.vs200 >= 0 ? 'above' : 'below'} its 200-day average, a common gauge of the long-term trend.`);
    if (!pastYear.length) pastYear = null;
  }

  // ---- long-term (company financials) ----
  let longTerm: string[] | null = null;
  let conflict: string | null = null;
  if (f) {
    longTerm = [
      `Financial health is ${strength(f.balance_sheet_score)} (${f.balance_sheet_score}/100) compared with similar companies, based on debt, cash on hand and profit margin.`,
      `Growth is ${strength(f.growth_score)} (${f.growth_score}/100) compared with similar companies, based on sales and earnings growth.`,
    ];
    if (!lt && f.week52_low != null && f.week52_high != null && f.week52_high > f.week52_low) {
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
  const sign = (n: number) => (n > 0 ? 1 : n < 0 ? -1 : 0);
  const add = (newPillarTotal: number, oldPillar: number, cond: string) => {
    if (newPillarTotal === oldPillar) return;
    const next = labelFor(points - oldPillar + newPillarTotal);
    if (next !== tone) flips.push(`If ${cond}, the reading would turn ${next === 'neutral' ? 'Neutral' : next === 'bullish' ? 'Bullish' : 'Bearish'}.`);
  };
  const priceSide = sign(s.price - s.sma20), fastSide = sign(s.ema9 - s.sma20);
  if (priceSide !== 0) add(-priceSide + fastSide, pil.trend, priceSide > 0 ? `the price falls below its recent average (${money(s.sma20)})` : `the price rises above its recent average (${money(s.sma20)})`);
  if (fastSide !== 0) add(priceSide - fastSide, pil.trend, fastSide > 0 ? 'the latest prices slip below the older ones' : 'the latest prices climb above the older ones');
  if (pil.momentum != null && pil.momentum !== 0) add(-pil.momentum, pil.momentum, pil.momentum > 0 ? 'momentum turns negative' : 'momentum turns positive');
  if (pil.stretch !== 0) add(0, pil.stretch, 'RSI and the price range move back to normal levels');

  return { tone, headline, shortTerm, pastYear, longTerm, conflict, flips: flips.slice(0, 3) };
}
