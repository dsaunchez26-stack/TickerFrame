import {
  TrendingUp, TrendingDown, Minus, Flag, ArrowUpRight, ArrowDownRight,
  Triangle, Diamond, Waves, type LucideIcon,
} from 'lucide-react';

export interface PatternMeta {
  label: string;
  description: string;
  bias: 'bullish' | 'bearish' | 'neutral';
  icon: LucideIcon;
}

const PATTERNS: Record<string, PatternMeta> = {
  bull_flag: { label: 'Bull Flag', description: 'Sharp upward move followed by a tight consolidation — often continues higher.', bias: 'bullish', icon: Flag },
  bear_flag: { label: 'Bear Flag', description: 'Sharp downward move followed by a tight consolidation — often continues lower.', bias: 'bearish', icon: Flag },
  cup_handle: { label: 'Cup & Handle', description: 'Rounded bottom followed by a small pullback — a classic bullish continuation setup.', bias: 'bullish', icon: Waves },
  double_top: { label: 'Double Top', description: 'Two failed attempts at the same resistance level — a bearish reversal signal.', bias: 'bearish', icon: TrendingDown },
  double_bottom: { label: 'Double Bottom', description: 'Two failed attempts at the same support level — a bullish reversal signal.', bias: 'bullish', icon: TrendingUp },
  ascending_triangle: { label: 'Ascending Triangle', description: 'Flat resistance with rising support — typically resolves to the upside.', bias: 'bullish', icon: Triangle },
  descending_triangle: { label: 'Descending Triangle', description: 'Flat support with falling resistance — typically resolves to the downside.', bias: 'bearish', icon: Triangle },
  head_shoulders: { label: 'Head & Shoulders', description: 'Three peaks with the middle highest — a classic bearish reversal pattern.', bias: 'bearish', icon: TrendingDown },
  inverse_head_shoulders: { label: 'Inverse H&S', description: 'Three troughs with the middle lowest — a classic bullish reversal pattern.', bias: 'bullish', icon: TrendingUp },
  wedge_rising: { label: 'Rising Wedge', description: 'Narrowing range with an upward slope — often a bearish reversal.', bias: 'bearish', icon: Diamond },
  wedge_falling: { label: 'Falling Wedge', description: 'Narrowing range with a downward slope — often a bullish reversal.', bias: 'bullish', icon: Diamond },
  breakout: { label: 'Breakout', description: 'Price cleared a key resistance level with above-average volume.', bias: 'bullish', icon: ArrowUpRight },
  breakdown: { label: 'Breakdown', description: 'Price broke below a key support level with above-average volume.', bias: 'bearish', icon: ArrowDownRight },
  consolidation: { label: 'Consolidation', description: 'Price is range-bound with no clear directional edge yet.', bias: 'neutral', icon: Minus },
};

export function getPatternMeta(pattern?: string | null): PatternMeta | null {
  if (!pattern) return null;
  return PATTERNS[pattern] ?? null;
}

export const ALL_PATTERNS = PATTERNS;
