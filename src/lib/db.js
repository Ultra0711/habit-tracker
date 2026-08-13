import { supabase, supabaseConfigured } from './supabaseClient.js';

// Data-access layer: the only module that talks to Supabase tables.
// UI/domain code works with the app's in-memory habit shape
// { id, name, description, priority, timeOfDay, frequency, targetPerPeriod,
//   scheduledDays, minimumVersion, archived, createdAt, completions[], longestStreakCache }
// — this file translates to/from the snake_case Supabase row shape.

function rowToHabit(row, completions) {
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    priority: row.priority,
    timeOfDay: row.time_of_day,
    frequency: row.frequency,
    targetPerPeriod: row.target_per_period,
    scheduledDays: row.scheduled_days || [],
    minimumVersion: row.minimum_version || '',
    archived: row.archived,
    createdAt: row.created_at,
    longestStreakCache: row.longest_streak_cache || 0,
    completions: (completions || []).map(c => ({
      date: c.date,
      status: c.status,
      note: c.note || ''
    }))
  };
}

function habitToRow(habit, userId) {
  return {
    id: habit.id,
    user_id: userId ?? null,
    name: habit.name,
    description: habit.description || '',
    priority: habit.priority,
    time_of_day: habit.timeOfDay,
    frequency: habit.frequency,
    target_per_period: habit.targetPerPeriod,
    scheduled_days: habit.scheduledDays || [],
    minimum_version: habit.minimumVersion || '',
    archived: habit.archived,
    created_at: habit.createdAt,
    longest_streak_cache: habit.longestStreakCache || 0
  };
}

function assertConfigured() {
  if (!supabaseConfigured) {
    throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local.');
  }
}

/** Fetch all habits (with their completions) for the current session. */
export async function fetchHabits() {
  assertConfigured();
  const { data: habitRows, error: habitsErr } = await supabase
    .from('habits')
    .select('*')
    .order('created_at', { ascending: true });
  if (habitsErr) throw habitsErr;

  if (!habitRows || habitRows.length === 0) return [];

  const habitIds = habitRows.map(h => h.id);
  const { data: completionRows, error: compErr } = await supabase
    .from('completions')
    .select('*')
    .in('habit_id', habitIds);
  if (compErr) throw compErr;

  const completionsByHabit = new Map();
  (completionRows || []).forEach(c => {
    if (!completionsByHabit.has(c.habit_id)) completionsByHabit.set(c.habit_id, []);
    completionsByHabit.get(c.habit_id).push(c);
  });

  return habitRows.map(row => rowToHabit(row, completionsByHabit.get(row.id)));
}

/** Insert a new habit (completions[] on the input is ignored — new habits start empty). */
export async function insertHabit(habit, userId) {
  assertConfigured();
  const { data, error } = await supabase
    .from('habits')
    .insert(habitToRow(habit, userId))
    .select()
    .single();
  if (error) throw error;
  return rowToHabit(data, []);
}

/** Update a habit's own fields (not its completions — use upsertCompletion/deleteCompletion for those). */
export async function updateHabit(habit, userId) {
  assertConfigured();
  const { error } = await supabase
    .from('habits')
    .update(habitToRow(habit, userId))
    .eq('id', habit.id);
  if (error) throw error;
}

export async function deleteHabit(habitId) {
  assertConfigured();
  const { error } = await supabase.from('habits').delete().eq('id', habitId);
  if (error) throw error;
}

/** Create or overwrite the completion for a given habit+date (status: 'done' | 'recovery'). */
export async function upsertCompletion(habitId, dateStr, status, note) {
  assertConfigured();
  const { error } = await supabase
    .from('completions')
    .upsert({ habit_id: habitId, date: dateStr, status, note: note || '' }, { onConflict: 'habit_id,date' });
  if (error) throw error;
}

export async function deleteCompletion(habitId, dateStr) {
  assertConfigured();
  const { error } = await supabase
    .from('completions')
    .delete()
    .eq('habit_id', habitId)
    .eq('date', dateStr);
  if (error) throw error;
}
