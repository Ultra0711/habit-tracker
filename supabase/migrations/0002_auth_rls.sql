-- Habit Tracker schema — Stage 3 (Authentication + real RLS)
--
-- DO NOT RUN THIS YET. This file documents the Stage 3 migration and will be
-- applied once auth is wired into the app (see CLAUDE.md / migration plan).
-- It tightens habits.user_id to be required and scopes all access to the
-- signed-in user via auth.uid(), replacing the permissive Stage 2 policies.

alter table habits
  alter column user_id set not null,
  add constraint habits_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;

drop policy if exists "stage2_allow_all_habits" on habits;
drop policy if exists "stage2_allow_all_completions" on completions;

create policy "habits_select_own" on habits
  for select using (auth.uid() = user_id);
create policy "habits_insert_own" on habits
  for insert with check (auth.uid() = user_id);
create policy "habits_update_own" on habits
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "habits_delete_own" on habits
  for delete using (auth.uid() = user_id);

create policy "completions_select_own" on completions
  for select using (
    exists (select 1 from habits where habits.id = completions.habit_id and habits.user_id = auth.uid())
  );
create policy "completions_insert_own" on completions
  for insert with check (
    exists (select 1 from habits where habits.id = completions.habit_id and habits.user_id = auth.uid())
  );
create policy "completions_update_own" on completions
  for update using (
    exists (select 1 from habits where habits.id = completions.habit_id and habits.user_id = auth.uid())
  ) with check (
    exists (select 1 from habits where habits.id = completions.habit_id and habits.user_id = auth.uid())
  );
create policy "completions_delete_own" on completions
  for delete using (
    exists (select 1 from habits where habits.id = completions.habit_id and habits.user_id = auth.uid())
  );
