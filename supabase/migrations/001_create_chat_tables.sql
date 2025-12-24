-- Supabase SQL migration for FindAba realtime chat
-- Tables: conversations, participants, messages
-- Storage bucket expected: "chat-attachments"

create extension if not exists "uuid-ossp";

-- Conversations
create table if not exists conversations (
  id uuid primary key default uuid_generate_v4(),
  title text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  last_message_at timestamptz
);

-- Participants (each user who belongs to a conversation)
create table if not exists participants (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  user_id uuid not null,
  role text check (role in ('buyer','merchant','logistics','admin')) default 'buyer',
  joined_at timestamptz default now(),
  metadata jsonb default '{}'::jsonb,
  unique (conversation_id, user_id)
);

create index if not exists idx_participants_conversation on participants(conversation_id);
create index if not exists idx_participants_user on participants(user_id);

-- Messages
create table if not exists messages (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_id uuid not null,
  body text,
  attachments jsonb default '[]'::jsonb, -- array of {url, name, mime, size}
  status text not null default 'sent', -- sent | delivered | read
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_messages_conversation_created on messages(conversation_id, created_at desc);
create index if not exists idx_messages_sender on messages(sender_id);

-- Enable Row Level Security (RLS)
alter table conversations enable row level security;
alter table participants enable row level security;
alter table messages enable row level security;

-- Policies:
-- 1) Conversations: participants can SELECT; participants or creators can INSERT
create policy "conversations_select_if_participant" on conversations
  for select
  using (exists (
    select 1 from participants p where p.conversation_id = conversations.id and p.user_id = auth.uid()
  ));

create policy "conversations_insert_if_part_of_payload" on conversations
  for insert
  with check (true); -- allow insert; we'll rely on a function for correct participant creation

-- 2) Participants: allow users to be added where user_id = auth.uid() OR allow selects if querying participant row
create policy "participants_insert_self" on participants
  for insert
  with check (user_id = auth.uid());

create policy "participants_select_if_participant" on participants
  for select
  using (user_id = auth.uid() or exists (select 1 from participants p where p.user_id = auth.uid() and p.conversation_id = participants.conversation_id));

-- 3) Messages: only conversation participants can SELECT; only sender (auth.uid()) can INSERT for themselves
create policy "messages_select_if_participant" on messages
  for select
  using (exists (select 1 from participants p where p.conversation_id = messages.conversation_id and p.user_id = auth.uid()));

create policy "messages_insert_if_sender_is_auth" on messages
  for insert
  with check (sender_id = auth.uid() and exists (select 1 from participants p where p.conversation_id = messages.conversation_id and p.user_id = auth.uid()));

-- Allow updates to message status by participants (e.g., recipient marking delivered/read)
create policy "messages_update_by_participant" on messages
  for update
  using (exists (select 1 from participants p where p.conversation_id = messages.conversation_id and p.user_id = auth.uid()))
  with check (exists (select 1 from participants p where p.conversation_id = messages.conversation_id and p.user_id = auth.uid()));

-- Helper function to create a conversation and participants atomically
create or replace function create_conversation_with_participants(
  title text,
  user_ids uuid[],
  roles text[] default null,
  metadata jsonb default '{}'::jsonb
) returns uuid language plpgsql as $$
declare
  conv_id uuid;
  i integer := 1;
  r text;
begin
  insert into conversations (title, metadata) values (title, metadata) returning id into conv_id;

  if roles is null or array_length(roles,1) is null then
    foreach r in array['buyer','merchant'] loop
      null; -- we'll fallback to default roles below
    end loop;
  end if;

  foreach i in array_lower(user_ids,1)..array_upper(user_ids,1) loop
    insert into participants (conversation_id, user_id, role)
    values (
      conv_id,
      user_ids[i],
      case when roles is not null and array_length(roles,1) >= i then roles[i] else 'buyer' end
    );
  end loop;

  return conv_id;
end;
$$;

-- Make function executable by authenticated users (if you want to restrict you can modify later)
grant execute on function create_conversation_with_participants(text, uuid[], text[], jsonb) to authenticated;
