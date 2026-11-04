import { useCallback, useSyncExternalStore } from 'react';
import { getTheme, setTheme, subscribeTheme, type Theme } from '@/lib/theme';

export const useTheme = () => {
  const theme = useSyncExternalStore(subscribeTheme, getTheme, () => 'dark' as Theme);
  const toggle = useCallback(() => setTheme(getTheme() === 'dark' ? 'light' : 'dark'), []);
  return { theme, setTheme, toggle };
};
