export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : str;
  return div.innerHTML;
}

export function priorityLabel(p) {
  return p === 1 ? 'High priority' : p === 2 ? 'Medium priority' : 'Low priority';
}

export function timeIcon(t) {
  return t === 'morning' ? '&#9728;&#65039; Morning'
    : t === 'afternoon' ? '&#127774; Afternoon'
    : t === 'evening' ? '&#127769; Evening'
    : '';
}
