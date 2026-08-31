-- Real conversation persistence for the market-chat assistant. The
-- floating "Market Chat" widget has never had this -- every reload wiped
-- its history -- and the new full-page chat needs multiple named,
-- switchable conversations the way any chat product does.
create table if not exists public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'New chat',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chat_conversations_user_updated_idx
  on public.chat_conversations (user_id, updated_at desc);

alter table public.chat_conversations enable row level security;

create policy "users manage their own chat conversations"
  on public.chat_conversations for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_conversation_idx
  on public.chat_messages (conversation_id, created_at asc);

alter table public.chat_messages enable row level security;

-- Scoped through the parent conversation's ownership rather than a
-- user_id column of its own -- a message has no meaning outside its
-- conversation, so this is the one source of truth for who can see it.
create policy "users manage messages in their own conversations"
  on public.chat_messages for all
  to authenticated
  using (exists (
    select 1 from public.chat_conversations c
    where c.id = conversation_id and c.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.chat_conversations c
    where c.id = conversation_id and c.user_id = auth.uid()
  ));
