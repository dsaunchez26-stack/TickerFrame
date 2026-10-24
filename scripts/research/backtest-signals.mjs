// Factor study: does a signal (the live rule's score, its parts, and common alternatives)
// predict how a stock does relative to the others over the next 5/20/60 trading days?
// Reports rank information coefficient (IC), an overlap-adjusted t-stat, and the
// top-minus-bottom-quintile spread, overall and by year.
//
//   node --max-old-space-size=4096 scripts/research/backtest-signals.mjs daily.json
//
// Input: JSON { SYMBOL: [[unixSeconds, open, high, low, close, volume], ...] } of daily
// bars (Alpaca IEX, split-adjusted), e.g. saved from the stock-bars function with a
// multi-year range. Result of the 10/23/2026 run (772 stocks, 2021-10 to 2026-10):
// every feature's IC was between about -0.03 and +0.03 with |t| < 2 -- no measurable edge,
// including the live score (IC -0.000 at 20 days). Caveats: survivorship (current
// listings only), daily bars instead of the live intraday samples, no trading costs.
import fs from 'node:fs';
const raw = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
// keep symbols with a full history; align on the most common date set
const dateCount = new Map();
for (const s of Object.keys(raw)) for (const b of raw[s]) dateCount.set(b[0], (dateCount.get(b[0]) ?? 0) + 1);
const nSyms = Object.keys(raw).length;
const dates = [...dateCount.entries()].filter(([, n]) => n > nSyms * 0.8).map(([t]) => t).sort((a, b) => a - b);
const idx = new Map(dates.map((t, i) => [t, i]));
const T = dates.length;
const syms = Object.keys(raw).filter((s) => raw[s].length > T * 0.95);
const C = {}, Hh = {};
for (const s of syms) {
  const c = new Array(T).fill(NaN), h = new Array(T).fill(NaN);
  for (const b of raw[s]) { const i = idx.get(b[0]); if (i != null) { c[i] = b[4]; h[i] = b[2]; } }
  for (let i = 1; i < T; i++) if (!(c[i] > 0)) { c[i] = c[i - 1]; h[i] = h[i - 1]; } // forward-fill gaps
  C[s] = c; Hh[s] = h;
}
console.log(`symbols ${syms.length}, trading days ${T}, ${new Date(dates[0] * 1000).toISOString().slice(0, 10)} -> ${new Date(dates[T - 1] * 1000).toISOString().slice(0, 10)}`);

const ema = (v, p) => { const k = 2 / (p + 1); const o = new Array(v.length); o[0] = v[0]; for (let i = 1; i < v.length; i++) o[i] = v[i] * k + o[i - 1] * (1 - k); return o; };
const pre = (v) => { const o = new Array(v.length + 1).fill(0); for (let i = 0; i < v.length; i++) o[i + 1] = o[i] + (Number.isFinite(v[i]) ? v[i] : 0); return o; };
const F = {}; // sym -> feature -> array
const START = 260;
for (const s of syms) {
  const c = C[s], n = T;
  const pc = pre(c), pc2 = pre(c.map((x) => x * x));
  const ret = c.map((x, i) => (i ? x / c[i - 1] - 1 : 0));
  const pr = pre(ret), pr2 = pre(ret.map((x) => x * x));
  const gain = ret.map((x, i) => (i && x > 0 ? c[i] - c[i - 1] : 0)), loss = ret.map((x, i) => (i && x < 0 ? c[i - 1] - c[i] : 0));
  const pg = pre(gain), pl = pre(loss);
  const e9 = ema(c, 9), e12 = ema(c, 12), e26 = ema(c, 26); const macd = e12.map((x, i) => x - e26[i]); const sig = ema(macd, 9);
  const f = {}; const names = ['current_score', 'trend_only', 'stretch_only', 'trend_pts', 'ema_pts', 'macd_pts', 'rsi_pts', 'bb_pts', 'mom_5', 'mom_21', 'mom_63_21', 'mom_126_21', 'mom_252_21', 'rev_5', 'rev_21', 'lowvol_60', 'near_high_252', 'dist_sma200', 'rsi_rev'];
  for (const k of names) f[k] = new Array(n).fill(NaN);
  const win = (p, i, w) => (p[i + 1] - p[i + 1 - w]);
  for (let i = START; i < n; i++) {
    const price = c[i], s20 = win(pc, i, 20) / 20, v20 = win(pc2, i, 20) / 20 - s20 * s20, sd = Math.sqrt(Math.max(v20, 0));
    const tp = price > s20 ? 2 : price < s20 ? -2 : 0, ep = e9[i] > s20 ? 1 : e9[i] < s20 ? -1 : 0;
    const hist = macd[i] - sig[i], mp = hist > 0 ? 2 : hist < 0 ? -2 : 0;
    const g = win(pg, i, 14), l = win(pl, i, 14); const r = g === 0 && l === 0 ? 50 : l === 0 ? 100 : 100 - 100 / (1 + g / l);
    const rp = r <= 30 ? 2 : r >= 70 ? -2 : 0;
    const bpb = sd === 0 ? 0.5 : (price - (s20 - 2 * sd)) / (4 * sd), bp = bpb <= 0.05 ? 1 : bpb >= 0.95 ? -1 : 0;
    f.current_score[i] = tp + ep + mp + rp + bp; f.trend_only[i] = tp + ep + mp; f.stretch_only[i] = rp + bp;
    f.trend_pts[i] = tp; f.ema_pts[i] = ep; f.macd_pts[i] = mp; f.rsi_pts[i] = rp; f.bb_pts[i] = bp; f.rsi_rev[i] = 50 - r;
    f.mom_5[i] = price / c[i - 5] - 1; f.mom_21[i] = price / c[i - 21] - 1;
    f.mom_63_21[i] = c[i - 21] / c[i - 63] - 1; f.mom_126_21[i] = c[i - 21] / c[i - 126] - 1; f.mom_252_21[i] = c[i - 21] / c[i - 252] - 1;
    f.rev_5[i] = -f.mom_5[i]; f.rev_21[i] = -f.mom_21[i];
    const m60 = win(pr, i, 60) / 60, v60 = win(pr2, i, 60) / 60 - m60 * m60; f.lowvol_60[i] = -Math.sqrt(Math.max(v60, 0));
    let hi = 0; for (let j = i - 251; j <= i; j++) if (Hh[s][j] > hi) hi = Hh[s][j]; f.near_high_252[i] = price / hi - 1;
    f.dist_sma200[i] = price / (win(pc, i, 200) / 200) - 1;
  }
  F[s] = f;
}
const names = Object.keys(F[syms[0]]);
const rank = (a) => { const o = a.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]); const r = new Array(a.length); let i = 0; while (i < o.length) { let j = i; while (j + 1 < o.length && o[j + 1][0] === o[i][0]) j++; const avg = (i + j) / 2; for (let k = i; k <= j; k++) r[o[k][1]] = avg; i = j + 1; } return r; };
const corr = (a, b) => { const n = a.length; let ma = 0, mb = 0; for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i]; } ma /= n; mb /= n; let nu = 0, da = 0, db = 0; for (let i = 0; i < n; i++) { nu += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; } return da && db ? nu / Math.sqrt(da * db) : 0; };
const mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
const sdv = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((x) => (x - m) ** 2))); };
const H = [5, 20, 60];
const acc = {}; // name -> h -> [{y, ic, spread}]
for (let t = START; t < T - 5; t += 1) {
  const year = new Date(dates[t] * 1000).getUTCFullYear();
  for (const h of H) {
    if (t + h >= T) continue;
    const fw = syms.map((s) => C[s][t + h] / C[s][t] - 1);
    const mu = mean(fw); const ex = fw.map((x) => x - mu); const rex = rank(ex);
    for (const k of names) {
      const x = syms.map((s) => F[s][k][t]); if (x.some((v) => !Number.isFinite(v))) continue;
      const ic = corr(rank(x), rex);
      const ord = x.map((v, i) => [v, ex[i]]).sort((a, b) => a[0] - b[0]); const q = Math.floor(ord.length / 5);
      const sp = mean(ord.slice(-q).map((z) => z[1])) - mean(ord.slice(0, q).map((z) => z[1]));
      ((acc[k] ??= {})[h] ??= []).push({ y: year, ic, sp });
    }
  }
}
const pad = (s, n) => String(s).padStart(n);
console.log('\nOVERALL  IC (rank corr with excess return), t-stat (overlap-adjusted), top-minus-bottom-quintile % spread');
console.log('feature'.padEnd(16), H.map((h) => `IC${h}`.padStart(8) + `  t${h}`.padStart(7) + ` Q5-Q1_${h}%`.padStart(12)).join(''));
const rows = names.map((k) => ({ k, v: H.map((h) => { const a = acc[k][h]; const ics = a.map((z) => z.ic); return { ic: mean(ics), t: (mean(ics) / (sdv(ics) || 1)) * Math.sqrt(ics.length / h), sp: mean(a.map((z) => z.sp)) * 100 }; }) }));
rows.sort((a, b) => b.v[1].t - a.v[1].t);
for (const r of rows) console.log(r.k.padEnd(16), r.v.map((x) => pad(x.ic.toFixed(3), 8) + pad(x.t.toFixed(1), 7) + pad(x.sp.toFixed(2), 12)).join(''));
console.log('\nBY YEAR  mean IC at 20-day horizon (is the sign stable?)');
const years = [...new Set(acc.current_score[20].map((z) => z.y))].sort();
console.log('feature'.padEnd(16), years.map((y) => String(y).padStart(8)).join(''));
for (const k of ['current_score', 'trend_only', 'stretch_only', 'rsi_pts', 'mom_126_21', 'mom_252_21', 'rev_21', 'lowvol_60', 'near_high_252', 'dist_sma200']) {
  console.log(k.padEnd(16), years.map((y) => pad(mean(acc[k][20].filter((z) => z.y === y).map((z) => z.ic)).toFixed(3), 8)).join(''));
}
