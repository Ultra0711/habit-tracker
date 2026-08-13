import { loadState as loadLocalState } from '../state/store.js';
import { genId } from '../domain/habits.js';
import { insertHabit, upsertCompletion, fetchHabits } from './db.js';

// Old (pre-Supabase) habit ids came from Date.now().toString(36)+random(), not
// crypto.randomUUID() — they won't satisfy the `habits.id uuid` column, so
// migration always mints fresh UUIDs and remaps completions to match.

const MIGRATED_FLAG_PREFIX = 'habitTrackerMigratedTo_';

function migratedFlagKey(userId) {
  return `${MIGRATED_FLAG_PREFIX}${userId}`;
}

/** True if this browser has local habit data that hasn't been imported into `userId`'s account yet. */
export function hasUnmigratedLocalData(userId) {
  try {
    if (localStorage.getItem(migratedFlagKey(userId))) return false;
    const local = loadLocalState();
    return local.habits.length > 0;
  } catch (e) {
    return false;
  }
}

function markMigrated(userId) {
  try {
    localStorage.setItem(migratedFlagKey(userId), new Date().toISOString());
  } catch (e) {
    // non-fatal — worst case the user is offered the import prompt again next sign-in
  }
}

/** Habit/completion counts for the confirm-import prompt, without writing anything. */
export function previewLocalData() {
  const local = loadLocalState();
  const completionCount = local.habits.reduce((sum, h) => sum + h.completions.length, 0);
  return { habitCount: local.habits.length, completionCount };
}

/**
 * Imports the local browser's habitTrackerData into the signed-in user's Supabase
 * account: mints a new UUID per habit, inserts each habit then its completions in
 * order, and stops on the first failure (reporting how many succeeded) rather than
 * silently leaving a half-imported account. Local data is left untouched — this is
 * additive, not a move — so nothing is lost if something goes wrong.
 *
 * Guards against importing into an account that already has habits, since that's
 * almost always a sign the user is re-triggering an import rather than doing a
 * fresh one, and blind re-import would duplicate everything.
 */
export async function migrateLocalDataToSupabase(userId, { onProgress } = {}) {
  const local = loadLocalState();
  if (local.habits.length === 0) {
    return { imported: 0, completions: 0, skipped: true };
  }

  const existing = await fetchHabits();
  if (existing.length > 0) {
    throw new Error('This account already has habits — skipping import to avoid duplicates.');
  }

  let importedHabits = 0;
  let importedCompletions = 0;

  for (const habit of local.habits) {
    const newId = genId();
    const habitForInsert = { ...habit, id: newId };
    await insertHabit(habitForInsert, userId);
    importedHabits++;
    if (onProgress) onProgress({ habitsDone: importedHabits, habitsTotal: local.habits.length });

    for (const c of habit.completions) {
      await upsertCompletion(newId, c.date, c.status, c.note);
      importedCompletions++;
    }
  }

  markMigrated(userId);
  return { imported: importedHabits, completions: importedCompletions, skipped: false };
}

/** Dismiss the import prompt for this account without importing (e.g. user declines). */
export function skipMigrationForUser(userId) {
  markMigrated(userId);
}
