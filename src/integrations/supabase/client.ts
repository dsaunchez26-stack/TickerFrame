import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { isDemoMode } from '@/demo/flag';
import { createDemoAuthStorage, DEMO_STORAGE_KEY } from '@/demo/demoSession';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// import { supabase } from "@/integrations/supabase/client";

// Demo mode (?demo=1): every request to the Supabase host is answered from a
// bundled snapshot instead of the network. The snapshot module is loaded on
// first use, so regular visitors never download it.
const demo = isDemoMode();
if (demo) {
  const realFetch = window.fetch.bind(window);
  let handler: Promise<typeof import('@/demo/demoFetch')> | null = null;
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (href.startsWith(SUPABASE_URL)) {
      handler ??= import('@/demo/demoFetch');
      return handler.then((m) => m.demoFetch(input, init));
    }
    return realFetch(input, init);
  };
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: demo
    ? { storage: createDemoAuthStorage(), storageKey: DEMO_STORAGE_KEY, persistSession: true, autoRefreshToken: false, detectSessionInUrl: false }
    : { storage: localStorage, persistSession: true, autoRefreshToken: true },
});
