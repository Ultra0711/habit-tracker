import { genId, getCompletion, setCompletion, removeCompletion, computeStreaks } from '../domain/habits.js';
import { todayStr } from '../domain/dates.js';
import { fireConfetti } from './confetti.js';
import { showToast } from './toast.js';

// `persist` has one method per mutation kind (insertHabit, updateHabit, deleteHabit,
// archiveHabit, upsertCompletion, deleteCompletion) so each call site persists exactly
// what it changed, rather than re-saving the whole state blob on every action.
let state, persist, renderAll;

let editingHabitId = null;
let selectedPriority = 3;
let selectedTime = 'any';
let selectedFrequency = 'daily';
let selectedDays = [];

let noteModalCtx = null;
let confirmAction = null;

export function initModals(ctx) {
  state = ctx.state;
  persist = ctx.persist;
  renderAll = ctx.renderAll;

  wireHabitModal();
  wireNoteModal();
  wireConfirmModal();

  document.getElementById('fabAdd').addEventListener('click', () => openHabitModal());
  document.getElementById('todayEmptyAddBtn').addEventListener('click', () => openHabitModal());
  document.getElementById('habitsEmptyAddBtn').addEventListener('click', () => openHabitModal());
}

/* =========================================================
   COMPLETION TOGGLE FLOW
   Click cycles: unlogged -> done -> recovery(if minimumVersion set) -> unlogged
   ========================================================= */
export async function cycleCompletion(habitId, dateStr) {
  const habit = state.habits.find(h => h.id === habitId);
  if (!habit) return;
  const existing = getCompletion(habit, dateStr);

  if (!existing) {
    openNoteModal(habitId, dateStr, 'done');
  } else if (existing.status === 'done') {
    if (habit.minimumVersion) {
      setCompletion(habit, dateStr, 'recovery', existing.note);
      renderAll();
      await persist.upsertCompletion(habitId, dateStr, 'recovery', existing.note);
    } else {
      removeCompletion(habit, dateStr);
      renderAll();
      await persist.deleteCompletion(habitId, dateStr);
    }
  } else if (existing.status === 'recovery') {
    removeCompletion(habit, dateStr);
    renderAll();
    await persist.deleteCompletion(habitId, dateStr);
  }
}

/* =========================================================
   NOTE MODAL
   ========================================================= */
function wireNoteModal() {
  document.getElementById('noteSaveBtn').addEventListener('click', () => finalizeNoteCompletion());
  document.getElementById('noteSkipBtn').addEventListener('click', () => closeNoteModal());
  document.getElementById('noteModalCloseBtn').addEventListener('click', () => closeNoteModal());
  document.getElementById('noteText').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) finalizeNoteCompletion();
  });
}

function openNoteModal(habitId, dateStr, status) {
  noteModalCtx = { habitId, dateStr, status };
  document.getElementById('noteText').value = '';
  document.getElementById('noteModalTitle').textContent = status === 'recovery' ? 'Recovery day' : 'Mark complete';
  document.getElementById('noteModalOverlay').classList.add('open');
  document.getElementById('noteText').focus();
}

function closeNoteModal() {
  document.getElementById('noteModalOverlay').classList.remove('open');
  noteModalCtx = null;
}

async function finalizeNoteCompletion() {
  if (!noteModalCtx) return;
  const { habitId, dateStr, status } = noteModalCtx;
  const note = document.getElementById('noteText').value.trim();
  const habit = state.habits.find(h => h.id === habitId);
  if (!habit) { closeNoteModal(); return; }

  const prevLongest = habit.longestStreakCache || 0;

  setCompletion(habit, dateStr, status, note);

  const after = computeStreaks(habit);
  habit._justBeatRecord = false;
  const isNewBest = after.longest > prevLongest && dateStr === todayStr();
  if (isNewBest) {
    habit._justBeatRecord = true;
    habit.longestStreakCache = after.longest;
  } else {
    habit.longestStreakCache = Math.max(prevLongest, after.longest);
  }

  closeNoteModal();
  renderAll();

  await persist.upsertCompletion(habitId, dateStr, status, note);
  if (habit.longestStreakCache !== prevLongest) {
    await persist.updateHabit(habit);
  }

  if (isNewBest) {
    fireConfetti();
    showToast(`New personal best on "${habit.name}"! ${after.longest}-day streak \u{1F3C6}`, { milestone: true, duration: 4200 });
  } else if (status === 'recovery') {
    showToast(`Recovery day logged for "${habit.name}" \u{1F506}`);
  } else {
    showToast(`"${habit.name}" completed for ${dateStr === todayStr() ? 'today' : dateStr} ✅`, {
      undo: async () => {
        removeCompletion(habit, dateStr);
        renderAll();
        await persist.deleteCompletion(habitId, dateStr);
      }
    });
  }
}

/* =========================================================
   CONFIRM MODAL (generic)
   ========================================================= */
function wireConfirmModal() {
  document.getElementById('confirmActionBtn').addEventListener('click', () => {
    if (confirmAction) confirmAction();
    closeConfirmModal();
  });
  document.getElementById('confirmCancelBtn').addEventListener('click', () => closeConfirmModal());
  document.getElementById('confirmModalCloseBtn').addEventListener('click', () => closeConfirmModal());
}

export function openConfirm(title, message, onConfirm) {
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmMessage').textContent = message;
  confirmAction = onConfirm;
  document.getElementById('confirmModalOverlay').classList.add('open');
}

function closeConfirmModal() {
  document.getElementById('confirmModalOverlay').classList.remove('open');
  confirmAction = null;
}

/* =========================================================
   HABIT MODAL (create / edit)
   ========================================================= */
function wireHabitModal() {
  document.getElementById('habitModalCloseBtn').addEventListener('click', () => closeHabitModal());
  document.getElementById('habitModalCancelBtn').addEventListener('click', () => closeHabitModal());

  document.getElementById('priorityPicker').addEventListener('click', (e) => {
    const btn = e.target.closest('button'); if (!btn) return;
    selectedPriority = parseInt(btn.dataset.val, 10);
    syncSegmented('priorityPicker', String(selectedPriority));
  });
  document.getElementById('timePicker').addEventListener('click', (e) => {
    const btn = e.target.closest('button'); if (!btn) return;
    selectedTime = btn.dataset.val;
    syncSegmented('timePicker', selectedTime);
  });
  document.getElementById('frequencyPicker').addEventListener('click', (e) => {
    const btn = e.target.closest('button'); if (!btn) return;
    selectedFrequency = btn.dataset.val;
    syncSegmented('frequencyPicker', selectedFrequency);
    updateFrequencyRows();
  });
  document.getElementById('dayPicker').addEventListener('click', (e) => {
    const btn = e.target.closest('button'); if (!btn) return;
    const day = parseInt(btn.dataset.day, 10);
    const idx = selectedDays.indexOf(day);
    if (idx === -1) selectedDays.push(day); else selectedDays.splice(idx, 1);
    syncDayPicker();
  });

  document.getElementById('habitForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('habitName').value.trim();
    if (!name) return;
    const description = document.getElementById('habitDesc').value.trim();
    const target = Math.max(1, Math.min(7, parseInt(document.getElementById('habitTarget').value, 10) || 3));
    const minimumVersion = document.getElementById('habitMin').value.trim();

    if (selectedFrequency === 'scheduled' && selectedDays.length === 0) {
      showToast('Pick at least one scheduled day.');
      return;
    }

    let habit;
    const wasEditing = Boolean(editingHabitId);
    if (wasEditing) {
      habit = state.habits.find(h => h.id === editingHabitId);
      habit.name = name;
      habit.description = description;
      habit.priority = selectedPriority;
      habit.timeOfDay = selectedTime;
      habit.frequency = selectedFrequency;
      habit.targetPerPeriod = target;
      habit.scheduledDays = selectedDays.slice();
      habit.minimumVersion = minimumVersion;
    } else {
      habit = {
        id: genId(),
        name, description,
        priority: selectedPriority,
        timeOfDay: selectedTime,
        frequency: selectedFrequency,
        targetPerPeriod: target,
        scheduledDays: selectedDays.slice(),
        minimumVersion,
        archived: false,
        createdAt: new Date().toISOString(),
        completions: [],
        longestStreakCache: 0
      };
      state.habits.push(habit);
    }
    closeHabitModal();
    renderAll();
    showToast(wasEditing ? 'Habit updated.' : `"${name}" added \u{1F44D}`);

    if (wasEditing) {
      await persist.updateHabit(habit);
    } else {
      await persist.insertHabit(habit);
    }
  });
}

export function openHabitModal(habitId) {
  editingHabitId = habitId || null;
  const habit = habitId ? state.habits.find(h => h.id === habitId) : null;

  document.getElementById('habitModalTitle').textContent = habit ? 'Edit Habit' : 'New Habit';
  document.getElementById('habitId').value = habitId || '';
  document.getElementById('habitName').value = habit ? habit.name : '';
  document.getElementById('habitDesc').value = habit ? habit.description : '';
  document.getElementById('habitTarget').value = habit ? (habit.targetPerPeriod || 3) : 3;
  document.getElementById('habitMin').value = habit ? habit.minimumVersion : '';

  selectedPriority = habit ? habit.priority : 3;
  selectedTime = habit ? habit.timeOfDay : 'any';
  selectedFrequency = habit ? habit.frequency : 'daily';
  selectedDays = habit ? habit.scheduledDays.slice() : [];

  syncSegmented('priorityPicker', String(selectedPriority));
  syncSegmented('timePicker', selectedTime);
  syncSegmented('frequencyPicker', selectedFrequency);
  syncDayPicker();
  updateFrequencyRows();

  document.getElementById('habitModalOverlay').classList.add('open');
  document.getElementById('habitName').focus();
}

function closeHabitModal() {
  document.getElementById('habitModalOverlay').classList.remove('open');
  editingHabitId = null;
}

function syncSegmented(containerId, val) {
  document.querySelectorAll(`#${containerId} button`).forEach(b => {
    b.classList.toggle('selected', b.dataset.val === val);
  });
}

function syncDayPicker() {
  document.querySelectorAll('#dayPicker button').forEach(b => {
    b.classList.toggle('selected', selectedDays.includes(parseInt(b.dataset.day, 10)));
  });
}

function updateFrequencyRows() {
  document.getElementById('targetRow').style.display = selectedFrequency === 'weekly' ? 'block' : 'none';
  document.getElementById('scheduledRow').style.display = selectedFrequency === 'scheduled' ? 'block' : 'none';
}

/* =========================================================
   ARCHIVE / DELETE
   ========================================================= */
export async function archiveHabit(habitId) {
  const habit = state.habits.find(h => h.id === habitId);
  if (!habit) return;
  habit.archived = !habit.archived;
  renderAll();
  showToast(habit.archived ? `"${habit.name}" archived` : `"${habit.name}" restored`, {
    undo: async () => {
      habit.archived = !habit.archived;
      renderAll();
      await persist.updateHabit(habit);
    }
  });
  await persist.updateHabit(habit);
}

export function deleteHabitPermanently(habitId) {
  const habit = state.habits.find(h => h.id === habitId);
  if (!habit) return;
  openConfirm(
    'Delete habit permanently?',
    `This will permanently delete "${habit.name}" and all its history. This cannot be undone. Consider archiving instead.`,
    async () => {
      state.habits = state.habits.filter(h => h.id !== habitId);
      renderAll();
      showToast(`"${habit.name}" deleted.`);
      await persist.deleteHabit(habitId);
    }
  );
}
