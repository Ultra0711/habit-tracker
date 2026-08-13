import { getWeekDates, fmtDate, todayStr, DAY_LABELS } from '../../domain/dates.js';
import { isScheduledOn, getCompletion, isDone, isRecovery } from '../../domain/habits.js';
import { escapeHtml } from '../format.js';
import { cycleCompletion } from '../modals.js';

let weekOffset = 0;

export function initWeekGridNav(rerenderFn) {
  document.getElementById('prevWeek').addEventListener('click', () => { weekOffset--; rerenderFn(); });
  document.getElementById('nextWeek').addEventListener('click', () => { if (weekOffset < 0) weekOffset++; rerenderFn(); });
}

export function renderWeekGrid(state) {
  const dates = getWeekDates(weekOffset);
  const opts = { month: 'short', day: 'numeric' };
  document.getElementById('weekLabel').textContent = weekOffset === 0
    ? `This Week (${dates[0].toLocaleDateString(undefined, opts)} – ${dates[6].toLocaleDateString(undefined, opts)})`
    : `${dates[0].toLocaleDateString(undefined, opts)} – ${dates[6].toLocaleDateString(undefined, opts)}`;
  document.getElementById('nextWeek').disabled = weekOffset >= 0;

  const table = document.getElementById('weekGridTable');
  const empty = document.getElementById('weekEmpty');
  const active = state.habits.filter(h => !h.archived);

  if (active.length === 0) {
    table.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  const ds = todayStr();
  let thead = '<thead><tr><th>Habit</th>';
  dates.forEach((d, i) => {
    thead += `<th>${DAY_LABELS[i]}<br>${d.getDate()}</th>`;
  });
  thead += '</tr></thead>';

  let tbody = '<tbody>';
  active.sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name));
  active.forEach(habit => {
    tbody += `<tr><td title="${escapeHtml(habit.name)}">${escapeHtml(habit.name)}</td>`;
    dates.forEach(d => {
      const dStr = fmtDate(d);
      const scheduled = isScheduledOn(habit, d);
      const c = getCompletion(habit, dStr);
      const isFuture = dStr > ds;
      let cls = 'grid-check';
      let content = '';
      if (!scheduled) {
        cls += ' unscheduled';
        content = '&middot;';
      } else if (isDone(c)) {
        cls += ' checked'; content = '&#10003;';
      } else if (isRecovery(c)) {
        cls += ' recovery'; content = '&#8635;';
      }
      if (isFuture && scheduled) cls += ' disabled';
      if (dStr === ds) cls += ' today-col';
      tbody += `<td><div class="${cls}" ${scheduled && !isFuture ? `data-habit="${habit.id}" data-date="${dStr}"` : ''}>${content}</div></td>`;
    });
    tbody += '</tr>';
  });
  tbody += '</tbody>';

  table.innerHTML = thead + tbody;
  table.querySelectorAll('.grid-check[data-habit]').forEach(cell => {
    cell.addEventListener('click', () => {
      cycleCompletion(cell.dataset.habit, cell.dataset.date);
    });
  });
}
