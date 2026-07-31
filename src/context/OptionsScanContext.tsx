import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { OptionRow, FlowPrint } from '@/lib/optionsMockData';
import type { CreditSpreadRow, DiagonalRow } from '@/lib/spreads';
import type { MarketRegime } from '@/components/options/MarketRegimeBar';
import type { IndexWarning } from '@/components/options/IndexEarlyWarning';
import type { FlowAgg } from '@/components/options/FlowTiltPanel';
import {
  addPick, loadCloudPicks, loadPicks, mergePicks,
  saveCloudPick, saveCloudPicks, savePicks, type TrackedPick,
} from '@/lib/optionPicks';

interface ScanMeta { scanned: number; candidates: number; count: number }

interface OptionsScanState {
  allRows: OptionRow[];
  leapsRows: OptionRow[];
  creditSpreads: CreditSpreadRow[];
  diagonals: DiagonalRow[];
  liveFlow: FlowPrint[];
  flowAggs: FlowAgg[];
  loading: boolean;
  source: string;
  lastUpdate: Date | null;
  scanError: string | null;
  scanMeta: ScanMeta | null;
  cachedAt: Date | null;
  regime: MarketRegime | null;
  indexWarnings: IndexWarning[];
  picks: TrackedPick[];
  pickQuotes: Record<string, number>;
  pickPrevCloses: Record<string, number>;
  trackedIds: Set<string>;
  loadLive: () => Promise<void>;
  handleTrack: (row: OptionRow, portfolioName: string | null) => void;
  setAndPersistPicks: (next: TrackedPick[]) => void;
  refreshPickQuotes: (list: TrackedPick[]) => Promise<void>;
}

const OptionsScanCtx = createContext<OptionsScanState | null>(null);

// Single shared scan + tracked-picks source for every options-related page
// (Overview, Scanner, Income, Tracked, Flow & News, Calls, Puts) so they all
// show the exact same data instead of each independently invoking
// options-scanner on mount -- previously up to 3 redundant scans if a user
// visited Options Radar, Calls, and Puts in the same session, and Calls/Puts
// each kept their own local `trackedIds` that started empty and was never
// hydrated from storage, so already-tracked picks incorrectly looked
// untracked there until re-tracked in that session.
export const OptionsScanProvider = ({ children }: { children: ReactNode }) => {
  const [allRows, setAllRows] = useState<OptionRow[]>([]);
  const [leapsRows, setLeapsRows] = useState<OptionRow[]>([]);
  const [creditSpreads, setCreditSpreads] = useState<CreditSpreadRow[]>([]);
  const [diagonals, setDiagonals] = useState<DiagonalRow[]>([]);
  const [liveFlow, setLiveFlow] = useState<FlowPrint[]>([]);
  const [flowAggs, setFlowAggs] = useState<FlowAgg[]>([]);
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState('marketdata.app-delayed');
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanMeta, setScanMeta] = useState<ScanMeta | null>(null);
  const [cachedAt, setCachedAt] = useState<Date | null>(null);
  const [regime, setRegime] = useState<MarketRegime | null>(null);
  const [indexWarnings, setIndexWarnings] = useState<IndexWarning[]>([]);
  const [picks, setPicks] = useState<TrackedPick[]>(() => loadPicks());
  const [pickQuotes, setPickQuotes] = useState<Record<string, number>>({});
  const [pickPrevCloses, setPickPrevCloses] = useState<Record<string, number>>({});

  const trackedIds = useMemo(() => new Set(picks.map(p => p.id)), [picks]);

  // useCallback here (rather than plain functions) keeps these references
  // stable across renders so the memoized `value` below only changes when a
  // state slice actually changes, instead of on every render regardless.
  const setAndPersistPicks = useCallback((next: TrackedPick[]) => {
    setPicks(next);
    savePicks(next);
    void saveCloudPicks(next);
  }, []);
  const handleTrack = useCallback((row: OptionRow, portfolioName: string | null) => {
    const next = addPick(row, portfolioName);
    setPicks(next);
    const pick = next.find(p => p.id === row.id);
    if (pick) void saveCloudPick(pick);
  }, []);
  const refreshPickQuotes = useCallback(async (list: TrackedPick[]) => {
    if (!list.length) { setPickQuotes({}); setPickPrevCloses({}); return; }
    const contracts = list.map(p => ({ id: p.id, ticker: p.row.ticker, strike: p.row.strike, expiration: p.row.expiration, cp: p.row.cp }));
    const { data, error } = await supabase.functions.invoke('option-quotes', { body: { contracts } });
    if (error || !data?.quotes) return;
    const map: Record<string, number> = {};
    for (const q of data.quotes as Array<{ id: string; price: number }>) {
      if (q.price > 0) map[q.id] = q.price;
    }
    setPickQuotes(map);
    setPickPrevCloses({});
  }, []);

  const loadLive = useCallback(async () => {
    setLoading(true);
    setScanError(null);
    const { data, error } = await supabase.functions.invoke('options-scanner', { body: { expWindowDays: 45 } });
    if (error) {
      setScanError(error.message || 'Scanner request failed');
      setLoading(false);
      return;
    }
    if (data?.error) setScanError(String(data.error));
    if (data?.rows) {
      setAllRows(data.rows as OptionRow[]);
      setLeapsRows(Array.isArray(data.leapsRows) ? data.leapsRows as OptionRow[] : []);
      setCreditSpreads(Array.isArray(data.creditSpreads) ? data.creditSpreads as CreditSpreadRow[] : []);
      setDiagonals(Array.isArray(data.diagonals) ? data.diagonals as DiagonalRow[] : []);
      setSource((data.source as string) ?? 'marketdata.app-delayed');
      setLastUpdate(new Date());
      setCachedAt(data.cached && data.cachedAt ? new Date(data.cachedAt as string) : null);
      setScanMeta({
        scanned: Number(data.scanned) || 0,
        candidates: Number(data.candidates) || 0,
        count: Number(data.count) || (data.rows as OptionRow[]).length,
      });
      if (data.regime) setRegime(data.regime as MarketRegime);
      if (Array.isArray(data.indexWarnings)) setIndexWarnings(data.indexWarnings as IndexWarning[]);
      if (Array.isArray(data.flowPrints)) {
        const mapped: FlowPrint[] = (data.flowPrints as Array<{ ticker: string; cp: 'C' | 'P'; strike: number; exp: string; volume: number; dollarFlow: number; price: number; symbol: string }>).map((p, i) => ({
          id: `${p.symbol}-${i}`,
          ticker: p.ticker,
          contract: `${p.ticker} ${String(p.exp).slice(2).replace(/-/g, '')} ${p.cp}${p.strike}`,
          contracts: p.volume,
          dollarValue: p.dollarFlow,
          bullish: p.cp === 'C',
          time: new Date().toLocaleTimeString(),
        }));
        setLiveFlow(mapped);
      }
      if (Array.isArray(data.flowAggs)) setFlowAggs(data.flowAggs as FlowAgg[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadLive(); }, [loadLive]);
  useEffect(() => {
    // The underlying data is ~24h delayed on the MarketData.app fallback path,
    // so polling every few minutes wouldn't surface anything new; every 2
    // hours keeps a comfortable multi-day margin even if a page stays open
    // all day. Tradier-sourced scans refresh sooner via manual "Refresh".
    const id = window.setInterval(loadLive, 2 * 60 * 60_000);
    return () => window.clearInterval(id);
  }, [loadLive]);
  useEffect(() => {
    let cancelled = false;
    loadCloudPicks().then(cloudPicks => {
      if (cancelled) return;
      setPicks(current => {
        const merged = mergePicks(current, cloudPicks);
        savePicks(merged);
        void saveCloudPicks(merged);
        return merged;
      });
    });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => { refreshPickQuotes(picks); }, [picks, refreshPickQuotes]);

  const value = useMemo<OptionsScanState>(() => ({
    allRows, leapsRows, creditSpreads, diagonals, liveFlow, flowAggs, loading, source, lastUpdate,
    scanError, scanMeta, cachedAt, regime, indexWarnings, picks, pickQuotes, pickPrevCloses, trackedIds,
    loadLive, handleTrack, setAndPersistPicks, refreshPickQuotes,
  }), [
    allRows, leapsRows, creditSpreads, diagonals, liveFlow, flowAggs, loading, source, lastUpdate,
    scanError, scanMeta, cachedAt, regime, indexWarnings, picks, pickQuotes, pickPrevCloses, trackedIds,
    loadLive, handleTrack, setAndPersistPicks, refreshPickQuotes,
  ]);

  return <OptionsScanCtx.Provider value={value}>{children}</OptionsScanCtx.Provider>;
};

export const useOptionsScan = () => {
  const ctx = useContext(OptionsScanCtx);
  if (!ctx) throw new Error('useOptionsScan must be used within an OptionsScanProvider');
  return ctx;
};
