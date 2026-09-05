alter table public.conversation_messages
  add column if not exists processing_status text not null default 'received',
  add column if not exists processing_error text,
  add column if not exists processed_at timestamptz;

alter table public.conversation_messages
  drop constraint if exists conversation_messages_processing_status_check;

alter table public.conversation_messages
  add constraint conversation_messages_processing_status_check
  check (processing_status in ('received','processing','completed','failed'));

create unique index if not exists conversation_messages_telegram_update_id_uidx
  on public.conversation_messages (telegram_update_id)
  where telegram_update_id is not null;

create index if not exists conversation_messages_user_created_idx
  on public.conversation_messages (user_id, created_at desc);

create index if not exists conversation_messages_processing_status_idx
  on public.conversation_messages (processing_status)
  where processing_status in ('received','processing','failed');
