import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

interface CronStat {
  job_name: string;
  last_ran_at: string;
  ok: boolean;
  rows: number | null;
  notes: string | null;
  runs_24h: number;
  ok_24h: number;
  rows_24h: number;
}

interface Freshness { table: string; column: string; latest: string | null; ageMin: number | null; staleAfterMin: number; sample: number }

interface ErrorLog {
  id: string;
  message: string;
  route: string | null;
  user_id: string | null;
  user_agent: string | null;
  stack: string | null;
  created_at: string;
}

// The 4 edge functions actually registered as cron jobs (see
// supabase/migrations/*_cron.sql) -- this list previously named 7 functions
// that don't exist anywhere in this codebase (leftover from an earlier
// iteration) and was missing 3 that do, so this panel showed "never" for
// real jobs and silently made up rows for phantom ones regardless of what
// was actually scheduled.
const TRACKED_JOBS = [
  'fetch-stock-data',
  'fundamentals-scanner',
  'insider-scanner',
  'earnings-scanner',
  'portfolio-alerts',
];

const FRESHNESS_TARGETS: Array<{ table: string; column: string; staleAfterMin: number; label: string }> = [
  { table: 'stock_cache', column: 'fetched_at', staleAfterMin: 15, label: 'Stock quotes' },
  { table: 'signal_log', column: 'fired_at', staleAfterMin: 90, label: 'Signal snapshots' },
  { table: 'news_events', column: 'published_at', staleAfterMin: 360, label: 'News feed' },
  { table: 'iv_history', column: 'captured_at', staleAfterMin: 60 * 26, label: 'IV history' },
  { table: 'macro_cache', column: 'fetched_at', staleAfterMin: 60 * 26, label: 'Macro data' },
  { table: 'options_flow_snapshots', column: 'captured_at', staleAfterMin: 60, label: 'Options flow' },
];

interface SignedUpUser {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
}

export default function Health() {
  const [crons, setCrons] = useState<CronStat[]>([]);
  const [fresh, setFresh] = useState<Freshness[]>([]);
  const [errors, setErrors] = useState<ErrorLog[]>([]);
  const [errCount24h, setErrCount24h] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<SignedUpUser[]>([]);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [usersLoading, setUsersLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error } = await supabase.functions.invoke('admin-list-users');
      if (!alive) return;
      if (error) setUsersError(error.message || 'Failed to load signups');
      else if (data?.error) setUsersError(String(data.error));
      else setUsers((data?.users ?? []) as SignedUpUser[]);
      setUsersLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const since = new Date(Date.now() - 24 * 3600_000).toISOString();
      const cronRows: CronStat[] = [];
      for (const job of TRACKED_JOBS) {
        const { data: latest } = await supabase
          .from('cron_runs')
          .select('job_name, ran_at, ok, rows, notes')
          .eq('job_name', job)
          .order('ran_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        const { data: window } = await supabase
          .from('cron_runs')
          .select('ok, rows')
          .eq('job_name', job)
          .gte('ran_at', since);
        const runs = window?.length ?? 0;
        const ok = (window ?? []).filter(r => r.ok).length;
        const rowsSum = (window ?? []).reduce((s, r) => s + (Number(r.rows) || 0), 0);
        cronRows.push({
          job_name: job,
          last_ran_at: latest?.ran_at ?? '',
          ok: !!latest?.ok,
          rows: latest?.rows ?? null,
          notes: latest?.notes ?? null,
          runs_24h: runs, ok_24h: ok, rows_24h: rowsSum,
        });
      }
      const freshness: Freshness[] = [];
      for (const t of FRESHNESS_TARGETS) {
        const { data } = await supabase
          .from(t.table as any)
          .select(`${t.column}`)
          .order(t.column as any, { ascending: false })
          .limit(1);
        const { count } = await supabase
          .from(t.table as any)
          .select('*', { count: 'exact', head: true })
          .gte(t.column, new Date(Date.now() - 24 * 3600_000).toISOString());
        const latest = (data?.[0] as any)?.[t.column] ?? null;
        const ageMin = latest ? Math.round((Date.now() - new Date(latest).getTime()) / 60_000) : null;
        freshness.push({ table: t.label, column: t.column, latest, ageMin, staleAfterMin: t.staleAfterMin, sample: count ?? 0 });
      }
      if (!alive) return;
      setCrons(cronRows);
      setFresh(freshness);

      const since24 = new Date(Date.now() - 24 * 3600_000).toISOString();
      const { data: errRows } = await supabase
        .from('error_logs')
        .select('id, message, route, user_id, user_agent, stack, created_at')
        .order('created_at', { ascending: false })
        .limit(50);
      const { count: errC } = await supabase
        .from('error_logs')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', since24);
      setErrors((errRows ?? []) as ErrorLog[]);
      setErrCount24h(errC ?? 0);

      setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  const fmtAgo = (iso: string) => {
    if (!iso) return '—';
    const m = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
    if (m < 60) return `${m}m ago`;
    if (m < 60 * 24) return `${Math.round(m / 60)}h ago`;
    return `${Math.round(m / (60 * 24))}d ago`;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <header>
        <h1 className="text-3xl font-bold">System Health</h1>
        <p className="text-muted-foreground text-sm mt-1">Cron jobs, data freshness, and pipeline integrity at a glance.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Signups</span>
            {!usersLoading && !usersError && (
              <Badge className="bg-primary/15 text-primary text-base px-3 py-1">{users.length} total</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {usersLoading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : usersError ? (
            <p className="text-sm text-red-500">{usersError}</p>
          ) : users.length === 0 ? (
            <p className="text-sm text-muted-foreground">No signups yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground border-b">
                  <tr>
                    <th className="py-2 pr-3">Email</th>
                    <th className="py-2 pr-3">Signed up</th>
                    <th className="py-2 pr-3">Last sign-in</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} className="border-b last:border-0">
                      <td className="py-2 pr-3">{u.email ?? '—'}</td>
                      <td className="py-2 pr-3 whitespace-nowrap text-xs text-muted-foreground">{fmtAgo(u.created_at)}</td>
                      <td className="py-2 pr-3 whitespace-nowrap text-xs text-muted-foreground">{u.last_sign_in_at ? fmtAgo(u.last_sign_in_at) : 'never'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Cron jobs (last 24h)</CardTitle></CardHeader>
        <CardContent>
          {loading ? <p className="text-muted-foreground">Loading…</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground border-b">
                  <tr>
                    <th className="py-2 pr-3">Job</th>
                    <th className="py-2 pr-3">Last run</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Runs / OK</th>
                    <th className="py-2 pr-3">Rows 24h</th>
                    <th className="py-2 pr-3">Latest note</th>
                  </tr>
                </thead>
                <tbody>
                  {crons.map(c => {
                    const stale = c.last_ran_at && (Date.now() - new Date(c.last_ran_at).getTime()) > 6 * 3600_000;
                    const failing = c.runs_24h > 0 && c.ok_24h / c.runs_24h < 0.8;
                    const status = !c.last_ran_at ? 'never' : failing ? 'failing' : stale ? 'stale' : c.ok ? 'ok' : 'error';
                    const color: Record<string, string> = { ok: 'bg-green-500/15 text-green-500', stale: 'bg-yellow-500/15 text-yellow-500', failing: 'bg-red-500/15 text-red-500', error: 'bg-red-500/15 text-red-500', never: 'bg-muted text-muted-foreground' };
                    return (
                      <tr key={c.job_name} className="border-b last:border-0">
                        <td className="py-2 pr-3 font-mono text-xs">{c.job_name}</td>
                        <td className="py-2 pr-3">{fmtAgo(c.last_ran_at)}</td>
                        <td className="py-2 pr-3"><Badge className={color[status]}>{status}</Badge></td>
                        <td className="py-2 pr-3">{c.ok_24h}/{c.runs_24h}</td>
                        <td className="py-2 pr-3">{c.rows_24h}</td>
                        <td className="py-2 pr-3 text-xs text-muted-foreground max-w-[280px] truncate" title={c.notes ?? ''}>{c.notes ?? '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Data freshness</CardTitle></CardHeader>
        <CardContent>
          {loading ? <p className="text-muted-foreground">Loading…</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground border-b">
                  <tr>
                    <th className="py-2 pr-3">Source</th>
                    <th className="py-2 pr-3">Latest row</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Rows 24h</th>
                  </tr>
                </thead>
                <tbody>
                  {fresh.map(f => {
                    const stale = f.ageMin == null || f.ageMin > f.staleAfterMin;
                    return (
                      <tr key={f.table} className="border-b last:border-0">
                        <td className="py-2 pr-3">{f.table}</td>
                        <td className="py-2 pr-3">{f.latest ? fmtAgo(f.latest) : '—'}</td>
                        <td className="py-2 pr-3">
                          <Badge className={stale ? 'bg-red-500/15 text-red-500' : 'bg-green-500/15 text-green-500'}>
                            {stale ? 'stale' : 'fresh'}
                          </Badge>
                        </td>
                        <td className="py-2 pr-3">{f.sample}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Runtime errors</span>
            <Badge className={errCount24h > 0 ? 'bg-red-500/15 text-red-500' : 'bg-green-500/15 text-green-500'}>
              {errCount24h} in last 24h
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? <p className="text-muted-foreground">Loading…</p> : errors.length === 0 ? (
            <p className="text-sm text-muted-foreground">No errors logged. 🎉</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground border-b">
                  <tr>
                    <th className="py-2 pr-3">When</th>
                    <th className="py-2 pr-3">Route</th>
                    <th className="py-2 pr-3">Message</th>
                    <th className="py-2 pr-3">User</th>
                  </tr>
                </thead>
                <tbody>
                  {errors.map(e => (
                    <tr key={e.id} className="border-b last:border-0 align-top">
                      <td className="py-2 pr-3 whitespace-nowrap text-xs text-muted-foreground">{fmtAgo(e.created_at)}</td>
                      <td className="py-2 pr-3 font-mono text-xs">{e.route ?? '—'}</td>
                      <td className="py-2 pr-3">
                        <details>
                          <summary className="cursor-pointer text-sm">{e.message}</summary>
                          {e.stack && (
                            <pre className="mt-1 max-h-40 overflow-auto rounded bg-muted p-2 text-[10px] whitespace-pre-wrap">{e.stack}</pre>
                          )}
                        </details>
                      </td>
                      <td className="py-2 pr-3 font-mono text-[10px] text-muted-foreground">{e.user_id ? e.user_id.slice(0, 8) : 'anon'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
