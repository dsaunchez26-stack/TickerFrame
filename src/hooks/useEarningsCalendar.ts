import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface EarningsInfo {
  date: string; // YYYY-MM-DD
  hour: string | null; // 'bmo' | 'amc' | 'dmh' | null
}

// Single shared fetch of the whole (small, ~114-row) earnings_calendar
// table -- every page that needs earnings-awareness (Portfolio, options
// tables, the Risk Calculator, the Earnings Calendar widget) reads from
// this instead of each independently querying.
export const useEarningsCalendar = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['earnings-calendar'],
    queryFn: async () => {
      const { data, error } = await supabase.from('earnings_calendar').select('symbol, next_earnings_date, hour');
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30 * 60_000,
    refetchInterval: 60 * 60_000,
  });

  const bySymbol = new Map<string, EarningsInfo>();
  for (const row of data ?? []) {
    if (row.next_earnings_date) bySymbol.set(row.symbol, { date: row.next_earnings_date, hour: row.hour });
  }

  return { earningsBySymbol: bySymbol, loading: isLoading };
};
