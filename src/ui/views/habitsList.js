import { getWeekDates, DAY_LABELS } from '../../domain/dates.js';
import { computeStreaks, totalCompletions, completionPercentage, weekProgress, weeklyTarget } from '../../domain/habits.js';
import { escapeHtml, timeIcon } from '../format.js';
import { openHabitModal, archiveHabit, deleteHabitPermanently } from '../modals.js';
import { revealOnScroll } from '../motion.js';

export function renderHabitsList(state) {
  const list = document.getElementById('habitList');
  const empty = document.getElementById('habitsEmpty');
  const filter = document.getElementById('filterArchived').value;

  let habits = state.habits.slice();
  if (filter === 'active') habits = habits.filter(h => !h.archived);
  else if (filter === 'archived') habits = habits.filter(h => h.archived);

  habits.sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name));

  list.innerHTML = '';
  if (habits.length === 0) { empty.style.display = 'block'; return; }
  empty.style.display = 'none';

  const weekDates = getWeekDates(0);
  habits.forEach(habit => {
    const { current, longest } = computeStreaks(habit);
    const total = totalCompletions(habit);
    const pct = completionPercentage(habit);
    const prog = weekProgress(habit, weekDates);
    const target = weeklyTarget(habit);

    const freqLabel = habit.frequency === 'daily' ? 'Daily'
      : habit.frequency === 'weekly' ? `${habit.targetPerPeriod}x / week`
      : `Scheduled: ${habit.scheduledDays.slice().sort().map(d => DAY_LABELS[(d + 6) % 7]).join(', ')}`;

    const card = document.createElement('div');
    card.className = `habit-card priority-${habit.priority}` + (habit.archived ? ' archived' : '');
    card.dataset.habitId = habit.id;
    card.innerHTML = `
      <div class="habit-row-top">
        <div class="habit-info">
          <div class="habit-name-row">
            <p class="habit-name">${escapeHtml(habit.name)}</p>
            ${habit.timeOfDay !== 'any' ? `<span class="time-chip">${timeIcon(habit.timeOfDay)}</span>` : ''}
            ${habit.archived ? '<span class="badge badge-archived">Archived</span>' : ''}
          </div>
          ${habit.description ? `<p class="habit-desc">${escapeHtml(habit.description)}</p>` : ''}
          <p class="habit-desc">${freqLabel}${habit.minimumVersion ? ` &middot; Min: ${escapeHtml(habit.minimumVersion)}` : ''}</p>
          <div class="habit-meta-row">
            <span class="badge badge-streak">&#128293; ${current}</span>
            <span class="badge badge-best">&#127942; ${longest}</span>
            <span class="badge badge-progress-ok">${total} total</span>
            <span class="badge badge-progress-low">${pct}% rate</span>
          </div>
          <div class="week-progress-inline">
            <span class="wp-label">${prog}/${target}</span>
            <div class="progress-bar-track"><div class="progress-bar-fill" style="width:${Math.min(100, (prog / target) * 100)}%"></div></div>
          </div>
        </div>
        <div class="habit-actions">
          <button class="icon-btn" title="Edit" data-act="edit" data-id="${habit.id}">&#9998;&#65039;</button>
          <button class="icon-btn" title="${habit.archived ? 'Restore' : 'Archive'}" data-act="archive" data-id="${habit.id}">${habit.archived ? '&#8635;' : '&#128230;'}</button>
          <button class="icon-btn danger" title="Delete permanently" data-act="delete" data-id="${habit.id}">&#128465;&#65039;</button>
        </div>
      </div>
    `;
    list.appendChild(card);
  });

  list.querySelectorAll('[data-act="edit"]').forEach(b => b.addEventListener('click', () => openHabitModal(b.dataset.id)));
  list.querySelectorAll('[data-act="archive"]').forEach(b => b.addEventListener('click', () => archiveHabit(b.dataset.id)));
  list.querySelectorAll('[data-act="delete"]').forEach(b => b.addEventListener('click', () => deleteHabitPermanently(b.dataset.id)));

  revealOnScroll(list, { getKey: (el) => el.dataset.habitId });
}
