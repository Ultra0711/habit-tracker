const STORAGE_KEY = 'habitTrackerData';
const SCHEMA_VERSION = 1;

function defaultState() {
  return {
    version: SCHEMA_VERSION,
    theme: 'light',
    habits: []
  };
}

// Placeholder for future migrations: if (state.version < 2) { ... state.version = 2 }
// When adding a new habit field, give it a default here, not just at creation time,
// so old saved data gets backfilled on load.
function migrate(state) {
  if (!state.version) state.version = SCHEMA_VERSION;
  if (!Array.isArray(state.habits)) state.habits = [];
  state.habits.forEach(h => {
    if (!Array.isArray(h.completions)) h.completions = [];
    if (h.archived === undefined) h.archived = false;
    if (h.priority === undefined) h.priority = 3;
    if (h.timeOfDay === undefined) h.timeOfDay = 'any';
    if (h.scheduledDays === undefined) h.scheduledDays = [];
    if (h.minimumVersion === undefined) h.minimumVersion = '';
    if (h.longestStreakCache === undefined) h.longestStreakCache = 0;
  });
  return state;
}

// Detect whether localStorage actually persists writes in this context.
// On some browsers, pages opened directly via file:// sandbox storage so writes
// silently no-op or vanish on reload — this check surfaces that instead of
// failing silently.
export function storageIsWritable() {
  try {
    const testKey = '__habitTrackerStorageTest__';
    localStorage.setItem(testKey, '1');
    const ok = localStorage.getItem(testKey) === '1';
    localStorage.removeItem(testKey);
    return ok;
  } catch (e) {
    return false;
  }
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return migrate(parsed);
  } catch (e) {
    console.warn('Failed to load habit data, starting fresh.', e);
    return defaultState();
  }
}

let onSaveError = null;
export function setSaveErrorHandler(fn) {
  onSaveError = fn;
}

export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save habit data to localStorage.', e);
    if (onSaveError) onSaveError(e);
  }
}
