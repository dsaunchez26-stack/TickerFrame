import { useCallback, useEffect, useState } from 'react';
import type { Stock } from '@/lib/mockData';
import { SP500_TOP50 } from '@/lib/sp500Top50';

export type Universe = 'top50' | 'all';
const KEY = 'tf_universe';
const EVENT = 'tf-universe-change';
const TOP50 = new Set(SP500_TOP50);

const read = (): Universe => {
  try { return localStorage.getItem(KEY) === 'all' ? 'all' : 'top50'; } catch { return 'top50'; }
};

// Which set of stocks the overview lists (picks, movers, market summary)
// cover: the 50 household-name S&P 500 companies by default, or every
// tracked stock. Shared across components so the choice stays consistent.
export const useUniverse = () => {
  const [universe, setUniverse] = useState<Universe>(read);

  useEffect(() => {
    const sync = () => setUniverse(read());
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, []);

  const set = useCallback((next: Universe) => {
    try { localStorage.setItem(KEY, next); } catch { /* ignore */ }
    window.dispatchEvent(new Event(EVENT));
  }, []);

  const filter = useCallback((stocks: Stock[]) => (universe === 'top50' ? stocks.filter(s => TOP50.has(s.symbol)) : stocks), [universe]);

  return { universe, setUniverse: set, filter };
};
