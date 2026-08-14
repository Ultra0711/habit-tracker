import './style.css';

import { fetchHabits, insertHabit, updateHabit, deleteHabit, upsertCompletion, deleteCompletion } from './lib/db.js';
import { hasUnmigratedLocalData, previewLocalData, migrateLocalDataToSupabase } from './lib/migrateLocalData.js';
import { applyTheme, initThemeToggle, loadTheme } from './ui/theme.js';
import { initConfetti } from './ui/confetti.js';
import { initModals, openConfirm } from './ui/modals.js';
import { initAuthGate } from './ui/authGate.js';
import { showToast } from './ui/toast.js';
import { renderStatGrid, renderTodayList } from './ui/views/today.js';
import { renderHabitsList } from './ui/views/habitsList.js';
import { renderWeekGrid, initWeekGridNav } from './ui/views/weekGrid.js';
import { renderAchievements } from './ui/views/achievements.js';
import { renderReview } from './ui/views/review.js';
import { initTabNavScroll, moveIndicatorToActiveTab } from './ui/tabNav.js';
import { prefersReducedMotion } from './ui/motion.js';

let state = { theme: loadTheme(), habits: [] };
let currentUserId = null;
let wired = false;

applyTheme(state.theme);
initThemeToggle(state); // independent of auth state — the toggle is always visible in the header

function renderAll() {
  renderStatGrid(state);
  renderTodayList(state);
  renderHabitsList(state);
  renderWeekGrid(state);
  renderAchievements(state);
  renderReview(state);
  document.getElementById('dateSub').textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

// Each mutation site persists exactly what it changed via db.js, scoped to the
// signed-in user. Failures surface as a toast rather than failing silently —
// the in-memory state has already been updated optimistically by the caller.
const persist = {
  async insertHabit(habit) {
    try { await insertHabit(habit, currentUserId); }
    catch (e) { console.error(e); showToast('Failed to save habit to the cloud: ' + e.message); }
  },
  async updateHabit(habit) {
    try { await updateHabit(habit, currentUserId); }
    catch (e) { console.error(e); showToast('Failed to save changes to the cloud: ' + e.message); }
  },
  async deleteHabit(habitId) {
    try { await deleteHabit(habitId); }
    catch (e) { console.error(e); showToast('Failed to delete habit in the cloud: ' + e.message); }
  },
  async upsertCompletion(habitId, dateStr, status, note) {
    try { await upsertCompletion(habitId, dateStr, status, note); }
    catch (e) { console.error(e); showToast('Failed to save completion to the cloud: ' + e.message); }
  },
  async deleteCompletion(habitId, dateStr) {
    try { await deleteCompletion(habitId, dateStr); }
    catch (e) { console.error(e); showToast('Failed to remove completion in the cloud: ' + e.message); }
  }
};

function wireOnce() {
  if (wired) return;
  wired = true;

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.classList.contains('active')) return; // already on this tab — nothing to transition

      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      btn.classList.add('active');
      moveIndicatorToActiveTab();

      const nextView = document.getElementById('view-' + btn.dataset.view);
      nextView.classList.add('active');
      renderAll();

      if (!prefersReducedMotion()) {
        // Re-trigger the enter animation even if this class name was left over from
        // a previous switch: force a reflow between remove/add so the animation
        // restarts rather than being a no-op class toggle.
        nextView.classList.remove('view-entering');
        void nextView.offsetWidth;
        nextView.classList.add('view-entering');
        nextView.addEventListener('animationend', () => nextView.classList.remove('view-entering'), { once: true });
      }
    });
  });

  initConfetti();
  initModals({ state, persist, renderAll });
  initWeekGridNav(() => renderWeekGrid(state));
  initTabNavScroll();
  document.getElementById('filterArchived').addEventListener('change', () => renderHabitsList(state));
}

async function offerLocalDataImport(userId) {
  if (!hasUnmigratedLocalData(userId)) return;
  const { habitCount, completionCount } = previewLocalData();

  openConfirm(
    'Import habits from this browser?',
    `Found ${habitCount} habit${habitCount === 1 ? '' : 's'} with ${completionCount} completion${completionCount === 1 ? '' : 's'} saved locally in this browser, from before cloud sync was added. Import them into your account? This only runs once — your local data is left untouched either way.`,
    async () => {
      try {
        const result = await migrateLocalDataToSupabase(userId);
        if (!result.skipped) {
          showToast(`Imported ${result.imported} habit${result.imported === 1 ? '' : 's'} and ${result.completions} completion${result.completions === 1 ? '' : 's'}.`);
          state.habits = await fetchHabits();
          renderAll();
        }
      } catch (e) {
        console.error(e);
        showToast('Import failed: ' + e.message);
      }
    }
  );
}

async function loadForUser(userId) {
  currentUserId = userId;
  try {
    state.habits = await fetchHabits();
  } catch (e) {
    console.error(e);
    showToast('Failed to load your habits: ' + e.message);
    state.habits = [];
  }
  wireOnce();
  renderAll();
  offerLocalDataImport(userId);
}

function clearOnSignOut() {
  currentUserId = null;
  state.habits = [];
}

initAuthGate({
  onSignedIn: (session) => loadForUser(session.user.id),
  onSignedOut: clearOnSignOut
});
