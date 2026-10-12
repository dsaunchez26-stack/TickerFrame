import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SignalBreakdown } from '@/components/SignalBreakdown';
import { SignalBadge } from '@/components/SignalBadge';
import type { Stock } from '@/lib/mockData';

const stock: Stock = {
  symbol: 'AAPL', name: 'Apple', price: 333.69, change: 3, changePercent: 1, volume: 0, signal: 'buy', signalScore: 56, entry: 330, exit: 360,
  rsi: 67.2, macd: 0.8, sma20: 332.19, ema9: 333, macdHistogram: 0.3, bollingerPctB: 0.74, hasReading: true,
};

describe('SignalBreakdown', () => {
  it('shows the evidence behind a reading', () => {
    render(<SignalBreakdown stock={stock} />);
    expect(screen.getByText('Why this reading')).toBeInTheDocument();
    expect(screen.getByText('Bullish')).toBeInTheDocument();
    expect(screen.getByText('RSI (14)')).toBeInTheDocument();
    expect(screen.getByText(/5 or more reads Bullish/)).toBeInTheDocument();
  });

  it('says there is no reading yet instead of showing zero-point factors', () => {
    render(<SignalBreakdown stock={{ ...stock, signal: 'hold', signalScore: null, hasReading: false, rsi: 50, macd: 0, macdHistogram: 0 }} />);
    expect(screen.getByText(/Not enough price history yet to compute a reading for AAPL/)).toBeInTheDocument();
    expect(screen.queryByText('RSI (14)')).not.toBeInTheDocument();
  });
});

describe('SignalBadge', () => {
  it('shows the label and a signed score', () => {
    render(<SignalBadge signal="sell" score={-56} />);
    expect(screen.getByText('Bearish')).toBeInTheDocument();
    expect(screen.getByText('-56')).toBeInTheDocument();
  });

  it('omits the score when there is none', () => {
    render(<SignalBadge signal="hold" score={null} />);
    expect(screen.getByText('Neutral')).toBeInTheDocument();
    expect(screen.queryByText(/^[+-]?\d+$/)).not.toBeInTheDocument();
  });
});
