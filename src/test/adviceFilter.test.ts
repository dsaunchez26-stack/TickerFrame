import { describe, expect, it } from 'vitest';
import { adviceViolation, NO_ADVICE_REPLY } from '../../supabase/functions/market-chat/adviceFilter';

describe('assistant advice backstop', () => {
  it.each([
    'You should buy AGG for stable income.',
    'I recommend TLT and GLD for a balanced mix.',
    "I'd go with AGG - it is the safest.",
    'My top pick is IBIT.',
    'AGG would be a good fit for you.',
    'The best ETF for you is VNQ.',
    'This will return 10% a year.',
    'It is guaranteed to return income.',
    'You should consider buying bonds.',
    'I suggest putting 60% in stocks.',
  ])('blocks: %s', (text) => {
    expect(adviceViolation(text)).toBe(true);
  });

  it.each([
    "I can't recommend specific funds, but AGG is down 0.18% today with a neutral reading.",
    'Bond funds are generally less volatile than stocks; no investment can be guaranteed to return 10%.',
    'A bullish reading means trend and momentum lean up - it is not a prediction.',
    'Realized volatility for GLD is about 18% annualized, versus roughly 25% for NVDA.',
    'Reaching a 10% return target generally requires taking on risk that can lose money.',
    'Whether to buy or sell is a decision for you and a licensed professional.',
  ])('allows: %s', (text) => {
    expect(adviceViolation(text)).toBe(false);
  });

  it('the replacement reply itself passes the filter', () => {
    expect(adviceViolation(NO_ADVICE_REPLY)).toBe(false);
  });
});
