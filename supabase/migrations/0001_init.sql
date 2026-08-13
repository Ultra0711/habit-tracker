-- Habit Tracker schema — Stage 2 (Supabase integration, no auth yet)
--
-- RLS is enabled from the start, but the policies below are TEMPORARY and
-- permissive (any request allowed) because Stage 2 has no authentication yet.
-- Stage 3 (auth) replaces these policies with real auth.uid()-scoped ones —
-- see supabase/migrations/0002_auth_rls.sql. Tables/columns do not change then.

create table if not exists habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid, -- nullable for now; becomes not null + FK to auth.users in Stage 3
  name text not null,
  description text not null default '',
  priority smallint not null default 3,          -- 1 = high, 2 = medium, 3 = low
  time_of_day text not null default 'any',        -- 'any' | 'morning' | 'afternoon' | 'evening'
  frequency text not null default 'daily',        -- 'daily' | 'weekly' | 'scheduled'
  target_per_period smallint not null default 1,  -- used when frequency = 'weekly'
  scheduled_days smallint[] not null default '{}', -- JS-native Sunday=0..Saturday=6, used when frequency = 'scheduled'
  minimum_version text not null default '',
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  longest_streak_cache integer not null default 0 -- NOT the source of truth for display; only used to detect a new personal-best moment
);

create table if not exists completions (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references habits(id) on delete cascade,
  date date not null,
  status text not null,        -- 'done' | 'recovery'
  note text not null default '',
  created_at timestamptz not null default now(),
  unique (habit_id, date)
);

create index if not exists completions_habit_id_idx on completions (habit_id);
create index if not exists habits_user_id_idx on habits (user_id);

alter table habits enable row level security;
alter table completions enable row level security;

-- TEMPORARY permissive policies (Stage 2 only — no auth yet).
-- Replaced in 0002_auth_rls.sql once authentication exists.
drop policy if exists "stage2_allow_all_habits" on habits;
create policy "stage2_allow_all_habits" on habits
  for all using (true) with check (true);

drop policy if exists "stage2_allow_all_completions" on completions;
create policy "stage2_allow_all_completions" on completions
  for all using (true) with check (true);
