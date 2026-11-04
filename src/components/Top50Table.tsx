import { useMemo } from 'react';
import { ArrowDownRight, ArrowUpRight, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useStockData } from '@/hooks/useStockData';
import { useStockDetail } from '@/context/StockDetailContext';
import { SignalBadge } from '@/components/SignalBadge';
import { SP500_TOP50 } from '@/lib/sp500Top50';

// stock_fundamentals.market_cap is in millions of USD (Finnhub).
const fmtCap = (millions: number | null) => {
  if (millions == null) return '-';
  return millions >= 1_000_000 ? `$${(millions / 1_000_000).toFixed(2)}T` : `$${(millions / 1000).toFixed(0)}B`;
};

export const Top50Table = () => {
  const { data, isLoading } = useStockData();
  const { open } = useStockDetail();

  const { data: caps } = useQuery({
    queryKey: ['top50-market-caps'],
    queryFn: async () => {
      const { data: rows } = await supabase.from('stock_fundamentals').select('symbol, market_cap').in('symbol', SP500_TOP50);
      return new Map((rows ?? []).map(r => [r.symbol, r.market_cap as number | null]));
    },
    staleTime: 30 * 60_000,
  });

  const rows = useMemo(() => {
    const bySymbol = new Map((data?.stocks ?? []).map(s => [s.symbol, s]));
    const list = SP500_TOP50.map((symbol, i) => ({ symbol, fallbackRank: i, stock: bySymbol.get(symbol) ?? null, cap: caps?.get(symbol) ?? null }));
    // Rank by live market cap; a company whose cap isn't loaded yet (e.g.
    // Berkshire before its first fundamentals scan) keeps its approximate
    // position from the fixed list instead of dropping to the bottom.
    const withCap = list.filter(r => r.cap != null).sort((a, b) => (b.cap as number) - (a.cap as number));
    const result = [...withCap];
    for (const r of list.filter(r => r.cap == null).sort((a, b) => a.fallbackRank - b.fallbackRank)) {
      result.splice(Math.min(r.fallbackRank, result.length), 0, r);
    }
    return result;
  }, [data, caps]);

  const counts = useMemo(() => {
    const c = { buy: 0, hold: 0, sell: 0 };
    for (const r of rows) if (r.stock) c[r.stock.signal]++;
    return c;
  }, [rows]);

  if (isLoading) {
    return <div className="flex justify-center border-y border-border py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
        <div>
          <h3 className="text-sm font-semibold">50 largest U.S. companies (S&amp;P 500 members)</h3>
          <p className="text-[11px] text-muted-foreground">Ranked by live market value. Click any row for the full signal breakdown.</p>
        </div>
        <div className="flex gap-3">
          <span className="status-dot text-signal-buy">{counts.buy} Bullish</span>
          <span className="status-dot text-signal-hold">{counts.hold} Neutral</span>
          <span className="status-dot text-signal-sell">{counts.sell} Bearish</span>
        </div>
      </div>
      <div className="overflow-x-auto border-t border-border">
        <table className="data-table">
          <thead>
            <tr>
              <th className="w-8">#</th>
              <th>Company</th>
              <th className="text-right">Price</th>
              <th className="text-right">Today</th>
              <th className="hidden text-right sm:table-cell">Market cap</th>
              <th className="hidden text-right sm:table-cell">RSI</th>
              <th>Reading</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.symbol} onClick={() => open(r.symbol)} className="cursor-pointer last:border-0">
                <td className="text-faint">{i + 1}</td>
                <td>
                  <span className="font-semibold text-foreground">{r.symbol}</span>
                  <span className="ml-2 text-muted-foreground">{r.stock?.name ?? ''}</span>
                </td>
                <td className="text-right font-medium tabular-nums">{r.stock ? `$${r.stock.price.toFixed(2)}` : '-'}</td>
                <td className="text-right tabular-nums">
                  {r.stock ? (
                    <span className={`inline-flex items-center gap-0.5 ${r.stock.change >= 0 ? 'text-signal-buy' : 'text-signal-sell'}`}>
                      {r.stock.change >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                      {r.stock.changePercent > 0 ? '+' : ''}{r.stock.changePercent.toFixed(2)}%
                    </span>
                  ) : '-'}
                </td>
                <td className="hidden text-right tabular-nums text-muted-foreground sm:table-cell">{fmtCap(r.cap)}</td>
                <td className="hidden text-right tabular-nums sm:table-cell">{r.stock?.hasReading ? r.stock.rsi.toFixed(0) : '-'}</td>
                <td>{r.stock ? <SignalBadge signal={r.stock.signal} score={r.stock.signalScore} /> : <span className="text-muted-foreground">loading</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
