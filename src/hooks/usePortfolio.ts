import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

export interface PortfolioEntry {
  id: string;
  symbol: string;
  buy_price: number;
  quantity: number;
  bought_at: string;
  notes: string | null;
  portfolio_type: 'day_trade' | 'long_term' | 'watchlist';
  portfolio_name?: string;
  portfolio_color?: string;
  target_gain_pct: number | null;
  stop_loss_pct: number | null;
}

export const usePortfolio = (portfolioType?: 'day_trade' | 'long_term' | 'watchlist', portfolioName?: string) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const query = useQuery<PortfolioEntry[]>({
    queryKey: ['portfolio', user?.id ?? 'anon', portfolioType ?? 'all', portfolioName ?? 'all'],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return [];
      let q = supabase
        .from('portfolio')
        .select('*')
        .eq('user_id', user.id)
        .order('bought_at', { ascending: false });
      if (portfolioType) q = q.eq('portfolio_type', portfolioType);
      if (portfolioName) q = q.eq('portfolio_name', portfolioName);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as PortfolioEntry[];
    },
    refetchInterval: 2 * 60_000,
    staleTime: 30_000,
  });

  const addStock = useMutation({
    mutationFn: async (entry: { symbol: string; buy_price: number; quantity: number; notes?: string; portfolio_type?: 'day_trade' | 'long_term' | 'watchlist'; portfolio_name?: string }) => {
      if (!user) throw new Error('Sign in to manage your portfolio.');
      const { error } = await supabase.from('portfolio').upsert(
        {
          user_id: user.id,
          symbol: entry.symbol.toUpperCase(),
          buy_price: entry.buy_price,
          quantity: entry.quantity,
          notes: entry.notes ?? null,
          portfolio_type: entry.portfolio_type ?? portfolioType ?? 'long_term',
          portfolio_name: entry.portfolio_name ?? portfolioName ?? 'Portfolio A',
        },
        { onConflict: 'user_id,symbol,portfolio_type,portfolio_name' as any }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio'] });
      toast.success('Stock added to portfolio');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeStock = useMutation({
    mutationFn: async (arg: string | { symbol: string; portfolio_type?: string; portfolio_name?: string }) => {
      if (!user) throw new Error('Sign in to manage your portfolio.');
      const symbol = typeof arg === 'string' ? arg : arg.symbol;
      const ptype = typeof arg === 'string' ? portfolioType : (arg.portfolio_type ?? portfolioType);
      const pname = typeof arg === 'string' ? portfolioName : (arg.portfolio_name ?? portfolioName);
      let q = supabase.from('portfolio').delete()
        .eq('user_id', user.id)
        .eq('symbol', symbol.toUpperCase());
      if (ptype) q = q.eq('portfolio_type', ptype);
      if (pname) q = q.eq('portfolio_name', pname);
      const { error } = await q;
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio'] });
      toast.success('Stock removed from portfolio');
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Purely a user-set threshold on an existing position -- doesn't touch
  // buy_price/quantity, so this is a separate mutation from addStock rather
  // than requiring every caller to know and re-send the current price/qty
  // just to adjust an alert level.
  const updateAlerts = useMutation({
    mutationFn: async (arg: { symbol: string; portfolio_type: 'day_trade' | 'long_term' | 'watchlist'; portfolio_name?: string; target_gain_pct: number | null; stop_loss_pct: number | null }) => {
      if (!user) throw new Error('Sign in to manage your portfolio.');
      let q = supabase.from('portfolio').update({
        target_gain_pct: arg.target_gain_pct,
        stop_loss_pct: arg.stop_loss_pct,
      })
        .eq('user_id', user.id)
        .eq('symbol', arg.symbol.toUpperCase())
        .eq('portfolio_type', arg.portfolio_type);
      if (arg.portfolio_name) q = q.eq('portfolio_name', arg.portfolio_name);
      const { error } = await q;
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return { ...query, addStock, removeStock, updateAlerts };
};
