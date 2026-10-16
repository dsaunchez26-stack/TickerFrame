import { useSyncExternalStore } from 'react';

// "Investor" is the default and keeps the menu to stocks, ETFs, portfolio and
// research. "Trader" adds the options, futures and pattern tools. It only
// changes what the menu shows -- every page stays reachable by link.
export type ViewMode = 'investor' | 'trader';
const KEY = 'tf_view_mode';
const listeners = new Set<() => void>();

const read = (): ViewMode => {
  try { return localStorage.getItem(KEY) === 'trader' ? 'trader' : 'investor'; } catch { return 'investor'; }
};

export const setViewMode = (mode: ViewMode) => {
  try { localStorage.setItem(KEY, mode); } catch { /* storage unavailable: choice lasts until reload */ }
  memory = mode;
  listeners.forEach((l) => l());
};

let memory: ViewMode | null = null;
const snapshot = (): ViewMode => memory ?? (memory = read());
const subscribe = (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; };

export const useViewMode = (): ViewMode => useSyncExternalStore(subscribe, snapshot, () => 'investor');
