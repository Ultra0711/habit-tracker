import { prefersReducedMotion } from './motion.js';

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
    if (prefersReducedMotion()) {
      toast.remove();
      return;
    }
    toast.style.transition = 'opacity 220ms ease, transform 220ms ease';
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(6px)';
    setTimeout(() => toast.remove(), 240);
  }, opts.duration || 3200);
}
