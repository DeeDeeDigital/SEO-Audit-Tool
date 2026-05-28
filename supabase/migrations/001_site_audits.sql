-- SEO Audit Tool — site_audits table
-- Run this in the Supabase SQL editor for your project

create table if not exists public.site_audits (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users on delete cascade not null,
  domain       text not null,
  name         text,
  sections     jsonb not null default '{}',
  technical_data jsonb,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Index for user lookups
create index if not exists site_audits_user_id_idx on public.site_audits (user_id);

-- Auto-update updated_at on row changes
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists site_audits_updated_at on public.site_audits;
create trigger site_audits_updated_at
  before update on public.site_audits
  for each row execute function public.touch_updated_at();

-- Row-level security: users can only see and modify their own audits
alter table public.site_audits enable row level security;

create policy "Users manage own audits"
  on public.site_audits
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
