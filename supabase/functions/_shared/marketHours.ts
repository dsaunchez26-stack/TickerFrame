// Deno-side port of src/lib/marketHours.ts's regular-session check (kept in
// sync manually). portfolio-alerts only needs "is the regular session open
// right now" to decide whether to bother checking for alerts at all -- pre/
// post-market granularity isn't needed here.
const NYSE_HOLIDAYS: ReadonlySet<string> = new Set([
  '2025-01-01','2025-01-20','2025-02-17','2025-04-18','2025-05-26',
  '2025-06-19','2025-07-04','2025-09-01','2025-11-27','2025-12-25',
  '2026-01-01','2026-01-19','2026-02-16','2026-04-03','2026-05-25',
  '2026-06-19','2026-07-03','2026-09-07','2026-11-26','2026-12-25',
  '2027-01-01','2027-01-18','2027-02-15','2027-03-26','2027-05-31',
  '2027-06-18','2027-07-05','2027-09-06','2027-11-25','2027-12-24',
]);

const NYSE_EARLY_CLOSE: ReadonlySet<string> = new Set([
  '2025-07-03','2025-11-28','2025-12-24',
  '2026-11-27','2026-12-24',
  '2027-11-26',
]);

// Constructing Intl.DateTimeFormat is expensive in V8 -- built once at
// module scope and reused, instead of per-call. Fine when this only ran
// once per invocation (portfolio-alerts), but realized-volatility-scanner
// calls this once per historical price sample (100,000+ times per run
// across the full tracked universe) and a fresh formatter per call was
// enough to blow through the edge function's compute budget
// (WORKER_RESOURCE_LIMIT) on its own, before any real work got done.
const ET_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short',
});

export function isMarketOpen(d: Date = new Date()): boolean {
  const parts = ET_FORMATTER.formatToParts(d);
  const m: Record<string, string> = {};
  for (const p of parts) m[p.type] = p.value;
  const dowMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const dow = dowMap[m.weekday] ?? 0;
  const iso = `${m.year}-${m.month}-${m.day}`;
  if (dow === 0 || dow === 6) return false;
  if (NYSE_HOLIDAYS.has(iso)) return false;
  const hour = Number(m.hour === '24' ? '00' : m.hour);
  const mins = hour * 60 + Number(m.minute);
  const close = NYSE_EARLY_CLOSE.has(iso) ? 13 * 60 : 16 * 60;
  return mins >= 9 * 60 + 30 && mins < close;
}
