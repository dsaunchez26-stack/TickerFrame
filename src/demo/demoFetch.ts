// A tiny stand-in for the Supabase backend, used only in demo mode. It
// answers the same HTTP calls supabase-js makes (PostgREST queries, edge
// functions, auth) from a bundled snapshot of real data, so every page in the
// app runs unchanged. Writes (portfolio, tracked picks, ...) are kept in
// memory for the tab.
import snapshot from './snapshot.json';
import { demoSession, demoUser, DEMO_USER_ID } from './demoSession';

type Row = Record<string, unknown>;
const snap = snapshot as unknown as {
  generatedAt: string;
  tables: Record<string, Row[]>;
  optionsAggregate: unknown;
  bestPuts: unknown;
  signalTrackRecord: unknown;
  futures: unknown;
};

const USER_DATA_KEY = 'tf_demo_user_data';
// Tables the viewer can write to; everything else is read-only snapshot data.
const USER_TABLES = [
  'portfolio', 'option_tracked_picks', 'futures_positions', 'portfolio_snapshots', 'alerts',
  'user_notification_settings', 'user_onboarding_state', 'chat_conversations', 'chat_messages', 'error_logs', 'sent_alerts',
];
const PRIMARY_KEYS: Record<string, string[]> = {
  user_notification_settings: ['user_id'],
  user_onboarding_state: ['user_id'],
};

const userData: Record<string, Row[]> = (() => {
  try {
    const saved = sessionStorage.getItem(USER_DATA_KEY);
    if (saved) return JSON.parse(saved);
  } catch { /* fall through to seed */ }
  return {
    user_onboarding_state: [{ user_id: DEMO_USER_ID, last_seen_at: new Date().toISOString(), dismissed_forever: true }],
  };
})();
const persistUserData = () => { try { sessionStorage.setItem(USER_DATA_KEY, JSON.stringify(userData)); } catch { /* ignore */ } };

const tableRows = (table: string): Row[] => {
  if (USER_TABLES.includes(table)) return (userData[table] ??= []);
  return snap.tables[table] ?? [];
};

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

// ---- PostgREST filter / order emulation -----------------------------------

const isDateLike = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v);

// The snapshot's newest market data is older than "now", so any time window
// the app computes from the current clock (last day, last week, ...) would
// land after the data and come back empty. Date filters on snapshot tables
// are shifted back by this skew, which anchors "now" to the snapshot's last
// price sample instead.
const lastSample = (snap.tables.stock_price_history ?? []).reduce((m, r) => Math.max(m, Date.parse(String(r.recorded_at))), 0);
const SKEW_MS = lastSample ? Math.max(Date.now() - lastSample, 0) : 0;

const compare = (a: unknown, b: string, skew = 0): number => {
  if (typeof a === 'number') return a - Number(b);
  if (isDateLike(a) && isDateLike(b)) return Date.parse(a) - (Date.parse(b) - skew);
  return String(a).localeCompare(b);
};

const splitList = (inner: string): string[] => {
  const out: string[] = [];
  let cur = '', quoted = false;
  for (const ch of inner) {
    if (ch === '"') { quoted = !quoted; continue; }
    if (ch === ',' && !quoted) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur);
  return out;
};

const likeToRegex = (pattern: string, flags: string) =>
  new RegExp(`^${pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/\*/g, '.*')}$`, flags);

const matches = (row: Row, col: string, expr: string, skew = 0): boolean => {
  let negate = false;
  let rest = expr;
  if (rest.startsWith('not.')) { negate = true; rest = rest.slice(4); }
  const dot = rest.indexOf('.');
  const op = rest.slice(0, dot);
  const val = rest.slice(dot + 1);
  const v = row[col];
  let result: boolean;
  switch (op) {
    case 'eq': result = v === null || v === undefined ? false : typeof v === 'boolean' ? String(v) === val : compare(v, val) === 0; break;
    case 'neq': result = v === null || v === undefined ? true : compare(v, val) !== 0; break;
    case 'gt': result = v != null && compare(v, val, skew) > 0; break;
    case 'gte': result = v != null && compare(v, val, skew) >= 0; break;
    case 'lt': result = v != null && compare(v, val, skew) < 0; break;
    case 'lte': result = v != null && compare(v, val, skew) <= 0; break;
    case 'in': result = splitList(val.replace(/^\(|\)$/g, '')).some((x) => v != null && compare(v, x) === 0); break;
    case 'is': result = val === 'null' ? v == null : val === 'true' ? v === true : val === 'false' ? v === false : false; break;
    case 'like': result = typeof v === 'string' && likeToRegex(val, '').test(v); break;
    case 'ilike': result = typeof v === 'string' && likeToRegex(val, 'i').test(v); break;
    default: result = true;
  }
  return negate ? !result : result;
};

const RESERVED = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns']);

const filterRows = (rows: Row[], params: URLSearchParams, skew = 0): Row[] => {
  const filters = [...params.entries()].filter(([k]) => !RESERVED.has(k) && k !== 'or' && k !== 'and');
  return rows.filter((row) => filters.every(([col, expr]) => matches(row, col, expr, skew)));
};

const sortRows = (rows: Row[], order: string | null): Row[] => {
  if (!order) return rows;
  const keys = order.split(',').map((part) => {
    const [col, ...mods] = part.split('.');
    return { col, desc: mods.includes('desc'), nullsFirst: mods.includes('nullsfirst') ? true : mods.includes('nullslast') ? false : mods.includes('desc') };
  });
  return [...rows].sort((a, b) => {
    for (const k of keys) {
      const av = a[k.col], bv = b[k.col];
      if (av == null && bv == null) continue;
      if (av == null) return k.nullsFirst ? -1 : 1;
      if (bv == null) return k.nullsFirst ? 1 : -1;
      const c = typeof av === 'number' && typeof bv === 'number' ? av - bv : isDateLike(av) && isDateLike(bv) ? Date.parse(av) - Date.parse(bv) : String(av).localeCompare(String(bv));
      if (c !== 0) return k.desc ? -c : c;
    }
    return 0;
  });
};

const project = (rows: Row[], select: string | null): Row[] => {
  if (!select || select === '*' || select.includes('(') || select.includes('*')) return rows;
  const cols = select.split(',').map((c) => c.trim().split(':').pop()!.trim()).filter(Boolean);
  return rows.map((r) => Object.fromEntries(cols.map((c) => [c, r[c]])));
};

const withDefaults = (table: string, row: Row): Row => {
  const now = new Date().toISOString();
  const out: Row = { ...row };
  const keyedById = !PRIMARY_KEYS[table] && table !== 'portfolio_snapshots';
  if (keyedById && out.id === undefined) out.id = crypto.randomUUID();
  if (table === 'portfolio_snapshots' && out.id === undefined) out.id = crypto.randomUUID();
  if (out.created_at === undefined) out.created_at = now;
  return out;
};

const handleRest = async (table: string, method: string, url: URL, headers: Headers, bodyText: string | null): Promise<Response> => {
  const params = url.searchParams;
  const prefer = headers.get('Prefer') ?? '';
  const wantsRepresentation = prefer.includes('return=representation');
  const wantsSingle = (headers.get('Accept') ?? '').includes('vnd.pgrst.object+json');
  const respondRows = (rows: Row[], status: number) => {
    if (wantsSingle) {
      if (rows.length !== 1) return json({ code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: `The result contains ${rows.length} rows`, hint: null }, 406);
      return json(rows[0], status);
    }
    return json(rows, status);
  };

  if (method === 'GET' || method === 'HEAD') {
    const matched = sortRows(filterRows(tableRows(table), params, USER_TABLES.includes(table) ? 0 : SKEW_MS), params.get('order'));
    const total = matched.length;
    const offset = Number(params.get('offset') ?? 0);
    const limit = params.has('limit') ? Number(params.get('limit')) : undefined;
    const page = project(matched.slice(offset, limit === undefined ? undefined : offset + limit), params.get('select'));
    const range = page.length ? `${offset}-${offset + page.length - 1}/${total}` : `*/${total}`;
    if (method === 'HEAD') return new Response(null, { status: 200, headers: { 'Content-Range': range } });
    const res = respondRows(page, 200);
    if (prefer.includes('count=')) res.headers.set('Content-Range', range);
    return res;
  }

  const body = bodyText ? JSON.parse(bodyText) : null;
  const rows = tableRows(table);

  if (method === 'POST') {
    const incoming: Row[] = (Array.isArray(body) ? body : [body]).map((r: Row) => withDefaults(table, r));
    const upsert = prefer.includes('resolution=merge-duplicates') || prefer.includes('resolution=ignore-duplicates');
    const keys = (params.get('on_conflict')?.split(',') ?? PRIMARY_KEYS[table] ?? ['id']);
    const saved: Row[] = [];
    for (const r of incoming) {
      const existing = upsert ? rows.find((x) => keys.every((k) => x[k] !== undefined && x[k] === r[k])) : undefined;
      if (existing) {
        if (prefer.includes('resolution=merge-duplicates')) Object.assign(existing, r);
        saved.push(existing);
      } else {
        rows.push(r);
        saved.push(r);
      }
    }
    persistUserData();
    return wantsRepresentation ? respondRows(project(saved, params.get('select')), 201) : new Response(null, { status: 201 });
  }

  const targets = filterRows(rows, params);
  if (method === 'PATCH') {
    for (const r of targets) Object.assign(r, body);
    persistUserData();
    return wantsRepresentation ? respondRows(project(targets, params.get('select')), 200) : new Response(null, { status: 204 });
  }
  if (method === 'DELETE') {
    for (const r of targets) rows.splice(rows.indexOf(r), 1);
    persistUserData();
    return wantsRepresentation ? respondRows(project(targets, params.get('select')), 200) : new Response(null, { status: 204 });
  }
  return json({ message: 'Unsupported in demo' }, 405);
};

// ---- Edge functions ---------------------------------------------------------

const sse = (text: string) => {
  const enc = new TextEncoder();
  const words = text.split(/(\s+)/);
  return new Response(new ReadableStream({
    async start(controller) {
      for (const w of words) {
        controller.enqueue(enc.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: w } }] })}\n\n`));
        await new Promise((r) => setTimeout(r, 15));
      }
      controller.enqueue(enc.encode('data: [DONE]\n\n'));
      controller.close();
    },
  }), { headers: { 'Content-Type': 'text/event-stream' } });
};

const handleFunction = async (name: string, bodyText: string | null): Promise<Response> => {
  const body = bodyText ? (() => { try { return JSON.parse(bodyText); } catch { return {}; } })() : {};
  switch (name) {
    case 'options-scanner': return json(snap.optionsAggregate);
    case 'futures-scanner': return json(snap.futures);
    case 'fetch-portfolio-quotes': {
      const bySymbol = new Map(snap.tables.stock_cache.map((r) => [r.symbol as string, r]));
      const quotes: Record<string, unknown> = {};
      for (const sym of (body.symbols ?? []) as string[]) {
        const r = bySymbol.get(sym);
        if (r) quotes[sym] = { price: Number(r.price), prevClose: Number(r.prev_close), changePercent: Number(r.change_percent), name: r.name };
      }
      return json({ quotes });
    }
    case 'option-quotes': return json({ quotes: [] });
    case 'option-chain-lookup': return json({ error: "Live option chain lookup isn't available in the demo snapshot - it works on the live site." }, 200);
    case 'fundamentals-scanner':
    case 'insider-scanner':
    case 'realized-volatility-scanner': return json({ ok: true, demo: true, message: 'Demo snapshot - data refresh is disabled.' });
    case 'admin-list-users': return json({ users: [] });
    case 'market-chat':
      return sse("The AI assistant is switched off in this demo, since the demo runs on a saved snapshot with no live backend. On the live site it answers questions about the stocks, signals and options data you see here.");
    default: return json({ error: `${name} is not available in the demo` }, 404);
  }
};

// ---- Router ----------------------------------------------------------------

export const demoFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const req = input instanceof Request ? input : null;
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
  const method = (init?.method ?? req?.method ?? 'GET').toUpperCase();
  const headers = new Headers(init?.headers ?? req?.headers);
  const rawBody = init?.body ?? (req ? await req.clone().text() : null);
  const bodyText = typeof rawBody === 'string' ? rawBody : null;

  if (method === 'OPTIONS') return new Response(null, { status: 204 });

  if (url.pathname.startsWith('/rest/v1/rpc/')) {
    const fn = url.pathname.slice('/rest/v1/rpc/'.length);
    if (fn === 'get_best_puts') return json(snap.bestPuts);
    if (fn === 'signal_track_record') return json(snap.signalTrackRecord);
    return json({ message: `${fn} unavailable in demo` }, 404);
  }
  if (url.pathname.startsWith('/rest/v1/')) {
    return handleRest(url.pathname.slice('/rest/v1/'.length), method, url, headers, bodyText);
  }
  if (url.pathname.startsWith('/functions/v1/')) {
    return handleFunction(url.pathname.slice('/functions/v1/'.length), bodyText);
  }
  if (url.pathname.startsWith('/auth/v1/')) {
    const path = url.pathname.slice('/auth/v1/'.length);
    if (path === 'user') return json(demoUser);
    if (path === 'logout') return new Response(null, { status: 204 });
    if (path === 'token' || path === 'signup') return json(demoSession);
    return json({});
  }
  return json({ message: 'Not available in demo' }, 404);
};

export const demoGeneratedAt = snap.generatedAt;
