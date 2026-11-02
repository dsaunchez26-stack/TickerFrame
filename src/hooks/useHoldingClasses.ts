import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useStockData } from '@/hooks/useStockData';
import { broadSector } from '@/lib/sectorMapping';
import { classifyHolding, BROAD_FUNDS, UNCLASSIFIED, type HoldingClass, type SymbolInfo } from '@/lib/classify';

// Sector label used when a tracked fund's own asset class is the best description.
const CLASS_SECTOR: Record<string, string> = { Index: BROAD_FUNDS, Bonds: 'Bonds', 'Gold & Silver': 'Gold & silver', Crypto: 'Crypto', 'Real Estate': 'Real estate' };

// Asset class and sector for every holding. Tracked stocks and funds use the site's own data;
// anything else is looked up (name and industry) and placed by classifyHolding, so a
// holding is only "Not classified" when nothing about it could be found.
export function useHoldingClasses(symbols: string[]) {
  const key = useMemo(() => [...new Set(symbols.map((s) => s.toUpperCase()))].sort(), [symbols]);
  const { data: stockData } = useStockData('all', 'all');
  const tracked = useMemo(() => new Map((stockData?.stocks ?? []).map((s) => [s.symbol, s.assetClass ?? 'Equity'])), [stockData]);
  const untracked = useMemo(() => (stockData ? key.filter((s) => !tracked.has(s)) : []), [key, tracked, stockData]);

  const { data: sectorRows } = useQuery({
    queryKey: ['allocation-sectors', key.join(',')],
    enabled: key.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from('stock_fundamentals').select('symbol, sector').in('symbol', key);
      return new Map((data ?? []).map((r) => [r.symbol, r.sector as string | null]));
    },
    staleTime: 30 * 60_000,
  });

  const { data: info, isLoading: infoLoading } = useQuery({
    queryKey: ['symbol-info', untracked.join(',')],
    enabled: untracked.length > 0,
    staleTime: 24 * 3600_000,
    retry: 1,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('symbol-info', { body: { symbols: untracked } });
      if (error) throw error;
      return (data?.info ?? {}) as Record<string, SymbolInfo>;
    },
  });

  const classes = useMemo(() => {
    const out = new Map<string, HoldingClass>();
    for (const s of key) {
      const cls = tracked.get(s);
      if (cls !== undefined) {
        if (cls === 'Equity') { const sec = broadSector(s, sectorRows?.get(s) ?? null); out.set(s, { assetClass: 'Equity', sector: sec === 'Other' ? UNCLASSIFIED : sec }); }
        else out.set(s, { assetClass: cls, sector: CLASS_SECTOR[cls] ?? cls });
      } else {
        out.set(s, classifyHolding(s, info?.[s]));
      }
    }
    return out;
  }, [key, tracked, sectorRows, info]);

  return { classes, isLoading: infoLoading };
}
