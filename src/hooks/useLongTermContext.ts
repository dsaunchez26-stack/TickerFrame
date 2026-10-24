import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { longTermContext, type DailyBar, type LongTermContext } from '@/lib/longTerm';

const fetchYear = async (symbol: string): Promise<DailyBar[] | undefined> => {
  const { data, error } = await supabase.functions.invoke('stock-bars', { body: { symbol, range: '1Y' } });
  if (error || data?.error) return undefined;
  return data?.bars as DailyBar[];
};

// A year of daily bars for the stock and for SPY (as the market yardstick),
// cached for 30 minutes to match the server cache.
export const useLongTermContext = (symbol: string | null) =>
  useQuery<LongTermContext | null>({
    queryKey: ['long-term', symbol],
    enabled: !!symbol,
    staleTime: 30 * 60_000,
    retry: 0,
    queryFn: async () => {
      const [stock, market] = await Promise.all([fetchYear(symbol!), symbol === 'SPY' ? Promise.resolve(undefined) : fetchYear('SPY')]);
      return longTermContext(stock, market);
    },
  });
