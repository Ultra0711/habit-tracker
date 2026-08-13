// Stage 2 CRUD smoke test — exercises db.js against your live Supabase project,
// independent of the main app (which still runs on localStorage until Stage 3 auth
// is wired up). Open /smoketest.html in dev to run it.
//
// Not part of the production build's entry point; safe to delete once Stage 3 lands.

import { supabaseConfigured } from './supabaseClient.js';
import { fetchHabits, insertHabit, updateHabit, deleteHabit, upsertCompletion, deleteCompletion } from './db.js';
import { computeStreaks, totalCompletions } from '../domain/habits.js';
import { todayStr, addDays, fmtDate } from '../domain/dates.js';

const log = document.getElementById('log');
function print(label, ok, detail) {
  const line = document.createElement('div');
  line.className = ok ? 'pass' : 'fail';
  line.textContent = `${ok ? '✅' : '❌'} ${label}${detail ? ' — ' + detail : ''}`;
  log.appendChild(line);
  console.log(label, detail || '');
}

async function run() {
  if (!supabaseConfigured) {
    print('Supabase not configured', false, 'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local, then restart npm run dev.');
    return;
  }

  let testHabit;
  try {
    // 1. Insert
    testHabit = await insertHabit({
      id: crypto.randomUUID(),
      name: 'Smoke Test Habit',
      description: 'Created by db.smoketest.js',
      priority: 2,
      timeOfDay: 'any',
      frequency: 'daily',
      targetPerPeriod: 1,
      scheduledDays: [],
      minimumVersion: '',
      archived: false,
      createdAt: new Date().toISOString(),
      longestStreakCache: 0
    });
    print('insertHabit', true, `id=${testHabit.id}`);

    // 2. Fetch and confirm it's there
    let habits = await fetchHabits();
    const found = habits.find(h => h.id === testHabit.id);
    print('fetchHabits finds new habit', Boolean(found));

    // 3. Update a field
    testHabit.name = 'Smoke Test Habit (renamed)';
    await updateHabit(testHabit);
    habits = await fetchHabits();
    const renamed = habits.find(h => h.id === testHabit.id);
    print('updateHabit persists rename', renamed && renamed.name === 'Smoke Test Habit (renamed)');

    // 4. Log completions for the last 3 days to build a streak
    const dates = [addDays(new Date(), -2), addDays(new Date(), -1), new Date()].map(fmtDate);
    for (const d of dates) {
      await upsertCompletion(testHabit.id, d, 'done', 'smoke test note');
    }
    habits = await fetchHabits();
    let habit = habits.find(h => h.id === testHabit.id);
    print('upsertCompletion wrote 3 completions', habit.completions.length === 3, `got ${habit.completions.length}`);

    // 5. Streak calculation should see a 3-day current streak
    const { current, longest } = computeStreaks(habit);
    print('computeStreaks current streak = 3', current === 3, `current=${current}, longest=${longest}`);
    print('totalCompletions = 3', totalCompletions(habit) === 3, `got ${totalCompletions(habit)}`);

    // 6. Remove one completion, streak engine should recompute from source data
    await deleteCompletion(testHabit.id, dates[0]);
    habits = await fetchHabits();
    habit = habits.find(h => h.id === testHabit.id);
    print('deleteCompletion removed a row', habit.completions.length === 2, `got ${habit.completions.length}`);

    // 7. Cleanup
    await deleteHabit(testHabit.id);
    habits = await fetchHabits();
    const stillThere = habits.some(h => h.id === testHabit.id);
    print('deleteHabit cascades cleanup (habit + completions gone)', !stillThere);

    print('All done', true, 'If every line above is ✅, Stage 2 CRUD + streak calc against Supabase is working.');
  } catch (e) {
    print('Unexpected error', false, e.message || String(e));
    console.error(e);
    // best-effort cleanup so re-runs don't accumulate junk rows
    if (testHabit) {
      try { await deleteHabit(testHabit.id); } catch (_) { /* ignore */ }
    }
  }
}

run();
