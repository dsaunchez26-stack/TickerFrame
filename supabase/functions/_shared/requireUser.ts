import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "./cors.ts";

// Functions that spend a shared provider key (Finnhub, Alpaca) on behalf of the
// browser are limited to signed-in users, so the public anon key alone can't be
// used to burn through the rate limit the price scanner depends on.
// Returns null when the caller is a real signed-in user, otherwise a 401 Response.
// True when the caller's JWT carries role "service_role" (the project's own backend and the owner's
// research scripts). The gateway has already verified the token's signature before the function runs
// (verify_jwt is on), so reading the role claim is safe. Comparing against the SUPABASE_SERVICE_ROLE_KEY
// env var does NOT work: it holds the newer secret-key format, not the legacy JWT.
export function isServiceRole(req: Request): boolean {
  try {
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload?.role === "service_role";
  } catch {
    return false;
  }
}

export async function requireUser(req: Request): Promise<Response | null> {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const deny = () =>
    new Response(JSON.stringify({ error: "Sign in to use this" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  if (!token) return deny();
  if (isServiceRole(req)) return null; // the project's own backend / scheduled jobs
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data, error } = await supabase.auth.getUser(token);
  return error || !data?.user ? deny() : null;
}
