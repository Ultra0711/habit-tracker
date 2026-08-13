// Theme is a local UI preference, not habit data — kept in its own localStorage
// key rather than round-tripped through Supabase.
const THEME_KEY = 'habitTrackerTheme';

export function loadTheme() {
  try {
    return localStorage.getItem(THEME_KEY) || 'light';
  } catch (e) {
    return 'light';
  }
}

function saveTheme(theme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch (e) {
    // non-fatal: theme just won't persist across reloads in this browser context
  }
}

export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.getElementById('themeToggle').innerHTML = theme === 'dark' ? '&#9728;&#65039;' : '&#127769;';
}

export function initThemeToggle(state) {
  document.getElementById('themeToggle').addEventListener('click', () => {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    saveTheme(state.theme);
    applyTheme(state.theme);
  });
}
