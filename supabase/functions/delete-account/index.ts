import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// Lets a signed-in user permanently delete their own account and data.
// Everything user-scoped (portfolio, tracked picks, futures positions,
// snapshots, notification settings incl. the Slack webhook, onboarding state,
// assistant conversations and messages) is removed by ON DELETE CASCADE from
// auth.users, so deleting the auth user is what actually erases it. Error
// logs only SET NULL on their user id, so those are deleted outright first.
// auth.users isn't reachable via the normal API, hence the service-role
// client -- guarded by verifying the caller's own session token and acting
// only on that user's id, never on an id taken from the request body.
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const token = authHeader.replace(/^Bearer\s+/i, "");
  const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !user) return json({ error: "Not authenticated" }, 401);

  let confirm = "";
  try { confirm = String((await req.json())?.confirm ?? ""); } catch { /* no body */ }
  if (confirm !== "DELETE") return json({ error: 'Type DELETE to confirm' }, 400);

  // An admin account is how the site itself is managed; don't let a stray
  // click remove the only way to run it.
  const { data: adminRow } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
  if (adminRow) return json({ error: "Admin accounts can't be deleted from here - contact the site operator." }, 403);

  const { error: logsErr } = await supabase.from("error_logs").delete().eq("user_id", user.id);
  if (logsErr) return json({ error: `Couldn't clear diagnostic logs: ${logsErr.message}` }, 500);

  const { error: delErr } = await supabase.auth.admin.deleteUser(user.id);
  if (delErr) return json({ error: `Couldn't delete the account: ${delErr.message}` }, 500);

  return json({ ok: true });
});
