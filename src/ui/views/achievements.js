import { getUnlockedAchievements } from '../../domain/achievements.js';

export function renderAchievements(state) {
  const list = document.getElementById('achievementsList');
  const achievements = getUnlockedAchievements(state.habits);
  list.innerHTML = '';
  achievements.forEach(a => {
    const card = document.createElement('div');
    card.className = 'achievement-card ' + (a.unlocked ? 'unlocked' : 'locked');
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
}
