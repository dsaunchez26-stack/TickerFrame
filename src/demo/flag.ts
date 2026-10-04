// Demo mode is switched on per browser tab with ?demo=1 (and off with
// ?demo=0), so one deployed site can serve both the live app and a demo link
// without a separate project or build.
const KEY = 'tf_demo';

export const isDemoMode = (): boolean => {
  try {
    const param = new URLSearchParams(window.location.search).get('demo');
    if (param === '1') sessionStorage.setItem(KEY, '1');
    if (param === '0') sessionStorage.removeItem(KEY);
    return sessionStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
};

export const exitDemo = () => {
  try { sessionStorage.removeItem(KEY); sessionStorage.removeItem('tf_demo_user_data'); } catch { /* ignore */ }
  window.location.href = `${window.location.pathname}?demo=0`;
};
