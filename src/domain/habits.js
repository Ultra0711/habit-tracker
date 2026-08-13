import { fmtDate, jsDow, addDays, getWeekDates } from './dates.js';

// Habit ids are UUIDs to match the Supabase `habits.id uuid` column.
export function genId() {
  return crypto.randomUUID();
}

// Single gate for "does this habit apply to this date" — used by streak calculation,
// completion percentage, the weekly grid, and the Today view. Extend here, don't duplicate.
export function isScheduledOn(habit, date) {
  if (habit.frequency === 'daily') return true;
  if (habit.frequency === 'weekly') return true; // any day counts toward weekly target
  if (habit.frequency === 'scheduled') {
    return habit.scheduledDays.includes(jsDow(date));
  }
  return true;
}

export function getCompletion(habit, dateStr) {
  return habit.completions.find(c => c.date === dateStr);
}

export function setCompletion(habit, dateStr, status, note) {
  let c = getCompletion(habit, dateStr);
  if (!c) {
    c = { date: dateStr, status, note: note || '' };
    habit.completions.push(c);
  } else {
    c.status = status;
    c.note = note || '';
  }
}

export function removeCompletion(habit, dateStr) {
  habit.completions = habit.completions.filter(c => c.date !== dateStr);
}

// Completed statuses that count as a "full" completion (for totals, streak continuation)
export function isDone(c) { return c && c.status === 'done'; }
export function isRecovery(c) { return c && c.status === 'recovery'; }
export function isLoggedAny(c) { return c && (c.status === 'done' || c.status === 'recovery'); }

/* --- Streak calculation (source of truth = completions array) ---
   A day counts toward the streak if it's scheduled and has a 'done' completion.
   A 'recovery' completion preserves (does not break) the streak but does not increment it further
   beyond keeping continuity — it's clearly distinguished from a real completion. */
export function computeStreaks(habit) {
  const compMap = new Map(habit.completions.map(c => [c.date, c]));
  const today = new Date(); today.setHours(0, 0, 0, 0);

  // current streak: walk backward from today (or yesterday if today not yet logged) through
  // consecutive scheduled days that are done or recovery.
  let current = 0;
  let cursor = new Date(today);
  const todayC = compMap.get(fmtDate(cursor));
  if (!isLoggedAny(todayC) && isScheduledOn(habit, cursor)) {
    cursor = addDays(cursor, -1); // today not done yet, don't break streak, start check from yesterday
  }
  for (let i = 0; i < 3660; i++) {
    if (!isScheduledOn(habit, cursor)) { cursor = addDays(cursor, -1); continue; }
    const c = compMap.get(fmtDate(cursor));
    if (isLoggedAny(c)) {
      current++;
      cursor = addDays(cursor, -1);
    } else {
      break;
    }
  }

  // longest streak ever: scan all scheduled days from creation to today chronologically
  let longest = 0, run = 0;
  const created = habit.createdAt ? new Date(habit.createdAt) : today;
  created.setHours(0, 0, 0, 0);
  let d = new Date(created);
  while (d <= today) {
    if (isScheduledOn(habit, d)) {
      const c = compMap.get(fmtDate(d));
      if (isLoggedAny(c)) {
        run++;
        if (run > longest) longest = run;
      } else {
        run = 0;
      }
    }
    d = addDays(d, 1);
  }

  return { current, longest };
}

export function totalCompletions(habit) {
  return habit.completions.filter(c => c.status === 'done').length;
}

export function weeklyTarget(habit) {
  if (habit.frequency === 'daily') return 7;
  if (habit.frequency === 'weekly') return habit.targetPerPeriod || 1;
  if (habit.frequency === 'scheduled') return habit.scheduledDays.length || 1;
  return 1;
}

export function weekProgress(habit, weekDates) {
  let count = 0;
  weekDates.forEach(d => {
    const c = getCompletion(habit, fmtDate(d));
    if (isDone(c)) count++;
  });
  return count;
}

export function completionPercentage(habit) {
  const compMap = new Map(habit.completions.map(c => [c.date, c]));
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const created = habit.createdAt ? new Date(habit.createdAt) : today;
  created.setHours(0, 0, 0, 0);
  let scheduled = 0, done = 0;
  let d = new Date(created);
  while (d <= today) {
    if (isScheduledOn(habit, d)) {
      scheduled++;
      const c = compMap.get(fmtDate(d));
      if (isLoggedAny(c)) done++;
    }
    d = addDays(d, 1);
  }
  if (scheduled === 0) return 0;
  return Math.round((done / scheduled) * 100);
}

// Consistency score: weighted completion rate over last N days (scheduled days only),
// more recent days weighted slightly higher than a flat average.
export function consistencyScore(habits, days) {
  days = days || 14;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const active = habits.filter(h => !h.archived);
  if (active.length === 0) return 0;

  let weightedDone = 0, weightedTotal = 0;
  for (let i = 0; i < days; i++) {
    const d = addDays(today, -i);
    const weight = 1 + (days - i) / days; // recent days weigh up to 2x
    active.forEach(h => {
      const createdAt = h.createdAt ? new Date(h.createdAt) : d;
      createdAt.setHours(0, 0, 0, 0);
      if (d < createdAt) return;
      if (!isScheduledOn(h, d)) return;
      weightedTotal += weight;
      const c = getCompletion(h, fmtDate(d));
      if (isLoggedAny(c)) weightedDone += weight;
    });
  }
  if (weightedTotal === 0) return 0;
  return Math.round((weightedDone / weightedTotal) * 100);
}

export { getWeekDates };
