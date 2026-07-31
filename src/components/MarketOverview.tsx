import { Activity, TrendingUp, TrendingDown, Eye, Loader2 } from 'lucide-react';
import { useStockData } from '@/hooks/useStockData';
import { useMemo } from 'react';

export const MarketOverview = () => {
  const { data, isLoading } = useStockData();

  const stats = useMemo(() => {
    if (!data?.stocks?.length) return null;
    const stocks = data.stocks;

    const hasVolumeData = stocks.some(s => s.volume > 0);
    // Our data provider's free tier doesn't return volume at all, so "most
    // active" would silently just be array[0] every time -- fall back to
    // biggest absolute mover instead of presenting a fake volume leader.
    const mostActive = hasVolumeData
      ? stocks.reduce((a, b) => a.volume > b.volume ? a : b)
      : stocks.reduce((a, b) => Math.abs(b.changePercent) > Math.abs(a.changePercent) ? b : a);
    const topGainer = stocks.reduce((a, b) => a.changePercent > b.changePercent ? a : b);
    const topLoser = stocks.reduce((a, b) => a.changePercent < b.changePercent ? a : b);

    return [
      {
        label: hasVolumeData ? 'Most Active' : 'Biggest Mover',
        value: mostActive.symbol,
        sub: hasVolumeData ? formatVolume(mostActive.volume) + ' vol' : `${mostActive.changePercent > 0 ? '+' : ''}${mostActive.changePercent.toFixed(2)}%`,
        icon: <Activity className="h-4 w-4" />,
      },
      { label: 'Top Gainer', value: topGainer.symbol, sub: `+${topGainer.changePercent.toFixed(2)}%`, icon: <TrendingUp className="h-4 w-4" />, color: 'text-signal-buy' },
      { label: 'Top Loser', value: topLoser.symbol, sub: `${topLoser.changePercent.toFixed(2)}%`, icon: <TrendingDown className="h-4 w-4" />, color: 'text-signal-sell' },
      { label: 'Watching', value: String(stocks.length), sub: 'stocks', icon: <Eye className="h-4 w-4" /> },
    ];
  }, [data]);

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

  if (!stats) return null;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className="rounded-lg border border-border bg-card p-3">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{s.label}</span>
            <span className={s.color || 'text-muted-foreground'}>{s.icon}</span>
          </div>
          <p className={`font-heading text-lg font-bold ${s.color || 'text-foreground'}`}>{s.value}</p>
          <p className="text-[10px] text-muted-foreground">{s.sub}</p>
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
