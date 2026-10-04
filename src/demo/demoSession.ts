export const DEMO_USER_ID = '00000000-0000-4000-8000-0000000000de';

const b64 = (o: unknown) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const EXP = 4102444800; // year 2100

export const demoUser = {
  id: DEMO_USER_ID,
  aud: 'authenticated',
  role: 'authenticated',
  email: 'demo@tickerframe.app',
  email_confirmed_at: '2026-01-01T00:00:00Z',
  phone: '',
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: {},
  identities: [],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

export const demoSession = {
  access_token: `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: DEMO_USER_ID, role: 'authenticated', aud: 'authenticated', exp: EXP })}.demo`,
  token_type: 'bearer',
  expires_in: EXP,
  expires_at: EXP,
  refresh_token: 'demo-refresh',
  user: demoUser,
};

export const DEMO_STORAGE_KEY = 'tf-demo-auth';

// In-memory auth storage seeded with the demo session, so the app boots
// already "signed in" without touching real localStorage sessions.
export const createDemoAuthStorage = () => {
  const store = new Map<string, string>([[DEMO_STORAGE_KEY, JSON.stringify(demoSession)]]);
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
  };
};
