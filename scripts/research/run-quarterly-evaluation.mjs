// Quarterly honesty check. Pulls five years of daily candles for every tracked
// stock, runs the three studies in signal-studies.mjs, writes docs/backtests/<date>.md
// and stores the result in the backtest_results table, which the Methodology page
// shows to visitors whatever it says.
//   node --max-old-space-size=4096 scripts/research/run-quarterly-evaluation.mjs
// Needs: the Supabase CLI logged in (it reads the service-role key at run time and
// never writes it anywhere), and about 10 minutes for the candle download.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { factorStudy, insiderStudy, fundamentalsStudy } from './signal-studies.mjs';
import { loadSecInsiderEvents } from './sec-insiders.mjs';

const REF = 'xikmfhipjhabhwxtpyfn';
const env = Object.fromEntries(fs.readFileSync('.env', 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')]; }));
const cli = (args) => execFileSync('npx', ['supabase', ...args], { maxBuffer: 1 << 29, encoding: 'utf8' });
const sql = (q) => { const out = cli(['db', 'query', '--linked', q]); return JSON.parse(out.slice(out.indexOf('{'), out.lastIndexOf('}') + 1)).rows; };

const keys = JSON.parse(cli(['projects', 'api-keys', '--project-ref', REF, '-o', 'json']).replace(/^[^[]*/, ''));
const SERVICE = keys.find((k) => k.name === 'service_role')?.api_key;
if (!SERVICE) throw new Error('could not read the service-role key from the Supabase CLI');

const today = new Date().toISOString().slice(0, 10);
const cache = path.join(os.tmpdir(), `tickerframe-daily5y-${today}.json`);
let raw;
if (fs.existsSync(cache)) {
  raw = JSON.parse(fs.readFileSync(cache, 'utf8'));
  console.log(`using today's cached candles (${Object.keys(raw).length} symbols)`);
} else {
  const symbols = sql('select symbol from stock_cache order by symbol').map((r) => r.symbol);
  raw = {}; const queue = [...symbols]; let done = 0;
  const worker = async () => {
    while (queue.length) {
      const s = queue.shift();
      for (let a = 0; a < 3; a++) {
        try {
          const r = await fetch(`${env.VITE_SUPABASE_URL}/functions/v1/stock-bars`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: env.VITE_SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${SERVICE}` }, body: JSON.stringify({ symbol: s, range: '5Y' }) });
          if (r.ok) { const j = await r.json(); if (j.bars?.length > 300) raw[s] = j.bars.map((b) => [Math.floor(Date.parse(b.t) / 1000), b.o, b.h, b.l, b.c, b.v]); break; }
        } catch { /* retry */ }
        await new Promise((x) => setTimeout(x, 1500));
      }
      if (++done % 100 === 0) console.log(`  ${done}/${symbols.length} downloaded`);
    }
  };
  console.log(`downloading five years of candles for ${symbols.length} stocks...`);
  await Promise.all([worker(), worker(), worker(), worker()]);
  fs.writeFileSync(cache, JSON.stringify(raw));
}

console.log('factor study...');
const factors = factorStudy(raw);
console.log('insider study...');
// Five years of filings from the SEC's quarterly bulk files when they've been downloaded;
// otherwise only the few months our own scanner has stored (far too few to conclude anything).
const secEvents = loadSecInsiderEvents();
const events = secEvents ?? sql("select ticker as symbol, filing_date::text as date from insider_activity where transaction_code = 'P' and filing_date is not null").map((e) => ({ ...e, value: 0, owners: [], officer: true, director: false, tenPctOnly: false, ceoCfo: false }));
const insider = { source: secEvents ? 'SEC bulk Form 4 files' : 'own scanner (short history)', ...insiderStudy(raw, events) };
if (secEvents) { const newest = secEvents.map((e) => e.date).sort().at(-1); insider.newestFiling = newest; if ((Date.now() - Date.parse(newest)) / 86400000 > 150) console.log(`NOTE: the SEC insider files end ${newest}; download the newer quarters from sec.gov (with the owner's OK) to refresh this test.`); }
console.log('fundamentals study...');
const snaps = sql('select symbol, as_of::text as as_of, balance_sheet_score, growth_score from fundamentals_history');
const fundamentals = fundamentalsStudy(raw, snaps);

// ---- report ----
const fmt = (r) => `| ${r.name} | ${r.ic5} | ${r.t5} | ${r.ic20} | ${r.t20} | ${r.ic60} | ${r.t60} | ${r.spread20}% |`;
const significant = factors.rows.filter((r) => [r.t5, r.t20, r.t60].some((t) => Math.abs(t) >= 2));
const md = `# Signal evaluation - ${today}

Universe: ${factors.universe} U.S. stocks, ${factors.start} to ${factors.end} (${factors.days} trading days). Daily candles, split-adjusted. Survivorship caveat: only stocks listed today. No trading costs.

## Does the score predict relative returns?
IC = rank correlation between the signal and the stock's return minus the average stock's return over the next 5/20/60 trading days. t uses an overlap-adjusted sample size; |t| of 2 or more is the usual bar for "not noise".

| signal | IC 5d | t | IC 20d | t | IC 60d | t | top-fifth minus bottom-fifth, 20d |
|---|---|---|---|---|---|---|---|
${factors.rows.map(fmt).join('\n')}

${significant.length ? `Signals with |t| >= 2 at some horizon: ${significant.map((r) => r.name).join(', ')}.` : 'No signal reached |t| >= 2 at any horizon.'}

## Insider purchases (Form 4, open-market buys of common stock)
Source: ${insider.source}${insider.newestFiling ? `, filings through ${insider.newestFiling}` : ''}. ${insider.events} purchase days in the tracked universe. Average return versus the average stock after the filing; t averages same-day filings and counts only non-overlapping windows.

| buyers | days after filing | filing days | avg vs average stock | t | beat market |
|---|---|---|---|---|---|
${Object.entries(insider.groups ?? {}).flatMap(([g, byH]) => Object.entries(byH).map(([h, v]) => (v.n ? `| ${g} | ${h} | ${v.days} | ${v.meanExcessPct}% | ${v.t} | ${v.beatMarketPct}% |` : null)).filter(Boolean)).join('\n')}

## Company financials (Balance Sheet and Growth scores)
${fundamentals.status === 'ok' ? Object.entries(fundamentals.measures).map(([m, byH]) => `- ${m}: ${Object.entries(byH).map(([h, v]) => (v.snapshotsUsed ? `${h}d IC ${v.ic} (${v.snapshotsUsed} snapshots)` : `${h}d not enough follow-up yet`)).join(', ')}`).join('\n') : `Not enough history yet: ${fundamentals.snapshots} weekly snapshot(s) so far${fundamentals.firstSnapshot ? ` (first ${fundamentals.firstSnapshot})` : ''}. Snapshots are saved every Sunday; this needs a few months of weeks before it can say anything.`}
`;
fs.mkdirSync('docs/backtests', { recursive: true });
fs.writeFileSync(`docs/backtests/${today}.md`, md);

const body = JSON.stringify;
sql(`insert into backtest_results (universe_size, start_date, end_date, factors, insider, fundamentals, notes) values (${factors.universe}, '${factors.start}', '${factors.end}', $j$${body({ horizons: factors.horizons, rows: factors.rows })}$j$::jsonb, $j$${body(insider)}$j$::jsonb, $j$${body(fundamentals)}$j$::jsonb, 'quarterly run ${today}')`);
console.log(md);
console.log(`saved docs/backtests/${today}.md and a backtest_results row`);
