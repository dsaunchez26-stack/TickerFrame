import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface BetaInfo { beta: number; r2: number | null; volatility: number | null; observations: number }
export interface BetaResponse { betas: Record<string, BetaInfo>; missing: string[]; riskFree: { ratePct: number; asOf: string | null } | null }

// One year of daily returns against the S&P 500, plus the 10-year Treasury yield
// as the risk-free rate. The server caches betas for a day.
export const useBetas = (symbols: string[], enabled = true) => {
  const key = [...new Set(symbols.map((s) => s.toUpperCase()))].sort();
  return useQuery<BetaResponse>({
    queryKey: ['betas', key.join(',')],
    enabled: enabled && key.length > 0,
    staleTime: 6 * 3600_000,
    retry: 1,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('stock-betas', { body: { symbols: key } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as BetaResponse;
    },
  });
};
