import { getWeekDates, fmtDate } from '../../domain/dates.js';
import { isScheduledOn, getCompletion, isDone, weeklyTarget, weekProgress, computeStreaks, consistencyScore } from '../../domain/habits.js';
import { escapeHtml } from '../format.js';

export function renderReview(state) {
  const dates = getWeekDates(0);
  const opts = { month: 'short', day: 'numeric' };
  document.getElementById('reviewWeekLabel').textContent = `${dates[0].toLocaleDateString(undefined, opts)} – ${dates[6].toLocaleDateString(undefined, opts)}`;

  const active = state.habits.filter(h => !h.archived);
  const today = new Date(); today.setHours(0, 0, 0, 0);

  let scheduled = 0, done = 0;
  let best = null, bestPct = -1;
  let weakest = null, weakestPct = 101;
  let longestOverall = 0;

  active.forEach(h => {
    const target = weeklyTarget(h);
    const prog = weekProgress(h, dates);
    const pct = target ? Math.round((prog / target) * 100) : 0;
    dates.forEach(d => {
      if (isScheduledOn(h, d) && d <= today) {
        scheduled++;
        if (isDone(getCompletion(h, fmtDate(d)))) done++;
      }
    });
    if (pct > bestPct) { bestPct = pct; best = h; }
    if (pct < weakestPct) { weakestPct = pct; weakest = h; }
    const { longest } = computeStreaks(h);
    if (longest > longestOverall) longestOverall = longest;
  });

  const overallPct = scheduled ? Math.round((done / scheduled) * 100) : 0;

  const highlights = document.getElementById('reviewHighlights');
  highlights.innerHTML = `
    <div class="review-highlight">
      <div class="rh-label">Overall Progress</div>
      <div class="rh-value">${overallPct}%</div>
      <div class="rh-sub">${done}/${scheduled} scheduled done</div>
    </div>
    <div class="review-highlight">
      <div class="rh-label">Best Performing</div>
      <div class="rh-value">${best ? escapeHtml(best.name) : '—'}</div>
      <div class="rh-sub">${best ? bestPct + '% of weekly target' : 'No habits yet'}</div>
    </div>
    <div class="review-highlight">
      <div class="rh-label">Needs Attention</div>
      <div class="rh-value">${weakest ? escapeHtml(weakest.name) : '—'}</div>
      <div class="rh-sub">${weakest ? weakestPct + '% of weekly target' : 'No habits yet'}</div>
    </div>
    <div class="review-highlight">
      <div class="rh-label">Longest Streak</div>
      <div class="rh-value">${longestOverall} days</div>
      <div class="rh-sub">Across all habits</div>
    </div>
  `;

  const score = consistencyScore(state.habits, 14);
  const ring = document.getElementById('consistencyRing');
  ring.style.setProperty('--pct', score);
  ring.setAttribute('data-pct', score);
  const desc = document.getElementById('consistencyDesc');
  desc.textContent = score >= 80 ? 'Excellent consistency — you\'re showing up reliably.' :
    score >= 55 ? 'Solid consistency, with room to tighten up a few days.' :
    score >= 30 ? 'Inconsistent lately — try focusing on your top-priority habits.' :
    'Low consistency over the last two weeks. Consider simplifying your habit list.';

  const reviewList = document.getElementById('reviewHabitList');
  reviewList.innerHTML = '';
  if (active.length === 0) {
    reviewList.innerHTML = '<div class="empty-state"><span class="emoji">&#128202;</span><p>No active habits to review yet.</p></div>';
    return;
  }
  active.sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name));
  active.forEach(h => {
    const target = weeklyTarget(h);
    const prog = weekProgress(h, dates);
    const row = document.createElement('div');
    row.className = 'review-habit-row';
    row.innerHTML = `<span class="rhr-name">${escapeHtml(h.name)}</span><span class="rhr-stat">${prog}/${target} this week</span>`;
    reviewList.appendChild(row);
  });
}
