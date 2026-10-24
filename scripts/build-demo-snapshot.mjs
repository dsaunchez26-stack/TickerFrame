// Builds the demo's data from this project's live database plus a few live
// provider calls, so the site can run in demo mode with no backend:
//   src/demo/snapshot.json - tables, options, futures, track record (one lazy chunk)
//   src/demo/bars.json     - real OHLC candles for the Top 50 and the ETFs (lazy, loaded on first chart)
//   node scripts/build-demo-snapshot.mjs
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { trimSnapshot } from './trim-demo-snapshot.mjs';

const env = Object.fromEntries(fs.readFileSync('.env', 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')]; }));
const FN = `${env.VITE_SUPABASE_URL}/functions/v1`;
const callFn = async (name, body) => {
  const r = await fetch(`${FN}/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: env.VITE_SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${name} ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
};

const q = (sql) => {
  const out = execFileSync('npx', ['supabase', 'db', 'query', '--linked', sql], { maxBuffer: 1 << 30, encoding: 'utf8' });
  const rows = JSON.parse(out.slice(out.indexOf('{'), out.lastIndexOf('}') + 1)).rows;
  return rows;
};
const agg = (sql) => q(`select coalesce(json_agg(t), '[]'::json) as j from (${sql}) t`)[0].j;

const symbolsSrc = fs.readFileSync('supabase/functions/_shared/symbols.ts', 'utf8');
const etfs = [...symbolsSrc.matchAll(/\{ symbol: "([A-Z.]+)", name: "([^"]+)", assetClass: "([^"]+)" \}/g)].map((m) => ({ symbol: m[1], name: m[2], assetClass: m[3] }));
const top50 = [...fs.readFileSync('src/lib/sp500Top50.ts', 'utf8').matchAll(/'([A-Z.]+)'/g)].map((m) => m[1]);
const nowIso = new Date().toISOString();

console.log('reading database (live readings, fundamentals, options, track record)...');
const stock_cache = agg('select * from stock_cache');
const chartSymbols = [...new Set([...top50, ...etfs.map((e) => e.symbol)])].filter((s) => stock_cache.some((r) => r.symbol === s));
const inList = chartSymbols.map((s) => `'${s}'`).join(',');
const stock_price_history = agg(`select * from stock_price_history where symbol in (${inList}) and recorded_at > now() - interval '8 days'`);
const daily_closes = agg(`select * from daily_closes where symbol in (${inList})`);

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
const signalTrackRecord = q('select signal_track_record() as j')[0].j;

console.log('fetching live futures...');
const fut = await callFn('futures-scanner', {});
const futures = { rows: fut.rows ?? [], quotesError: fut.quotesError ?? null, missingProducts: fut.missingProducts ?? [], source: 'demo-snapshot', fetchedAt: nowIso };
if (!futures.rows.length) throw new Error('futures-scanner returned no rows');

console.log('fetching real candles for', chartSymbols.length, 'symbols (this takes a couple of minutes)...');
const RANGES = ['1D', '3D', '1W', '1Y'];
const bars = {};
const queue = [...chartSymbols];
const worker = async () => {
  while (queue.length) {
    const sym = queue.shift();
    bars[sym] = {};
    for (const range of RANGES) {
      try {
        const res = await callFn('stock-bars', { symbol: sym, range });
        const rows = (res.bars ?? []).map((b) => [Math.floor(Date.parse(b.t) / 1000), b.o, b.h, b.l, b.c, b.v]);
        if (rows.length >= 2) bars[sym][range] = rows;
      } catch (e) { console.log('  skip', sym, range, String(e.message).slice(0, 80)); }
    }
    if (!Object.keys(bars[sym]).length) delete bars[sym];
  }
};
await Promise.all([worker(), worker(), worker()]);
fs.writeFileSync('src/demo/bars.json', JSON.stringify(bars));

const snapshot = {
  generatedAt: nowIso,
  tables: {
    stock_cache, stock_fundamentals: agg('select * from stock_fundamentals'), realized_volatility: agg('select * from realized_volatility'),
    insider_activity: agg('select * from insider_activity'), earnings_calendar: agg('select * from earnings_calendar'),
    cron_runs: agg('select * from cron_runs order by ran_at desc limit 300'), stock_price_history, daily_closes,
    backtest_results: agg('select * from backtest_results order by run_at desc limit 1'),
  },
  optionsAggregate, bestPuts, signalTrackRecord, futures,
};
fs.writeFileSync('src/demo/snapshot.json', JSON.stringify(trimSnapshot(snapshot)));
const dist = {}; for (const r of stock_cache) dist[r.signal] = (dist[r.signal] ?? 0) + 1;
console.log('wrote snapshot', (fs.statSync('src/demo/snapshot.json').size / 1e6).toFixed(2), 'MB and bars', (fs.statSync('src/demo/bars.json').size / 1e6).toFixed(2), 'MB (', Object.keys(bars).length, 'symbols); signals', JSON.stringify(dist), '; stock_cache rows', stock_cache.length);
