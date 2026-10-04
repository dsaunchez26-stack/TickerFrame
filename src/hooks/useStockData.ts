import { useQuery } from '@tanstack/react-query';
import type { Stock } from '@/lib/mockData';
import { supabase } from '@/integrations/supabase/client';

interface StockResponse {
  stocks: Stock[];
  fetchedAt: string;
}

type Category = 'core' | 'volatile' | 'all';
// 'equity' = individual stocks only (what every existing view expects),
// 'funds' = the bond/gold/crypto/real-estate/index ETFs, 'all' = both.
type Scope = 'equity' | 'funds' | 'all';

export const useStockData = (category: Category = 'core', scope: Scope = 'equity') => {
  return useQuery<StockResponse>({
    queryKey: ['stocks', category, scope],
    queryFn: async () => {
      let query = supabase.from('stock_cache').select('*');

      if (category !== 'all') {
        query = query.eq('category', category);
      }

      if (scope === 'equity') query = query.eq('asset_class', 'Equity');
      else if (scope === 'funds') query = query.neq('asset_class', 'Equity');

      const { data: cached, error } = await query;

      if (!error && cached && cached.length > 0) {
        const stocks: Stock[] = cached.map((row: any) => ({
          symbol: row.symbol,
          name: row.name,
          price: Number(row.price),
          change: Number(row.change),
          changePercent: Number(row.change_percent),
          volume: Number(row.volume),
          signal: row.signal as Stock['signal'],
          signalScore: row.signal_score ?? null,
          assetClass: row.asset_class ?? 'Equity',
          entry: Number(row.entry),
          exit: Number(row.exit_price),
          rsi: Number(row.rsi),
          macd: Number(row.macd),
          macdHistogram: row.macd_histogram ?? null,
          bollingerPctB: row.bollinger_pct_b ?? null,
          sma20: Number(row.sma20),
          ema9: Number(row.ema9),
          prevClose: Number(row.prev_close),
          lastUpdated: row.fetched_at,
          holdDuration: row.hold_duration || 'Swing',
          pattern: row.pattern ?? null,
          patternConfidence: row.pattern_confidence ? Number(row.pattern_confidence) : 0,
        }));

        return {
          stocks,
          fetchedAt: cached[0].fetched_at,
        };
      }

      console.warn('No cached stock data available');
      return { stocks: [], fetchedAt: new Date().toISOString() };
    },
    refetchInterval: 5 * 60 * 1000,
    staleTime: 2 * 60 * 1000,
    retry: 1,
  });
};
