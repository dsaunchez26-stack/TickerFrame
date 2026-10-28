import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "./cors.ts";

// Functions that spend a shared provider key (Finnhub, Alpaca) on behalf of the
// browser are limited to signed-in users, so the public anon key alone can't be
// used to burn through the rate limit the price scanner depends on.
// Returns null when the caller is a real signed-in user, otherwise a 401 Response.
export async function requireUser(req: Request): Promise<Response | null> {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const deny = () =>
    new Response(JSON.stringify({ error: "Sign in to use this" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  if (!token) return deny();
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data, error } = await supabase.auth.getUser(token);
  return error || !data?.user ? deny() : null;
}
