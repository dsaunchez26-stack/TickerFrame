// Shrinks src/demo/snapshot.json in place. The demo downloads this file as one
// lazy chunk, so every KB matters on a slow connection. Safe to re-run.
//   - long float tails (delta -0.0744838269393362) rounded to 6 significant digits
//   - long-tail options lists cut to what the pages actually show
//   - unused columns dropped (price-history row ids, empty-column noise)
import fs from 'node:fs';

const FILE = 'src/demo/snapshot.json';
const round = (v) => {
  if (Array.isArray(v)) return v.map(round);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, round(x)]));
  if (typeof v === 'number' && !Number.isInteger(v)) return Number(v.toPrecision(6));
  return v;
};
const byScore = (a, b) => (b.score ?? -1) - (a.score ?? -1);

export function trimSnapshot(s) {
  const t = s.tables;
  // Weekend samples are flat (the market was closed), and only the newest day
  // needs 5-minute resolution: the 3D/1W charts bucket to 30/60 minutes anyway.
  const nyDay = (iso) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  const isWeekend = (iso) => ['Sat', 'Sun'].includes(new Date(iso).toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'short' }));
  const hist = (t.stock_price_history ?? []).filter((r) => !isWeekend(r.recorded_at));
  const newestDay = hist.reduce((m, r) => (nyDay(r.recorded_at) > m ? nyDay(r.recorded_at) : m), '');
  const seen = new Set();
  t.stock_price_history = hist
    .filter((r) => {
      if (nyDay(r.recorded_at) === newestDay) return true;
      const key = `${r.symbol}|${Math.floor(Date.parse(r.recorded_at) / 1_800_000)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map(({ id, ...rest }) => rest);
  t.daily_closes = (t.daily_closes ?? []).filter((r) => ![0, 6].includes(new Date(`${r.trade_date}T12:00:00Z`).getUTCDay()));
  t.cron_runs = (t.cron_runs ?? []).slice(0, 60);

  const o = s.optionsAggregate;
  o.leapsRows = (o.leapsRows ?? []).slice(0, 80);
  o.creditSpreads = (o.creditSpreads ?? []).slice(0, 100);
  o.diagonals = (o.diagonals ?? []).slice(0, 50);
  o.flowAggs = [...(o.flowAggs ?? [])]
    .sort((a, b) => (b.callDollarFlow + b.putDollarFlow) - (a.callDollarFlow + a.putDollarFlow))
    .slice(0, 250);

  if (Array.isArray(s.bestPuts?.rows)) s.bestPuts.rows = [...s.bestPuts.rows].sort(byScore).slice(0, 300);
  return round(s);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const before = fs.statSync(FILE).size;
  const out = trimSnapshot(JSON.parse(fs.readFileSync(FILE, 'utf8')));
  fs.writeFileSync(FILE, JSON.stringify(out));
  console.log(`snapshot ${(before / 1e6).toFixed(2)} MB -> ${(fs.statSync(FILE).size / 1e6).toFixed(2)} MB`);
}
