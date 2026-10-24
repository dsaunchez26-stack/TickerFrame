// Reusable studies behind the quarterly evaluation (see run-quarterly-evaluation.mjs).
// All three answer the same question: does a signal predict how a stock does
// *relative to other stocks* over the next few weeks or months?
//   factorStudy      - the live score, its pillars and common alternatives (daily bars)
//   insiderStudy     - open-market insider purchases (Form 4, code P)
//   fundamentalsStudy- Balance Sheet / Growth scores, from weekly snapshots we keep
// Input bars: { SYMBOL: [[unixSeconds, open, high, low, close, volume], ...] }, daily, split-adjusted.

const mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
const sdv = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((x) => (x - m) ** 2))); };
const rank = (a) => { const o = a.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]); const r = new Array(a.length); let i = 0; while (i < o.length) { let j = i; while (j + 1 < o.length && o[j + 1][0] === o[i][0]) j++; const avg = (i + j) / 2; for (let k = i; k <= j; k++) r[o[k][1]] = avg; i = j + 1; } return r; };
const corr = (a, b) => { const n = a.length; let ma = 0, mb = 0; for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i]; } ma /= n; mb /= n; let nu = 0, da = 0, db = 0; for (let i = 0; i < n; i++) { nu += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; } return da && db ? nu / Math.sqrt(da * db) : 0; };
const isoDate = (t) => new Date(t * 1000).toISOString().slice(0, 10);

// Align every symbol on the dates most of them traded; forward-fill gaps.
export function alignBars(raw) {
  const count = new Map();
  const names = Object.keys(raw);
  for (const s of names) for (const b of raw[s]) count.set(b[0], (count.get(b[0]) ?? 0) + 1);
  const dates = [...count.entries()].filter(([, n]) => n > names.length * 0.8).map(([t]) => t).sort((a, b) => a - b);
  const idx = new Map(dates.map((t, i) => [t, i]));
  const T = dates.length;
  const syms = names.filter((s) => raw[s].length > T * 0.95);
  const C = {}, Hh = {};
  for (const s of syms) {
    const c = new Array(T).fill(NaN), h = new Array(T).fill(NaN);
    for (const b of raw[s]) { const i = idx.get(b[0]); if (i != null) { c[i] = b[4]; h[i] = b[2]; } }
    for (let i = 1; i < T; i++) if (!(c[i] > 0)) { c[i] = c[i - 1]; h[i] = h[i - 1]; }
    C[s] = c; Hh[s] = h;
  }
  return { syms, dates, T, C, Hh };
}

const ema = (v, p) => { const k = 2 / (p + 1); const o = new Array(v.length); o[0] = v[0]; for (let i = 1; i < v.length; i++) o[i] = v[i] * k + o[i - 1] * (1 - k); return o; };
const pre = (v) => { const o = new Array(v.length + 1).fill(0); for (let i = 0; i < v.length; i++) o[i + 1] = o[i] + (Number.isFinite(v[i]) ? v[i] : 0); return o; };
const sg = (n) => (n > 0 ? 1 : n < 0 ? -1 : 0);

export function factorStudy(raw, H = [5, 20, 60]) {
  const { syms, dates, T, C, Hh } = alignBars(raw);
  const START = 260;
  const F = {};
  const names = ['score', 'trend_pillar', 'momentum_pillar', 'stretch_pillar', 'mom_5', 'mom_21', 'mom_63_21', 'mom_126_21', 'mom_252_21', 'rev_5', 'rev_21', 'lowvol_60', 'near_high_252', 'dist_sma200'];
  for (const s of syms) {
    const c = C[s], n = T;
    const pc = pre(c), pc2 = pre(c.map((x) => x * x));
    const ret = c.map((x, i) => (i ? x / c[i - 1] - 1 : 0));
    const pr = pre(ret), pr2 = pre(ret.map((x) => x * x));
    const pg = pre(ret.map((x, i) => (i && x > 0 ? c[i] - c[i - 1] : 0))), pl = pre(ret.map((x, i) => (i && x < 0 ? c[i - 1] - c[i] : 0)));
    const e9 = ema(c, 9), e12 = ema(c, 12), e26 = ema(c, 26); const macd = e12.map((x, i) => x - e26[i]); const sig = ema(macd, 9);
    const f = Object.fromEntries(names.map((k) => [k, new Array(n).fill(NaN)]));
    const win = (p, i, w) => p[i + 1] - p[i + 1 - w];
    for (let i = START; i < n; i++) {
      const price = c[i], s20 = win(pc, i, 20) / 20, sd = Math.sqrt(Math.max(win(pc2, i, 20) / 20 - s20 * s20, 0));
      const trend = sg(price - s20) + sg(e9[i] - s20);
      const hist = macd[i] - sig[i], mom = hist > 0 ? 2 : hist < 0 ? -2 : 0;
      const g = win(pg, i, 14), l = win(pl, i, 14); const r = g === 0 && l === 0 ? 50 : l === 0 ? 100 : 100 - 100 / (1 + g / l);
      const b = sd === 0 ? 0.5 : (price - (s20 - 2 * sd)) / (4 * sd);
      const stretch = (r <= 30 ? 1 : r >= 70 ? -1 : 0) + (b <= 0.05 ? 1 : b >= 0.95 ? -1 : 0);
      f.score[i] = trend + mom + stretch; f.trend_pillar[i] = trend; f.momentum_pillar[i] = mom; f.stretch_pillar[i] = stretch;
      f.mom_5[i] = price / c[i - 5] - 1; f.mom_21[i] = price / c[i - 21] - 1;
      f.mom_63_21[i] = c[i - 21] / c[i - 63] - 1; f.mom_126_21[i] = c[i - 21] / c[i - 126] - 1; f.mom_252_21[i] = c[i - 21] / c[i - 252] - 1;
      f.rev_5[i] = -f.mom_5[i]; f.rev_21[i] = -f.mom_21[i];
      const m60 = win(pr, i, 60) / 60; f.lowvol_60[i] = -Math.sqrt(Math.max(win(pr2, i, 60) / 60 - m60 * m60, 0));
      let hi = 0; for (let j = i - 251; j <= i; j++) if (Hh[s][j] > hi) hi = Hh[s][j]; f.near_high_252[i] = price / hi - 1;
      f.dist_sma200[i] = price / (win(pc, i, 200) / 200) - 1;
    }
    F[s] = f;
  }
  const acc = {};
  for (let t = START; t < T - 5; t++) {
    for (const h of H) {
      if (t + h >= T) continue;
      const fw = syms.map((s) => C[s][t + h] / C[s][t] - 1);
      const mu = mean(fw); const ex = fw.map((x) => x - mu); const rex = rank(ex);
      for (const k of names) {
        const x = syms.map((s) => F[s][k][t]); if (x.some((v) => !Number.isFinite(v))) continue;
        const ord = x.map((v, i) => [v, ex[i]]).sort((a, b) => a[0] - b[0]); const q = Math.floor(ord.length / 5);
        ((acc[k] ??= {})[h] ??= []).push({ y: new Date(dates[t] * 1000).getUTCFullYear(), ic: corr(rank(x), rex), sp: mean(ord.slice(-q).map((z) => z[1])) - mean(ord.slice(0, q).map((z) => z[1])) });
      }
    }
  }
  const rows = names.map((k) => {
    const row = { name: k };
    for (const h of H) {
      const a = acc[k][h]; const ics = a.map((z) => z.ic);
      row[`ic${h}`] = +mean(ics).toFixed(4);
      row[`t${h}`] = +((mean(ics) / (sdv(ics) || 1)) * Math.sqrt(ics.length / h)).toFixed(2); // overlap-adjusted
      row[`spread${h}`] = +(mean(a.map((z) => z.sp)) * 100).toFixed(3); // top minus bottom fifth, % excess
    }
    return row;
  });
  return { universe: syms.length, days: T, start: isoDate(dates[0]), end: isoDate(dates[T - 1]), horizons: H, rows };
}

// Open-market insider purchases: enter at the first close after the filing date,
// compare the next 20 / 60 trading days with the average stock over the same days.
export function insiderStudy(raw, events, H = [20, 60]) {
  const { syms, dates, T, C } = alignBars(raw);
  const dayIdx = new Map(dates.map((t, i) => [isoDate(t), i]));
  const symSet = new Set(syms);
  const firstAfter = (d) => { for (let k = 1; k <= 7; k++) { const dd = new Date(Date.parse(d + 'T00:00:00Z') + k * 86400000).toISOString().slice(0, 10); if (dayIdx.has(dd)) return dayIdx.get(dd); } return null; };
  const out = { events: events.length, horizons: {} };
  for (const h of H) {
    const ex = [];
    const seen = new Set();
    for (const e of events) {
      if (!symSet.has(e.symbol)) continue;
      const key = `${e.symbol}|${e.date}`; if (seen.has(key)) continue; seen.add(key); // one per stock per filing day
      const t0 = firstAfter(e.date); if (t0 == null || t0 + h >= T) continue;
      const own = C[e.symbol][t0 + h] / C[e.symbol][t0] - 1;
      const mkt = mean(syms.map((s) => C[s][t0 + h] / C[s][t0] - 1));
      ex.push(own - mkt);
    }
    out.horizons[h] = ex.length ? { n: ex.length, meanExcessPct: +(mean(ex) * 100).toFixed(2), t: +((mean(ex) / (sdv(ex) || 1)) * Math.sqrt(ex.length)).toFixed(2), beatMarketPct: +(mean(ex.map((x) => (x > 0 ? 1 : 0))) * 100).toFixed(1) } : { n: 0 };
  }
  return out;
}

// snapshots: [{ symbol, as_of: 'YYYY-MM-DD', balance_sheet_score, growth_score }, ...] taken weekly.
export function fundamentalsStudy(raw, snapshots, H = [20, 60]) {
  const dates = [...new Set(snapshots.map((s) => s.as_of))].sort();
  if (dates.length < 2) return { status: 'not enough history yet', snapshots: dates.length, firstSnapshot: dates[0] ?? null };
  const { syms, dates: dts, T, C } = alignBars(raw);
  const dayIdx = new Map(dts.map((t, i) => [isoDate(t), i]));
  const res = { status: 'ok', snapshots: dates.length, firstSnapshot: dates[0], measures: {} };
  for (const measure of ['balance_sheet_score', 'growth_score']) {
    res.measures[measure] = {};
    for (const h of H) {
      const ics = [];
      for (const d of dates) {
        let t0 = null; for (let k = 0; k <= 5 && t0 == null; k++) { const dd = new Date(Date.parse(d + 'T00:00:00Z') + k * 86400000).toISOString().slice(0, 10); if (dayIdx.has(dd)) t0 = dayIdx.get(dd); }
        if (t0 == null || t0 + h >= T) continue;
        const rows = snapshots.filter((s) => s.as_of === d && C[s.symbol] && s[measure] != null);
        if (rows.length < 100) continue;
        const fw = rows.map((r) => C[r.symbol][t0 + h] / C[r.symbol][t0] - 1); const mu = mean(fw);
        ics.push(corr(rank(rows.map((r) => Number(r[measure]))), rank(fw.map((x) => x - mu))));
      }
      res.measures[measure][h] = ics.length ? { snapshotsUsed: ics.length, ic: +mean(ics).toFixed(4) } : { snapshotsUsed: 0 };
    }
  }
  return res;
}
