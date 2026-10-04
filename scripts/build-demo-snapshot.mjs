// Builds src/demo/snapshot.json: a point-in-time copy of this project's real
// data (read from the linked Supabase database) plus live quotes for the ETFs
// and futures, so the site can run in demo mode with no backend.
//   node scripts/build-demo-snapshot.mjs
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const q = (sql) => {
  const out = execFileSync('npx', ['supabase', 'db', 'query', '--linked', sql], { maxBuffer: 1 << 30, encoding: 'utf8' });
  const rows = JSON.parse(out.slice(out.indexOf('{'), out.lastIndexOf('}') + 1)).rows;
  return rows;
};
const agg = (sql) => q(`select coalesce(json_agg(t), '[]'::json) as j from (${sql}) t`)[0].j;

// --- indicator math: mirrors supabase/functions/fetch-stock-data/index.ts ---
const sma = (v, p) => { const s = v.slice(-p); return s.length ? s.reduce((a, b) => a + b, 0) / s.length : 0; };
const ema = (v, p) => { if (!v.length) return 0; const k = 2 / (p + 1); let e = v[0]; for (let i = 1; i < v.length; i++) e = v[i] * k + e * (1 - k); return e; };
const rsi = (v, p = 14) => {
  if (v.length < p + 1) return 50; let g = 0, l = 0;
  for (let i = v.length - p; i < v.length; i++) { const d = v[i] - v[i - 1]; if (d >= 0) g += d; else l -= d; }
  const ag = g / p, al = l / p; if (ag === 0 && al === 0) return 50; if (al === 0) return 100; return 100 - 100 / (1 + ag / al);
};
const emaSeries = (v, p) => { if (!v.length) return []; const k = 2 / (p + 1); const o = [v[0]]; for (let i = 1; i < v.length; i++) o.push(v[i] * k + o[i - 1] * (1 - k)); return o; };
const macdHist = (v) => { const a = emaSeries(v, 12), b = emaSeries(v, 26); const m = a.map((x, i) => x - b[i]); const s = emaSeries(m, 9); const l = m.length - 1; return l >= 0 ? m[l] - s[l] : 0; };
const pctB = (v, p = 20, n = 2) => { const s = v.slice(-p); if (s.length < p) return null; const m = s.reduce((a, b) => a + b, 0) / p; const sd = Math.sqrt(s.reduce((a, b) => a + (b - m) ** 2, 0) / p); const u = m + n * sd, lo = m - n * sd; return u === lo ? null : (s[s.length - 1] - lo) / (u - lo); };
const points = (price, s20, e9, r, h, b) => {
  let p = 0;
  p += price > s20 ? 2 : price < s20 ? -2 : 0; p += e9 > s20 ? 1 : e9 < s20 ? -1 : 0; p += h > 0 ? 2 : h < 0 ? -2 : 0;
  p += r <= 30 ? 2 : r >= 70 ? -2 : 0; if (b !== null) p += b <= 0.05 ? 1 : b >= 0.95 ? -1 : 0; return p;
};
const indicators = (closesIn, price) => {
  const closes = [...closesIn.slice(-60), price];
  const s20 = sma(closes, 20) || price, e9 = ema(closes, 9) || price, r = rsi(closes), h = macdHist(closes), b = pctB(closes);
  const pts = points(price, s20, e9, r, h, b);
  const signal = pts >= 5 ? 'buy' : pts <= -5 ? 'sell' : 'hold';
  return { signal, signal_score: Math.round((pts / 9) * 100), rsi: r, macd: ema(closes, 12) - ema(closes, 26), macd_histogram: h, sma20: s20, ema9: e9, bollinger_pct_b: b };
};

const yahoo = async (sym, range, interval) => {
  const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=${interval}&range=${range}`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!r.ok) throw new Error(`yahoo ${sym} ${r.status}`);
  const res = (await r.json()).chart.result[0];
  return { meta: res.meta, ts: res.timestamp ?? [], close: (res.indicators.quote[0].close ?? []), volume: (res.indicators.quote[0].volume ?? []) };
};

const symbolsSrc = fs.readFileSync('supabase/functions/_shared/symbols.ts', 'utf8');
const etfs = [...symbolsSrc.matchAll(/\{ symbol: "([A-Z.]+)", name: "([^"]+)", assetClass: "([^"]+)" \}/g)].map((m) => ({ symbol: m[1], name: m[2], assetClass: m[3] }));
const top50 = [...fs.readFileSync('src/lib/sp500Top50.ts', 'utf8').matchAll(/'([A-Z.]+)'/g)].map((m) => m[1]);

console.log('reading database...');
const stock_cache = agg('select * from stock_cache');
const hist = Object.fromEntries(
  q('select symbol, json_agg(price order by recorded_at) as p from stock_price_history group by symbol').map((r) => [r.symbol, r.p.map(Number)]),
);
for (const row of stock_cache) {
  const h = hist[row.symbol];
  Object.assign(row, { asset_class: 'Equity' }, h && h.length >= 20 ? indicators(h, Number(row.price)) : {});
}

const dailyRows = [];
const nowIso = new Date().toISOString();
console.log('fetching ETF + BRK.B history...');
const extra = [...etfs, ...(top50.includes('BRK.B') && !stock_cache.some((r) => r.symbol === 'BRK.B') ? [{ symbol: 'BRK.B', name: 'Berkshire Hathaway Inc Class B', assetClass: 'Equity', yahoo: 'BRK-B' }] : [])];
for (const e of extra) {
  const { meta, ts, close, volume } = await yahoo(e.yahoo ?? e.symbol, '6mo', '1d');
  const pairs = ts.map((t, i) => ({ t, c: close[i], v: volume[i] })).filter((p) => typeof p.c === 'number');
  const closes = pairs.map((p) => p.c);
  const price = closes[closes.length - 1], prev = closes[closes.length - 2];
  const ind = indicators(closes.slice(0, -1), price);
  const row = {
    symbol: e.symbol, name: e.name, price, change: price - prev, change_percent: ((price - prev) / prev) * 100,
    volume: pairs[pairs.length - 1].v ?? 0, entry: ind.signal === 'buy' ? price * 0.99 : price, exit_price: ind.signal === 'buy' ? price * 1.08 : price * 0.95,
    pattern: null, pattern_confidence: null, prev_close: prev, category: 'core', asset_class: e.assetClass, hold_duration: 'Swing', fetched_at: nowIso, ...ind,
  };
  const i = stock_cache.findIndex((r) => r.symbol === e.symbol);
  if (i >= 0) stock_cache[i] = { ...stock_cache[i], ...row }; else stock_cache.push(row);
  for (const p of pairs.slice(-30)) dailyRows.push({ symbol: e.symbol, trade_date: new Date(p.t * 1000).toISOString().slice(0, 10), close_price: p.c, volume: p.v ?? 0, updated_at: nowIso });
}

const chartSymbols = [...new Set([...top50, ...etfs.map((e) => e.symbol)])].filter((s) => hist[s]);
const inList = chartSymbols.map((s) => `'${s}'`).join(',');
console.log('reading price history for', chartSymbols.length, 'chart symbols...');
const stock_price_history = agg(`select * from stock_price_history where symbol in (${inList})`);
const daily_closes = [...agg(`select * from daily_closes where symbol in (${inList})`), ...dailyRows];

const regimeRow = q('select * from market_regime_cache limit 1')[0] ?? null;
const optionsAggregate = q('select payload from options_aggregate_cache limit 1')[0].payload;
if (regimeRow && !optionsAggregate.regime) {
  const stale = regimeRow.vix_as_of && (Date.now() - new Date(regimeRow.vix_as_of).getTime()) / 86400000 > 4;
  optionsAggregate.regime = {
    label: regimeRow.label, trend: regimeRow.trend, vix: regimeRow.vix == null ? null : Number(regimeRow.vix),
    description: [regimeRow.description, regimeRow.vix_as_of ? `VIX as of ${regimeRow.vix_as_of} close (FRED)${stale ? " -- FRED hasn't published a newer reading, VIX excluded from the trend below" : ''}` : null].filter(Boolean).join(' · '),
  };
}
const bestPuts = q('select get_best_puts() as j')[0].j;

console.log('fetching futures quotes...');
const SPECS = [
  ['ES', 'E-mini S&P 500', 'Equity Index', '/ESZ6', '2026-12-18', 0.25, 50, 50], ['NQ', 'E-mini Nasdaq 100', 'Equity Index', '/NQZ6', '2026-12-18', 0.25, 20, 20],
  ['YM', 'Mini Dow', 'Equity Index', '/YMZ6', '2026-12-18', 1, 5, 5], ['RTY', 'E-mini Russell 2000', 'Equity Index', '/RTYZ6', '2026-12-18', 0.1, 50, 50],
  ['CL', 'Crude Oil WTI', 'Energy', '/CLX6', '2026-10-20', 0.01, 1000, 1000], ['NG', 'Natural Gas', 'Energy', '/NGX6', '2026-10-28', 0.001, 10000, 10000],
  ['RB', 'RBOB Gasoline', 'Energy', '/RBX6', '2026-10-30', 0.0001, 42000, 42000], ['GC', 'Gold', 'Metals', '/GCZ6', '2026-12-29', 0.1, 100, 100],
  ['SI', 'Silver', 'Metals', '/SIZ6', '2026-12-29', 0.005, 5000, 5000], ['HG', 'Copper', 'Metals', '/HGZ6', '2026-12-29', 0.0005, 25000, 25000],
  ['ZN', '10-Year T-Note', 'Rates', '/ZNZ6', '2026-12-21', 0.015625, 100000, 1000], ['ZB', '30-Year T-Bond', 'Rates', '/ZBZ6', '2026-12-21', 0.03125, 100000, 1000],
  ['ZF', '5-Year T-Note', 'Rates', '/ZFZ6', '2026-12-31', 0.0078125, 100000, 1000], ['6E', 'Euro FX', 'Currencies', '/6EZ6', '2026-12-14', 0.00005, 125000, 125000],
  ['6J', 'Japanese Yen', 'Currencies', '/6JZ6', '2026-12-14', 5e-7, 12500000, 12500000], ['6B', 'British Pound', 'Currencies', '/6BZ6', '2026-12-14', 0.0001, 62500, 62500],
  ['ZC', 'Corn', 'Agriculture', '/ZCZ6', '2026-12-14', 0.25, 5000, 50], ['ZS', 'Soybeans', 'Agriculture', '/ZSX6', '2026-11-13', 0.25, 5000, 50], ['ZW', 'Wheat', 'Agriculture', '/ZWZ6', '2026-12-14', 0.25, 5000, 50],
];
const futureRows = [];
for (const [code, name, sector, symbol, expiration, tickSize, contractSize, notionalMultiplier] of SPECS) {
  const { meta } = await yahoo(`${code}=F`, '1d', '1d');
  const last = meta.regularMarketPrice, prevClose = meta.chartPreviousClose, change = last - prevClose;
  futureRows.push({ code, name, sector, symbol, exchange: 'CME', expiration, tickSize, contractSize, notionalMultiplier, last, bid: null, ask: null, dayHigh: meta.regularMarketDayHigh ?? null, dayLow: meta.regularMarketDayLow ?? null, volume: meta.regularMarketVolume ?? null, prevClose, change, changePercent: (change / prevClose) * 100, updatedAt: meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : null });
}

const snapshot = {
  generatedAt: nowIso,
  tables: {
    stock_cache, stock_fundamentals: agg('select * from stock_fundamentals'), realized_volatility: agg('select * from realized_volatility'),
    insider_activity: agg('select * from insider_activity'), earnings_calendar: agg('select * from earnings_calendar'),
    cron_runs: agg('select * from cron_runs order by ran_at desc limit 300'), stock_price_history, daily_closes,
  },
  optionsAggregate, bestPuts,
  futures: { rows: futureRows, quotesError: null, missingProducts: [], source: 'demo-snapshot', fetchedAt: nowIso },
};
fs.writeFileSync('src/demo/snapshot.json', JSON.stringify(snapshot));
const dist = {}; for (const r of stock_cache) dist[r.signal] = (dist[r.signal] ?? 0) + 1;
console.log('wrote src/demo/snapshot.json', (fs.statSync('src/demo/snapshot.json').size / 1e6).toFixed(2), 'MB; signals', JSON.stringify(dist), '; stock_cache rows', stock_cache.length);
