// Deno-side port of the bias field in src/lib/patterns.ts (kept in sync
// manually). Only need label + bullish/bearish/neutral here -- "consolidation"
// (bias: neutral) is the default no-signal state ~40% of tracked stocks sit
// in at any time, so alerts only fire on the directional patterns.
export const PATTERN_BIAS: Record<string, { label: string; bias: 'bullish' | 'bearish' | 'neutral' }> = {
  bull_flag: { label: 'Bull Flag', bias: 'bullish' },
  bear_flag: { label: 'Bear Flag', bias: 'bearish' },
  cup_handle: { label: 'Cup & Handle', bias: 'bullish' },
  double_top: { label: 'Double Top', bias: 'bearish' },
  double_bottom: { label: 'Double Bottom', bias: 'bullish' },
  ascending_triangle: { label: 'Ascending Triangle', bias: 'bullish' },
  descending_triangle: { label: 'Descending Triangle', bias: 'bearish' },
  head_shoulders: { label: 'Head & Shoulders', bias: 'bearish' },
  inverse_head_shoulders: { label: 'Inverse H&S', bias: 'bullish' },
  wedge_rising: { label: 'Rising Wedge', bias: 'bearish' },
  wedge_falling: { label: 'Falling Wedge', bias: 'bullish' },
  breakout: { label: 'Breakout', bias: 'bullish' },
  breakdown: { label: 'Breakdown', bias: 'bearish' },
  consolidation: { label: 'Consolidation', bias: 'neutral' },
};
