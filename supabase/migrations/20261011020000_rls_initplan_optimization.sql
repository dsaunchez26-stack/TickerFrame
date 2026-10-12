-- Same rules, evaluated once per query instead of once per row: wrapping
-- auth.uid() in a scalar subquery lets Postgres cache it (Supabase's
-- auth_rls_initplan lint). Every expression below is otherwise identical to
-- the existing policy.
alter policy "users manage their own chat conversations" on public.chat_conversations
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

alter policy "users manage messages in their own conversations" on public.chat_messages
  using (exists (select 1 from public.chat_conversations c where c.id = chat_messages.conversation_id and c.user_id = (select auth.uid())))
  with check (exists (select 1 from public.chat_conversations c where c.id = chat_messages.conversation_id and c.user_id = (select auth.uid())));

alter policy "admins can read error logs" on public.error_logs
  using (exists (select 1 from public.user_roles where user_roles.user_id = (select auth.uid()) and user_roles.role = 'admin'::text));

alter policy "authenticated users can insert error logs" on public.error_logs
  with check (((select auth.uid()) = user_id) or (user_id is null));

alter policy "users manage their own futures positions" on public.futures_positions
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

alter policy "users manage their own tracked picks" on public.option_tracked_picks
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

alter policy "users manage their own portfolio" on public.portfolio
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

alter policy "users manage their own portfolio snapshots" on public.portfolio_snapshots
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

alter policy "users manage their own notification settings" on public.user_notification_settings
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

alter policy "users manage their own onboarding state" on public.user_onboarding_state
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

alter policy "users read their own roles" on public.user_roles
  using ((select auth.uid()) = user_id);
