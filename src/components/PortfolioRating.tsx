import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Info } from 'lucide-react';

interface EnrichedHolding {
  symbol: string;
  quantity: number;
  currentPrice: number;
  signal: string;
  pattern?: string | null;
}

interface Props {
  enriched: EnrichedHolding[];
  totalValue: number;
  pnlPct: number;
  winRate: number;
}

const BEARISH_PATTERNS = new Set(['breakdown', 'bear_flag']);
const BULLISH_PATTERNS = new Set(['breakout', 'bull_flag']);

export const PortfolioRating = ({ enriched, totalValue, pnlPct, winRate }: Props) => {
  const analysis = useMemo(() => {
    if (!enriched.length || totalValue <= 0) return null;

    const positions = enriched.map(e => ({ ...e, value: e.currentPrice * e.quantity }));
    const largest = [...positions].sort((a, b) => b.value - a.value)[0];
    const largestPct = (largest.value / totalValue) * 100;

    const signalWeight = (s: string) => (s === 'buy' ? 1 : s === 'sell' ? 0 : 0.5);
    const weightedSignal = positions.reduce((sum, p) => sum + (p.value / totalValue) * signalWeight(p.signal), 0);
    const sellCount = positions.filter(p => p.signal === 'sell').length;
    const buyCount = positions.filter(p => p.signal === 'buy').length;

    const bearish = positions.filter(p => p.pattern && BEARISH_PATTERNS.has(p.pattern));
    const bullish = positions.filter(p => p.pattern && BULLISH_PATTERNS.has(p.pattern));

    // Actual results carry the most weight (40 of 100 points, between
    // realized P/L and win rate) -- a portfolio that's genuinely up and
    // beating more often than not should score well regardless of how it's
    // structured. The remaining 60 points are the same structural/signal
    // factors shown per stock elsewhere on this page: position count,
    // concentration, current signal mix, and chart patterns.
    const performanceScore = Math.max(0, Math.min(30, 15 + pnlPct * 0.75));
    const winRateScore = Math.max(0, Math.min(10, (winRate / 100) * 10));
    const positionScore = Math.min(10, positions.length * 1);
    const concentrationScore = Math.max(0, 20 - largestPct / 5);
    const signalScore = 20 * weightedSignal;
    const patternScore = Math.max(0, Math.min(10, 6 + bullish.length * 2 - bearish.length * 2));
    const score = Math.round(performanceScore + winRateScore + positionScore + concentrationScore + signalScore + patternScore);

    const notes: Array<{ tone: 'warn' | 'info'; text: string; suggestion?: string }> = [];
    if (pnlPct > 10) {
      notes.push({ tone: 'info', text: `Up ${pnlPct.toFixed(1)}% all-time with a ${winRate.toFixed(0)}% win rate — the strongest single factor in this score, and it's carrying it.` });
    }
    if (largestPct > 25) {
      notes.push({
        tone: 'warn',
        text: `${largest.symbol} makes up ${largestPct.toFixed(0)}% of this portfolio's value — a position this concentrated means its moves dominate the whole portfolio's swings.`,
        suggestion: `Consider whether that position size still matches your risk tolerance, or whether trimming it would reduce how much a single stock can move your total return.`,
      });
    }
    if (positions.length < 5) {
      notes.push({ tone: 'info', text: `Only ${positions.length} position${positions.length === 1 ? '' : 's'} tracked here — with this few holdings, any single stock's move has an outsized effect on total performance.` });
    }
    if (sellCount > positions.length / 2) {
      notes.push({
        tone: 'warn',
        text: `${sellCount} of ${positions.length} holdings currently carry a "sell" signal (RSI-based) — worth a closer look before adding to these.`,
        suggestion: `Remember this reflects short-term RSI momentum, not your original thesis for the position -- worth checking whether anything's actually changed before acting on it.`,
      });
    }
    if (bearish.length > 0) {
      notes.push({
        tone: 'warn',
        text: `${bearish.length} holding${bearish.length === 1 ? ' shows' : 's show'} a bearish chart pattern: ${bearish.map(p => p.symbol).join(', ')}.`,
        suggestion: `If you're holding through this, a stop-loss or a smaller position size can limit how much further downside affects the portfolio; if the pattern doesn't match your reason for holding, it may be worth revisiting.`,
      });
    }
    if (bullish.length > 0) {
      notes.push({ tone: 'info', text: `${bullish.length} holding${bullish.length === 1 ? ' shows' : 's show'} a bullish chart pattern: ${bullish.map(p => p.symbol).join(', ')}.` });
    }
    if (buyCount > 0) {
      notes.push({ tone: 'info', text: `${buyCount} of ${positions.length} holdings currently carry a "buy" signal.` });
    }
    if (notes.length === 0) {
      notes.push({ tone: 'info', text: 'No major concentration or signal-based flags right now.' });
    }

    return { score, largestPct, largest, notes };
  }, [enriched, totalValue, pnlPct, winRate]);

  if (!analysis) return null;

  const scoreColor = analysis.score >= 70 ? 'text-signal-buy' : analysis.score >= 40 ? 'text-signal-hold' : 'text-signal-sell';

  return (
    <Card className="mb-3">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm font-semibold">
          <span>Portfolio Rating</span>
          <span className={`font-heading text-xl font-bold ${scoreColor}`}>{analysis.score}<span className="text-xs text-muted-foreground">/100</span></span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5 pt-0">
        {analysis.notes.map((n, i) => (
          <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
            {n.tone === 'warn' ? <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-signal-sell" /> : <Info className="mt-0.5 h-3 w-3 shrink-0 text-primary" />}
            <div>
              <span>{n.text}</span>
              {n.suggestion && <p className="mt-0.5 text-foreground/70">→ {n.suggestion}</p>}
            </div>
          </div>
        ))}
        <p className="pt-1 text-[10px] italic text-muted-foreground/70">
          Based on realized performance plus position sizing and the same signals/patterns shown per stock below — not a recommendation to buy, hold, or sell. Research & education only.
        </p>
      </CardContent>
    </Card>
  );
};
