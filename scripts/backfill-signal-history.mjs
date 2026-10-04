// Replays the current signal rule over the price samples already stored in
// stock_price_history, one call per symbol per trading day (the day's last
// sample, using the 60 samples before it), and stores them as source='replay'
// in signal_history. Replay rows are a backtest, never mixed with 'live' rows.
//   node scripts/backfill-signal-history.mjs
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const q = (args) => execFileSync('npx', ['supabase', 'db', 'query', '--linked', ...args], { maxBuffer: 1 << 30, encoding: 'utf8' });
const rows = JSON.parse((() => { const o = q(["select symbol, json_agg(json_build_array(recorded_at, price) order by recorded_at) as p from stock_price_history group by symbol"]); return o.slice(o.indexOf('{'), o.lastIndexOf('}') + 1); })()).rows;

// --- mirrors supabase/functions/fetch-stock-data/index.ts ---
const sma = (v, p) => { const s = v.slice(-p); return s.length ? s.reduce((a, b) => a + b, 0) / s.length : 0; };
const ema = (v, p) => { if (!v.length) return 0; const k = 2 / (p + 1); let e = v[0]; for (let i = 1; i < v.length; i++) e = v[i] * k + e * (1 - k); return e; };
const rsi = (v, p = 14) => { if (v.length < p + 1) return 50; let g = 0, l = 0; for (let i = v.length - p; i < v.length; i++) { const d = v[i] - v[i - 1]; if (d >= 0) g += d; else l -= d; } const ag = g / p, al = l / p; if (ag === 0 && al === 0) return 50; if (al === 0) return 100; return 100 - 100 / (1 + ag / al); };
const emaSeries = (v, p) => { if (!v.length) return []; const k = 2 / (p + 1); const o = [v[0]]; for (let i = 1; i < v.length; i++) o.push(v[i] * k + o[i - 1] * (1 - k)); return o; };
const macdHist = (v) => { const a = emaSeries(v, 12), b = emaSeries(v, 26); const m = a.map((x, i) => x - b[i]); const s = emaSeries(m, 9); const l = m.length - 1; return l >= 0 ? m[l] - s[l] : 0; };
const pctB = (v, p = 20, n = 2) => { const s = v.slice(-p); if (s.length < p) return null; const m = s.reduce((a, b) => a + b, 0) / p; const sd = Math.sqrt(s.reduce((a, b) => a + (b - m) ** 2, 0) / p); const u = m + n * sd, lo = m - n * sd; return u === lo ? null : (s[s.length - 1] - lo) / (u - lo); };
const points = (price, s20, e9, r, h, b) => { let p = 0; p += price > s20 ? 2 : price < s20 ? -2 : 0; p += e9 > s20 ? 1 : e9 < s20 ? -1 : 0; p += h > 0 ? 2 : h < 0 ? -2 : 0; p += r <= 30 ? 2 : r >= 70 ? -2 : 0; if (b !== null) p += b <= 0.05 ? 1 : b >= 0.95 ? -1 : 0; return p; };

const nyDate = (ts) => new Date(ts).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
const nyDay = (ts) => new Date(new Date(ts).toLocaleString('en-US', { timeZone: 'America/New_York' })).getDay();

const out = [];
for (const { symbol, p } of rows) {
  const samples = p.map(([t, price]) => ({ t, price: Number(price) }));
  const lastIdxByDay = new Map();
  samples.forEach((s, i) => { const d = nyDay(s.t); if (d !== 0 && d !== 6) lastIdxByDay.set(nyDate(s.t), i); });
  for (const [date, i] of lastIdxByDay) {
    if (i < 20) continue;
    const prior = samples.slice(Math.max(0, i - 60), i).map((s) => s.price);
    const price = samples[i].price;
    const closes = [...prior, price];
    const s20 = sma(closes, 20) || price, e9 = ema(closes, 9) || price;
    const pts = points(price, s20, e9, rsi(closes), macdHist(closes), pctB(closes));
    out.push({ symbol, date, signal: pts >= 5 ? 'buy' : pts <= -5 ? 'sell' : 'hold', score: Math.round((pts / 9) * 100), price });
  }
}

const lines = [];
for (let i = 0; i < out.length; i += 400) {
  const vals = out.slice(i, i + 400).map((r) => `('${r.symbol.replace(/'/g, "''")}','${r.date}','${r.signal}',${r.score},${r.price},'replay')`).join(',');
  lines.push(`insert into public.signal_history (symbol, trade_date, signal, signal_score, price, source) values ${vals} on conflict do nothing;`);
}
fs.writeFileSync('/tmp/signal_replay.sql', lines.join('\n'));
console.log('replay rows:', out.length, 'dates:', [...new Set(out.map((r) => r.date))].sort().join(','));
q(['-f', '/tmp/signal_replay.sql']);
console.log('inserted');
