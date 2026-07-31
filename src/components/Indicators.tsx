import { TrendingUp, TrendingDown, Activity, BarChart3, Loader2 } from 'lucide-react';
import { useStockData } from '@/hooks/useStockData';
import { useMemo } from 'react';

interface Props {
  // If provided, shows this symbol's numbers instead of auto-picking the
  // day's biggest mover -- lets a parent page keep this in sync with
  // whatever stock another component (e.g. StockChart) is currently showing.
  symbol?: string;
}

export const Indicators = ({ symbol }: Props = {}) => {
  const { data, isLoading } = useStockData();

  const indicators = useMemo(() => {
    if (!data?.stocks?.length) return null;
    const stocks = data.stocks;
    const featured = (symbol ? stocks.find(s => s.symbol === symbol) : null)
      ?? stocks.reduce((a, b) => Math.abs(a.changePercent) > Math.abs(b.changePercent) ? a : b);

    return [
      {
        label: 'RSI (14)',
        value: featured.rsi.toFixed(1),
        sub: featured.rsi > 70 ? 'Overbought — caution' : featured.rsi < 30 ? 'Oversold — opportunity' : 'Neutral range',
        icon: <TrendingUp className="h-4 w-4" />,
        status: featured.rsi > 50 ? 'buy' : featured.rsi < 30 ? 'sell' : 'neutral' as const,
      },
      {
        label: 'MACD',
        value: (featured.macd >= 0 ? '+' : '') + featured.macd.toFixed(3),
        sub: featured.macd > 0 ? 'Bullish crossover' : 'Bearish signal',
        icon: featured.macd > 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />,
        status: featured.macd > 0 ? 'buy' : 'sell' as const,
      },
      {
        label: 'Volume',
        value: featured.volume > 0 ? formatVolume(featured.volume) : 'N/A',
        sub: featured.volume > 0 ? `${featured.symbol} trading volume` : 'Not provided by data source',
        icon: <BarChart3 className="h-4 w-4" />,
        status: 'neutral' as const,
      },
      {
        label: 'SMA 20',
        value: `$${featured.sma20.toFixed(2)}`,
        sub: featured.price > featured.sma20 ? 'Price above SMA' : 'Price below SMA',
        icon: <Activity className="h-4 w-4" />,
        status: featured.price > featured.sma20 ? 'buy' : 'sell' as const,
      },
    ];
  }, [data, symbol]);

  const statusColor = { buy: 'text-signal-buy', sell: 'text-signal-sell', neutral: 'text-muted-foreground' };

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-center justify-center rounded-lg border border-border bg-card p-6">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ))}
      </div>
    );
  }

  if (!indicators) return null;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {indicators.map((ind) => (
        <div key={ind.label} className="rounded-lg border border-border bg-card p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{ind.label}</span>
            <span className={statusColor[ind.status]}>{ind.icon}</span>
          </div>
          <p className={`font-heading text-xl font-bold ${statusColor[ind.status]}`}>{ind.value}</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">{ind.sub}</p>
        </div>
      ))}
    </div>
  );
};

function formatVolume(vol: number): string {
  if (vol >= 1_000_000_000) return (vol / 1_000_000_000).toFixed(1) + 'B';
  if (vol >= 1_000_000) return (vol / 1_000_000).toFixed(1) + 'M';
  if (vol >= 1_000) return (vol / 1_000).toFixed(1) + 'K';
  return vol.toString();
}
