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

// Built once and reused -- constructing Intl.DateTimeFormat on every call
// is measurably expensive, and this runs on a 30s interval for as long as
// the app is open.
const ET_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short',
});

function toET(d: Date = new Date()) {
  const parts = ET_FORMATTER.formatToParts(d);
  const m: Record<string, string> = {};
  for (const p of parts) m[p.type] = p.value;
  const dowMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const hour = Number(m.hour === '24' ? '00' : m.hour);
  return {
    hour, minute: Number(m.minute),
    dow: dowMap[m.weekday] ?? 0,
    iso: `${m.year}-${m.month}-${m.day}`,
  };
}

export type MarketStatus = 'open' | 'pre' | 'post' | 'closed';

export function getMarketStatus(d: Date = new Date()): MarketStatus {
  const et = toET(d);
  if (et.dow === 0 || et.dow === 6) return 'closed';
  if (NYSE_HOLIDAYS.has(et.iso)) return 'closed';
  const mins = et.hour * 60 + et.minute;
  const close = NYSE_EARLY_CLOSE.has(et.iso) ? 13 * 60 : 16 * 60;
  if (mins >= 9 * 60 + 30 && mins < close) return 'open';
  if (mins >= 4 * 60 && mins < 9 * 60 + 30) return 'pre';
  if (mins >= close && mins < 20 * 60) return 'post';
  return 'closed';
}

export function marketStatusLabel(s: MarketStatus): string {
  switch (s) {
    case 'open': return 'Market Open';
    case 'pre': return 'Pre-Market';
    case 'post': return 'After Hours';
    case 'closed': return 'Market Closed';
  }
}
