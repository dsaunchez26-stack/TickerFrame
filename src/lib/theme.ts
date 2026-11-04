export type Theme = 'dark' | 'light';

const KEY = 'tf_theme';
const EVENT = 'tf-theme-change';

export const getTheme = (): Theme =>
  typeof document !== 'undefined' && document.documentElement.classList.contains('light') ? 'light' : 'dark';

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const apply = (theme: Theme) => {
  const root = document.documentElement;
  root.classList.toggle('light', theme === 'light');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#f7f8f7' : '#090b0a');
  try { localStorage.setItem(KEY, theme); } catch { /* storage can be blocked; the choice just won't persist */ }
  window.dispatchEvent(new Event(EVENT));
};

// Switch themes with a fade: the browser cross-fades the whole page where it
// supports view transitions, otherwise colours transition for half a second.
export const setTheme = (theme: Theme) => {
  if (theme === getTheme()) return;
  if (reducedMotion()) { apply(theme); return; }
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  if (doc.startViewTransition) {
    doc.startViewTransition(() => apply(theme));
    return;
  }
  const root = document.documentElement;
  root.classList.add('theme-fade');
  apply(theme);
  window.setTimeout(() => root.classList.remove('theme-fade'), 600);
};

export const subscribeTheme = (cb: () => void) => {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
};
