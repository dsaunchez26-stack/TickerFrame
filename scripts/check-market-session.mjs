// Verifies that the price scanner behaved during a US trading session:
// it ran on schedule, stored samples only inside market hours, kept daily
// closes under the New York date, and is building toward readings.
//   node scripts/check-market-session.mjs
import { execFileSync } from 'node:child_process';

const q = (sql) => {
  const out = execFileSync('npx', ['supabase', 'db', 'query', '--linked', sql], { maxBuffer: 1 << 28, encoding: 'utf8' });
  return JSON.parse(out.slice(out.indexOf('{'), out.lastIndexOf('}') + 1)).rows;
};
let failures = 0, warnings = 0;
const line = (status, label, detail) => { if (status === 'FAIL') failures++; if (status === 'WARN') warnings++; console.log(`${status.padEnd(5)} ${label}${detail ? ' - ' + detail : ''}`); };

const [{ ny_date: real_date, ny_time, weekday, mins: real_mins }] = q(`select (now() at time zone 'America/New_York')::date::text as ny_date, to_char(now() at time zone 'America/New_York','HH24:MI') as ny_time, to_char(now() at time zone 'America/New_York','Dy') as weekday, extract(hour from now() at time zone 'America/New_York')*60 + extract(minute from now() at time zone 'America/New_York') as mins`);
const ny_date = process.env.SIMULATE_DATE || real_date;
const mins = process.env.SIMULATE_DATE ? 600 : real_mins;
// SIMULATE_DATE=YYYY-MM-DD dry-runs every query against a past date (checks will report missing data, not query errors).
const sim = process.env.SIMULATE_DATE;
const isWeekday = sim ? true : !['Sat', 'Sun'].includes(weekday);
const sessionStarted = isWeekday && (sim ? true : Number(mins) >= 9 * 60 + 30);
console.log(`Now: ${weekday} ${ny_date} ${ny_time} New York\n`);
if (!sessionStarted) {
  line('WARN', 'Session not started yet', 'run again after 10:15 AM New York on a weekday (a full pass over every stock takes ~27 min)');
  process.exit(0);
}

// Scheduled runs since the open (UTC window = today's New York open)
const runs = q(`select count(*) filter (where d.status='succeeded') ok, count(*) filter (where d.status<>'succeeded') bad, count(*) n from cron.job_run_details d join cron.job j using(jobid) where j.jobname='fetch-stock-data-market-hours' and d.start_time >= (('${ny_date} 09:30')::timestamp at time zone 'America/New_York')`)[0];
const minutes = Number(mins) - (9 * 60 + 30);
const expected = Math.floor(minutes / 3);
Number(runs.bad) === 0 ? line('PASS', 'Cron fired without errors', `${runs.ok} runs`) : line('FAIL', 'Cron job errors', `${runs.bad} failed of ${runs.n}`);
Number(runs.n) >= expected - 2 ? line('PASS', 'Run cadence (every 3 min)', `${runs.n} runs, ~${expected} expected`) : line('FAIL', 'Too few runs', `${runs.n} vs ~${expected} expected`);

// What the function actually returned to the scheduler
const resp = q(`select status_code, count(*) n from net._http_response where created >= (('${ny_date} 09:30')::timestamp at time zone 'America/New_York') group by 1 order by 1`);
const bad = resp.filter((r) => r.status_code !== 200);
bad.length === 0 ? line('PASS', 'Function responses', resp.map((r) => `${r.status_code}x${r.n}`).join(', ')) : line('FAIL', 'Non-200 responses', JSON.stringify(bad));

// The scanner's own run log
const logRows = q(`select ok, rows, coalesce(notes,'') notes, ran_at::text from cron_runs where job_name='fetch-stock-data' and ran_at >= (('${ny_date} 09:30')::timestamp at time zone 'America/New_York') order by ran_at desc`);
const failed = logRows.filter((r) => !r.ok);
failed.length === 0 ? line('PASS', 'Scanner run log', `${logRows.length} runs, avg ${Math.round(logRows.reduce((s, r) => s + Number(r.rows), 0) / Math.max(logRows.length, 1))} symbols/run`) : line('FAIL', 'Scanner reported failures', JSON.stringify(failed.slice(0, 2)));
const skipped = logRows.filter((r) => r.notes.includes('market closed'));
skipped.length === 0 ? line('PASS', 'No runs skipped during the session') : line('WARN', 'Runs skipped as "market closed" during the session', `${skipped.length}`);
const errs = logRows.map((r) => Number((r.notes.match(/(\d+) symbol errors/) || [0, 0])[1]));
Math.max(0, ...errs) <= 3 ? line('PASS', 'Symbol errors per run', `max ${Math.max(0, ...errs)}`) : line('WARN', 'Symbol errors per run', `max ${Math.max(...errs)} (check for rate limits or newly delisted tickers)`);

// Samples: only inside 9:30-16:05 New York, none on weekends
const outside = q(`select count(*) n from stock_price_history where (extract(isodow from recorded_at at time zone 'America/New_York') in (6,7)) or ((extract(hour from recorded_at at time zone 'America/New_York')*60 + extract(minute from recorded_at at time zone 'America/New_York')) not between 570 and 965)`)[0].n;
Number(outside) === 0 ? line('PASS', 'Samples only recorded inside market hours') : line('FAIL', 'Samples recorded outside market hours', `${outside} rows`);
const samples = q(`select count(*) n, count(distinct symbol) syms, round(avg(c)::numeric,1) avg_per_symbol from (select symbol, count(*) c from stock_price_history where recorded_at >= (('${ny_date} 09:30')::timestamp at time zone 'America/New_York') group by 1) t, (select count(*) from stock_price_history) tot`)[0];
line(Number(samples.syms) > 0 ? 'PASS' : 'FAIL', 'Samples collected today', `${samples.syms} symbols, ~${samples.avg_per_symbol} per symbol so far`);

// Daily closes keyed by NY date, no phantom rows
const closes = q(`select trade_date::text d, count(*) n from daily_closes where trade_date >= '${ny_date}'::date - 2 group by 1 order by 1`);
const today = closes.find((r) => r.d === ny_date);
line(today ? 'PASS' : 'FAIL', `Daily closes for ${ny_date}`, today ? `${today.n} symbols` : 'none');
const future = closes.filter((r) => r.d > ny_date);
future.length === 0 ? line('PASS', 'No future-dated daily closes') : line('FAIL', 'Phantom daily closes', JSON.stringify(future));
const weekend = q(`select count(*) n from daily_closes where trade_date >= '2026-10-03' and extract(isodow from trade_date) in (6,7)`)[0].n;
Number(weekend) === 0 ? line('PASS', 'No weekend daily closes') : line('FAIL', 'Weekend daily closes present', `${weekend}`);

// Readings: expected to appear once ~27 samples exist per stock
const readings = q(`select count(*) filter (where signal_score is not null) with_reading, count(*) total, count(*) filter (where signal='buy') bull, count(*) filter (where signal='sell') bear from stock_cache`)[0];
const live = q(`select count(*) n, count(distinct symbol) syms from signal_history where source='live'`)[0];
line('INFO', 'Readings', `${readings.with_reading}/${readings.total} stocks have a score (needs ~27 samples each); bullish ${readings.bull}, bearish ${readings.bear}; live signal-log rows ${live.n}`);
if (minutes < 40 && !process.env.SIMULATE_DATE) {
  line('INFO', 'Freshness check skipped', 'a full rotation over every stock takes ~27 min; run after 10:15 AM');
} else {
  const stale = q(`select count(*) n from stock_cache where fetched_at < now() - interval '45 minutes'`)[0].n;
  Number(stale) === 0 ? line('PASS', 'Every stock refreshed in the last 45 min (full rotation ~27 min)') : line('WARN', 'Stocks not refreshed in 45 min', `${stale}`);
}

console.log(`\n${failures} failed, ${warnings} warnings`);
process.exit(failures ? 1 : 0);
