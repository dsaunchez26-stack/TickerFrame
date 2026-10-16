import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface NewsItem { headline: string; source: string; url: string; datetime: number }

// symbol = company headlines; omit for general market headlines. The edge
// function caches for 10 minutes, so a matching client staleTime avoids
// pointless round trips when reopening the same stock.
export const useNews = (symbol?: string | null, enabled = true) =>
  useQuery({
    queryKey: ['news', symbol ?? 'market'],
    enabled,
    staleTime: 10 * 60_000,
    retry: 1,
    queryFn: async (): Promise<NewsItem[]> => {
      const { data, error } = await supabase.functions.invoke('stock-news', { body: symbol ? { symbol } : {} });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return (data?.items ?? []) as NewsItem[];
    },
  });
