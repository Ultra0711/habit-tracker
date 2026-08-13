export function showToast(message, opts) {
  opts = opts || {};
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = 'toast' + (opts.milestone ? ' milestone' : '');
  const span = document.createElement('span');
  span.textContent = message;
  toast.appendChild(span);
  if (opts.undo) {
    const btn = document.createElement('button');
    btn.className = 'undo-btn';
    btn.textContent = 'Undo';
    btn.addEventListener('click', () => { opts.undo(); toast.remove(); });
    toast.appendChild(btn);
  }
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.transition = 'opacity 0.3s ease';
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 320);
  }, opts.duration || 3200);
}
