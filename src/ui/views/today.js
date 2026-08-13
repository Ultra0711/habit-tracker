import { getWeekDates, todayStr, fmtDate } from '../../domain/dates.js';
import { isScheduledOn, getCompletion, isDone, isRecovery, computeStreaks, weekProgress, weeklyTarget, totalCompletions } from '../../domain/habits.js';
import { escapeHtml, timeIcon } from '../format.js';
import { cycleCompletion } from '../modals.js';

export function renderStatGrid(state) {
  const grid = document.getElementById('statGrid');
  const active = state.habits.filter(h => !h.archived);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const weekDates = getWeekDates(0);
  grid.innerHTML = buildStatGridHtml(active, today, weekDates);
}

function buildStatGridHtml(active, today, weekDates) {
  const todayScheduled = active.filter(h => isScheduledOn(h, today));
  const todayDone = todayScheduled.filter(h => isDone(getCompletion(h, todayStr())));
  const todayPct = todayScheduled.length ? Math.round((todayDone.length / todayScheduled.length) * 100) : 0;

  let weekScheduledCount = 0, weekDoneCount = 0;
  active.forEach(h => {
    weekDates.forEach(d => {
      if (isScheduledOn(h, d) && d <= today) {
        weekScheduledCount++;
        if (isDone(getCompletion(h, fmtDate(d)))) weekDoneCount++;
      }
    });
  });
  const weekPct = weekScheduledCount ? Math.round((weekDoneCount / weekScheduledCount) * 100) : 0;

  let maxCurrentStreak = 0, maxLongestStreak = 0, totalDoneAll = 0;
  active.forEach(h => {
    const { current, longest } = computeStreaks(h);
    if (current > maxCurrentStreak) maxCurrentStreak = current;
    if (longest > maxLongestStreak) maxLongestStreak = longest;
    totalDoneAll += totalCompletions(h);
  });

  return `
    <div class="stat-card">
      <span class="stat-icon">&#9989;</span>
      <div class="stat-value">${todayDone.length}/${todayScheduled.length}</div>
      <div class="stat-label">Today (${todayPct}%)</div>
      <div class="progress-bar-track"><div class="progress-bar-fill" style="width:${todayPct}%"></div></div>
    </div>
    <div class="stat-card">
      <span class="stat-icon">&#128197;</span>
      <div class="stat-value">${weekPct}%</div>
      <div class="stat-label">Week Completion</div>
      <div class="progress-bar-track"><div class="progress-bar-fill" style="width:${weekPct}%"></div></div>
    </div>
    <div class="stat-card">
      <span class="stat-icon">&#128293;</span>
      <div class="stat-value">${maxCurrentStreak}</div>
      <div class="stat-label">Best Current Streak</div>
    </div>
    <div class="stat-card">
      <span class="stat-icon">&#127942;</span>
      <div class="stat-value">${maxLongestStreak}</div>
      <div class="stat-label">Longest Streak Ever</div>
    </div>
    <div class="stat-card">
      <span class="stat-icon">&#128200;</span>
      <div class="stat-value">${totalDoneAll}</div>
      <div class="stat-label">Total Completions</div>
    </div>
  `;
}

export function renderTodayList(state) {
  const list = document.getElementById('todayList');
  const empty = document.getElementById('todayEmpty');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  document.getElementById('todayDateLabel').textContent = today.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  const active = state.habits.filter(h => !h.archived && isScheduledOn(h, today));
  const ds = todayStr();

  // Incomplete habits first (by priority, then name), completed/recovery habits
  // pushed to the bottom (also by priority, then name) so a freshly-checked habit
  // doesn't stay pinned in the middle of the still-to-do list.
  active.sort((a, b) => {
    const aDone = isDone(getCompletion(a, ds)) || isRecovery(getCompletion(a, ds));
    const bDone = isDone(getCompletion(b, ds)) || isRecovery(getCompletion(b, ds));
    if (aDone !== bDone) return aDone ? 1 : -1;
    return a.priority - b.priority || a.name.localeCompare(b.name);
  });

  list.innerHTML = '';
  if (active.length === 0) { empty.style.display = 'block'; return; }
  empty.style.display = 'none';

  active.forEach(habit => {
    const c = getCompletion(habit, ds);
    const { current, longest } = computeStreaks(habit);
    const weekDates = getWeekDates(0);
    const prog = weekProgress(habit, weekDates);
    const target = weeklyTarget(habit);
    const progPct = Math.min(100, Math.round((prog / target) * 100));

    const card = document.createElement('div');
    card.className = `habit-card priority-${habit.priority}` + (isDone(c) ? ' done-today' : '') + (isRecovery(c) ? ' recovery-today' : '');

    card.innerHTML = `
      <div class="habit-row-top">
        <button class="habit-check-btn ${isDone(c) ? 'checked' : isRecovery(c) ? 'recovery' : ''}" data-habit="${habit.id}" title="${isDone(c) ? 'Completed — click to change' : isRecovery(c) ? 'Recovery day — click to clear' : 'Mark complete'}">
          ${isDone(c) ? '&#10003;' : isRecovery(c) ? '&#8635;' : ''}
        </button>
        <div class="habit-info">
          <div class="habit-name-row">
            <p class="habit-name">${escapeHtml(habit.name)}</p>
            ${habit.timeOfDay !== 'any' ? `<span class="time-chip">${timeIcon(habit.timeOfDay)}</span>` : ''}
            ${isDone(c) ? '<span class="completed-tag">&#10003; Completed</span>' : isRecovery(c) ? '<span class="completed-tag recovery-tag">&#8635; Recovery</span>' : ''}
          </div>
          ${habit.description ? `<p class="habit-desc">${escapeHtml(habit.description)}</p>` : ''}
          ${c && c.note ? `<p class="habit-desc">&#128221; ${escapeHtml(c.note)}</p>` : ''}
          <div class="habit-meta-row">
            <span class="badge badge-streak">&#128293; ${current} day${current === 1 ? '' : 's'}</span>
            <span class="badge badge-best">&#127942; best ${longest}</span>
            <span class="badge ${progPct >= 100 ? 'badge-progress-ok' : 'badge-progress-low'}">${prog}/${target} wk</span>
          </div>
        </div>
      </div>
    `;
    list.appendChild(card);
    card.querySelector('.habit-check-btn').addEventListener('click', () => {
      cycleCompletion(habit.id, ds);
    });
  });
}
