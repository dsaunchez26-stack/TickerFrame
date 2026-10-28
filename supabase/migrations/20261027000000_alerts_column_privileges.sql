-- The shared alerts feed let any signed-in user UPDATE any column of any row
-- (the policy is "using (true)"). The only thing the app ever changes is the
-- acknowledged flag, so say that at the privilege level too.
revoke update on public.alerts from authenticated, anon;
grant update (acknowledged) on public.alerts to authenticated;
