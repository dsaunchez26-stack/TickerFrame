import { OptionRow } from './optionsMockData';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

export interface TrackedPick {
  id: string;
  pickedAt: string;
  entryPrice: number;
  row: OptionRow;
  notes?: string;
  portfolioName?: string | null;
  quantity?: number;
}

const KEY = 'option_picks_v1';

export const loadPicks = (): TrackedPick[] => {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const savePicks = (picks: TrackedPick[]) => {
  localStorage.setItem(KEY, JSON.stringify(picks));
};

const normalizePick = (record: { id: string; picked_at: string; entry_price: number; row: unknown; notes?: string | null; portfolio_name?: string | null; quantity?: number | null }): TrackedPick => ({
  id: record.id,
  pickedAt: record.picked_at,
  entryPrice: Number(record.entry_price),
  row: record.row as OptionRow,
  notes: record.notes ?? undefined,
  portfolioName: record.portfolio_name ?? null,
  quantity: record.quantity != null ? Number(record.quantity) : 1,
});

export const mergePicks = (...groups: TrackedPick[][]): TrackedPick[] => {
  const byId = new Map<string, TrackedPick>();
  for (const picks of groups) {
    for (const pick of picks) {
      if (!byId.has(pick.id)) byId.set(pick.id, pick);
    }
  }
  return Array.from(byId.values()).sort((a, b) => new Date(b.pickedAt).getTime() - new Date(a.pickedAt).getTime());
};

export const loadCloudPicks = async (): Promise<TrackedPick[]> => {
  const { data, error } = await supabase
    .from('option_tracked_picks')
    .select('id,picked_at,entry_price,row,notes,portfolio_name,quantity')
    .order('picked_at', { ascending: false });

  if (error || !data) return [];
  return data.map(normalizePick);
};

export const saveCloudPick = async (pick: TrackedPick) => {
  const { error } = await supabase.from('option_tracked_picks').upsert([{
    id: pick.id,
    picked_at: pick.pickedAt,
    entry_price: pick.entryPrice,
    row: pick.row as unknown as Json,
    notes: pick.notes ?? null,
    portfolio_name: pick.portfolioName ?? null,
    quantity: pick.quantity ?? 1,
  }], { onConflict: 'id' });
  if (error) console.warn('saveCloudPick failed:', error.message);
};

export const saveCloudPicks = async (picks: TrackedPick[]) => {
  if (!picks.length) return;
  const { error } = await supabase.from('option_tracked_picks').upsert(picks.map(pick => ({
    id: pick.id,
    picked_at: pick.pickedAt,
    entry_price: pick.entryPrice,
    row: pick.row as unknown as Json,
    notes: pick.notes ?? null,
    portfolio_name: pick.portfolioName ?? null,
    quantity: pick.quantity ?? 1,
  })), { onConflict: 'id' });
  if (error) console.warn('saveCloudPicks failed:', error.message);
};

export const removeCloudPick = async (id: string) => {
  await supabase.from('option_tracked_picks').delete().eq('id', id);
};

export const addPick = (row: OptionRow, portfolioName?: string | null, quantity = 1): TrackedPick[] => {
  const picks = loadPicks();
  if (picks.find(p => p.id === row.id)) return picks;
  const next = [{ id: row.id, pickedAt: new Date().toISOString(), entryPrice: row.price, row, portfolioName: portfolioName ?? null, quantity }, ...picks];
  savePicks(next);
  return next;
};

export const removePick = (id: string): TrackedPick[] => {
  const next = loadPicks().filter(p => p.id !== id);
  savePicks(next);
  return next;
};

// Takes the full pick (not just its id) so this works whether or not the
// pick was ever mirrored into localStorage -- components that load picks
// straight from the cloud (e.g. PortfolioOptions) never populate the local
// cache, so a lookup-by-id against localStorage alone would silently no-op.
export const updatePick = async (pick: TrackedPick, updates: { entryPrice?: number; quantity?: number }): Promise<TrackedPick> => {
  const updated: TrackedPick = { ...pick, ...updates };
  const local = loadPicks();
  const idx = local.findIndex(p => p.id === pick.id);
  if (idx >= 0) local[idx] = updated; else local.unshift(updated);
  savePicks(local);
  await saveCloudPick(updated);
  return updated;
};
