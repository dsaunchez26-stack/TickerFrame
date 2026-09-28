import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// A single shared ticker -> company name lookup, for every page that shows
// a bare ticker without already having the company name in its own query
// (insider activity, options rows, portfolio holdings, patterns) --
// avoids adding a name column to a dozen different queries individually.
// One request, cached and reused everywhere via React Query's default
// cache, covers the whole tracked universe.
export const useSymbolNames = () => {
  const { data } = useQuery<Map<string, string>>({
    queryKey: ['symbol-names'],
    queryFn: async () => {
      const { data } = await supabase.from('stock_cache').select('symbol, name');
      return new Map((data ?? []).map(r => [r.symbol, r.name as string]).filter(([, name]) => !!name));
    },
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
  });
  return data ?? new Map<string, string>();
};
