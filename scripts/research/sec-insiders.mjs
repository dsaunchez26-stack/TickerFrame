// Builds open-market insider-purchase events from the SEC's quarterly
// "Insider Transactions Data Sets" (Forms 3/4/5), saved as zip files in
// .research-cache/sec-form345/YYYYqN_form345.zip. The zips are only ever read
// as text (via `unzip -p`); nothing inside them is executed.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export const SEC_DIR = '.research-cache/sec-form345';
const MONTHS = { JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06', JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12' };
const isoDate = (d) => { const m = /^(\d{2})-([A-Z]{3})-(\d{4})$/.exec(d ?? ''); return m ? `${m[3]}-${MONTHS[m[2]]}-${m[1]}` : null; };

const readTsv = (zip, file) => {
  const text = execFileSync('unzip', ['-p', zip, file], { maxBuffer: 1 << 29, encoding: 'utf8' });
  const lines = text.split('\n');
  const head = lines[0].replace(/\r$/, '').split('\t');
  const idx = Object.fromEntries(head.map((h, i) => [h, i]));
  return { idx, rows: lines.slice(1).filter(Boolean).map((l) => l.replace(/\r$/, '').split('\t')) };
};

const COMMON = /common|ordinary|class [a-z]\b|\bshares?\b|\bstock\b/i;
const NOT_COMMON = /preferred|warrant|option|right|note|debenture|convertible|unit|swap|forward|depositary/i;

export function loadSecInsiderEvents(dir = SEC_DIR) {
  if (!fs.existsSync(dir)) return null;
  const zips = fs.readdirSync(dir).filter((f) => /^\d{4}q[1-4]_form345\.zip$/.test(f)).sort();
  if (!zips.length) return null;
  const events = new Map(); // `${symbol}|${date}` -> aggregate
  for (const z of zips) {
    const zip = path.join(dir, z);
    const sub = readTsv(zip, 'SUBMISSION.tsv');
    const info = new Map();
    for (const r of sub.rows) {
      if (r[sub.idx.DOCUMENT_TYPE] !== '4') continue; // original Form 4 only, not amendments
      const symbol = (r[sub.idx.ISSUERTRADINGSYMBOL] ?? '').trim().toUpperCase().replace(/-/g, '.');
      const date = isoDate(r[sub.idx.FILING_DATE]);
      if (symbol && date) info.set(r[sub.idx.ACCESSION_NUMBER], { symbol, date });
    }
    const own = readTsv(zip, 'REPORTINGOWNER.tsv');
    const owners = new Map();
    for (const r of own.rows) {
      const acc = r[own.idx.ACCESSION_NUMBER]; if (!info.has(acc)) continue;
      const rel = r[own.idx.RPTOWNER_RELATIONSHIP] ?? '';
      const o = owners.get(acc) ?? { ciks: new Set(), officer: false, director: false, tenPct: false, title: '' };
      o.ciks.add(r[own.idx.RPTOWNERCIK]);
      if (/Officer/i.test(rel)) o.officer = true; if (/Director/i.test(rel)) o.director = true; if (/TenPercent/i.test(rel)) o.tenPct = true;
      o.title += ' ' + (r[own.idx.RPTOWNER_TITLE] ?? '');
      owners.set(acc, o);
    }
    const tr = readTsv(zip, 'NONDERIV_TRANS.tsv');
    for (const r of tr.rows) {
      const acc = r[tr.idx.ACCESSION_NUMBER]; const meta = info.get(acc); if (!meta) continue;
      if (r[tr.idx.TRANS_CODE] !== 'P' || r[tr.idx.TRANS_ACQUIRED_DISP_CD] !== 'A') continue;
      const title = r[tr.idx.SECURITY_TITLE] ?? '';
      if (NOT_COMMON.test(title) || !COMMON.test(title)) continue;
      const shares = Number(r[tr.idx.TRANS_SHARES]), price = Number(r[tr.idx.TRANS_PRICEPERSHARE]);
      if (!(shares > 0) || !(price > 0)) continue;
      const key = `${meta.symbol}|${meta.date}`;
      const o = owners.get(acc);
      const e = events.get(key) ?? { symbol: meta.symbol, date: meta.date, value: 0, owners: new Set(), officer: false, director: false, tenPctOnly: true, ceoCfo: false };
      e.value += shares * price;
      for (const c of o?.ciks ?? []) e.owners.add(c);
      if (o?.officer) e.officer = true; if (o?.director) e.director = true; if (!o || !o.tenPct || o.officer || o.director) e.tenPctOnly = false;
      if (o && /chief executive|\bceo\b|chief financial|\bcfo\b|president/i.test(o.title)) e.ceoCfo = true;
      events.set(key, e);
    }
  }
  return [...events.values()].map((e) => ({ symbol: e.symbol, date: e.date, value: Math.round(e.value), owners: [...e.owners], officer: e.officer, director: e.director, tenPctOnly: e.tenPctOnly, ceoCfo: e.ceoCfo }));
}
