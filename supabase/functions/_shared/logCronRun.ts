import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

// Every scanner calls this at the end of its run (success or failure) so
// the System Health page has something real to show. Before this existed,
// the "Cron jobs" panel always read "never" for every job regardless of
// whether it actually ran -- which is exactly why fundamentals-scanner,
// insider-scanner, and earnings-scanner silently failing on every scheduled
// run (missing Authorization header on their cron jobs) went unnoticed for
// a week: nothing surfaced it anywhere short of manually inspecting
// pg_net's internal response log.
export async function logCronRun(
  supabase: SupabaseClient,
  jobName: string,
  ok: boolean,
  rows: number,
  notes: string | null,
): Promise<void> {
  try {
    await supabase.from("cron_runs").insert({ job_name: jobName, ran_at: new Date().toISOString(), ok, rows, notes });
  } catch {
    // Logging the run must never be what makes the run itself fail.
  }
}
