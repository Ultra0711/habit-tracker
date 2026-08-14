import { getUnlockedAchievements } from '../../domain/achievements.js';
import { revealOnScroll } from '../motion.js';

// Achievements are recomputed fresh from completion history on every render
// (see CLAUDE.md — never stored as "unlocked" flags), so there's no persisted
// moment to hook a "just unlocked" animation off of. Tracking which ids were
// unlocked last render is enough to detect the transition here, locally, without
// needing a stored flag on the habit/achievement data itself.
let previouslyUnlocked = new Set();

export function renderAchievements(state) {
  const list = document.getElementById('achievementsList');
  const achievements = getUnlockedAchievements(state.habits);

  const newlyUnlocked = new Set();
  achievements.forEach(a => {
    if (a.unlocked && !previouslyUnlocked.has(a.id)) newlyUnlocked.add(a.id);
  });
  previouslyUnlocked = new Set(achievements.filter(a => a.unlocked).map(a => a.id));

  list.innerHTML = '';
  achievements.forEach(a => {
    const card = document.createElement('div');
    card.className = 'achievement-card ' + (a.unlocked ? 'unlocked' : 'locked') + (newlyUnlocked.has(a.id) ? ' just-unlocked' : '');
    card.dataset.achievementId = a.id;
    card.innerHTML = `
      <div class="achievement-icon">${a.icon}</div>
      <div>
        <p class="achievement-title">${a.title}</p>
        <p class="achievement-desc">${a.desc}</p>
      </div>
      ${a.unlocked ? '<span class="achievement-check">&#9989;</span>' : ''}
    `;
    list.appendChild(card);
  });

  revealOnScroll(list, { getKey: (el) => el.dataset.achievementId });
}
