-- Career Coach customer-support chat log, written server-side by
-- functions/api/support.js (the Customer Support widget's backend).
-- No name, email, or payment columns exist in this table at all, and the
-- function scrubs message text for emails/phone numbers/card-like digit
-- runs before writing. Browsers never write here directly; only the
-- support backend does, using the same publishable anon key pattern as
-- the `events` and `customers` tables. Run this once in the Supabase SQL
-- Editor (dashboard access required). See ceo/customer-service/CLAUDE.md.

create table if not exists public.support_messages (
  id                 bigint generated always as identity primary key,
  created_at         timestamptz not null default now(),
  conversation_id    uuid not null,
  page               text check (char_length(page) <= 40),
  user_message       text not null check (char_length(user_message) <= 2000),
  assistant_message  text not null check (char_length(assistant_message) <= 2000),
  escalated          boolean not null default false,
  blocked            boolean not null default false
);

create index if not exists support_messages_created_at_idx      on public.support_messages (created_at);
create index if not exists support_messages_conversation_idx    on public.support_messages (conversation_id, created_at);

alter table public.support_messages enable row level security;

-- Insert-only, same as events/customers: nobody can read, change, or
-- delete rows through the public key, including the function itself.
revoke all on public.support_messages from anon, authenticated;
grant insert on public.support_messages to anon, authenticated;

drop policy if exists "support backend can log turns" on public.support_messages;
create policy "support backend can log turns"
  on public.support_messages for insert
  to anon, authenticated
  with check (true);
