import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import type { OptionRow } from '@/lib/optionsMockData';

type FundamentalsRow = Database['public']['Tables']['stock_fundamentals']['Row'];
type TechnicalsRow = Pick<Database['public']['Tables']['stock_cache']['Row'], 'symbol' | 'price' | 'bollinger_pct_b' | 'rsi' | 'pattern' | 'pattern_confidence'>;

interface ValueRadarState {
  rows: FundamentalsRow[];
  technicals: TechnicalsRow[];
  technicalsBySymbol: Map<string, TechnicalsRow>;
  bestPutByTicker: Map<string, OptionRow>;
  putsScannedAt: string | null;
  oldestUpdate: Date | null;
  loading: boolean;
  scanning: boolean;
  runScan: () => Promise<void>;
}

const ValueRadarCtx = createContext<ValueRadarState | null>(null);

// Shared by every Value Radar sub-page (Quality Screen, Price-to-Sales,
// Short Candidates) so they all show the same scan instead of each
// independently re-fetching stock_fundamentals/stock_cache/options_scan_cache
// -- same reasoning as OptionsScanContext.
export const ValueRadarProvider = ({ children }: { children: ReactNode }) => {
  const [rows, setRows] = useState<FundamentalsRow[]>([]);
  const [technicals, setTechnicals] = useState<TechnicalsRow[]>([]);
  const [bestPutByTicker, setBestPutByTicker] = useState<Map<string, OptionRow>>(new Map());
  const [putsScannedAt, setPutsScannedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [fundamentalsRes, technicalsRes, putsRes] = await Promise.all([
      supabase.from('stock_fundamentals').select('*').order('balance_sheet_score', { ascending: false }),
      supabase.from('stock_cache').select('symbol, price, bollinger_pct_b, rsi, pattern, pattern_confidence'),
      supabase.from('options_scan_cache').select('payload, scanned_at').eq('id', true).maybeSingle(),
    ]);
    setRows(fundamentalsRes.data ?? []);
    setTechnicals(technicalsRes.data ?? []);

    const payload = putsRes.data?.payload as { rows?: OptionRow[] } | null;
    const allOptionRows = Array.isArray(payload?.rows) ? payload!.rows! : [];
    const bestPuts = new Map<string, OptionRow>();
    for (const r of allOptionRows) {
      if (r.cp !== 'P') continue;
      const existing = bestPuts.get(r.ticker);
      if (!existing || r.score > existing.score) bestPuts.set(r.ticker, r);
    }
    setBestPutByTicker(bestPuts);
    setPutsScannedAt(putsRes.data?.scanned_at ?? null);
    setLoading(false);
  }, []);

  const runScan = useCallback(async () => {
    setScanning(true);
    await supabase.functions.invoke('fundamentals-scanner', { body: {} });
    await load();
    setScanning(false);
  }, [load]);

  useEffect(() => { load(); }, [load]);

  const technicalsBySymbol = useMemo(() => new Map(technicals.map(t => [t.symbol, t])), [technicals]);
  const oldestUpdate = useMemo(
    () => rows.reduce<Date | null>((min, r) => {
      const d = new Date(r.updated_at);
      return !min || d < min ? d : min;
    }, null),
    [rows],
  );

  const value = useMemo<ValueRadarState>(() => ({
    rows, technicals, technicalsBySymbol, bestPutByTicker, putsScannedAt, oldestUpdate, loading, scanning, runScan,
  }), [rows, technicals, technicalsBySymbol, bestPutByTicker, putsScannedAt, oldestUpdate, loading, scanning, runScan]);

  return <ValueRadarCtx.Provider value={value}>{children}</ValueRadarCtx.Provider>;
};

export const useValueRadar = () => {
  const ctx = useContext(ValueRadarCtx);
  if (!ctx) throw new Error('useValueRadar must be used within a ValueRadarProvider');
  return ctx;
};
