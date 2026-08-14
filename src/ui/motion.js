// Shared motion primitives used across every view — scroll-reveal, number
// count-up, and the reduced-motion check. Kept generic/reusable rather than
// hardcoded per-section, per the app's "one motion system, not five" goal.

let reducedMotionQuery = null;
export function prefersReducedMotion() {
  if (!reducedMotionQuery) reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  return reducedMotionQuery.matches;
}

// One shared IntersectionObserver rather than one per card — cheaper, and the
// standard way to avoid per-scroll-event work entirely (see MDN's own guidance
// on replacing scroll listeners with IntersectionObserver for reveal effects).
let revealObserver = null;
function getRevealObserver() {
  if (revealObserver) return revealObserver;
  revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('reveal-in');
        revealObserver.unobserve(entry.target); // reveal once; don't re-trigger on scroll back up
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  return revealObserver;
}

// Tracks which item keys have already played their reveal animation, per
// container — see revealOnScroll's `getKey` param for why this exists.
const revealedKeysByContainer = new WeakMap();

/**
 * Marks each direct child of `container` (or a `childSelector` match within it)
 * for scroll-reveal: starts hidden/offset via the `.reveal-item` class, gets a
 * small stagger delay based on its index, and is observed so it fades/rises into
 * place the first time it enters the viewport. Call this once after rebuilding a
 * list's innerHTML — safe to call on an empty list (no-ops).
 *
 * `getKey(el, index)` should return a stable identity for each item (e.g. a
 * habit id read off `el.dataset`). This matters because most lists in this app
 * are rebuilt from scratch on every render (see CLAUDE.md's "no diffing" model)
 * — including on unrelated changes, like checking off one habit re-rendering
 * the whole Today list. Without tracking identity, every render would treat
 * every card as brand new and replay its reveal animation, which is exactly
 * the "constantly animate cards" failure mode this system is meant to avoid.
 * Items whose key has already been revealed are shown immediately, no replay;
 * only genuinely new keys get the animation. If `getKey` is omitted, every call
 * is treated as a fresh batch (fine for lists that only render once, like most
 * modal contents) — pass it whenever a container can re-render mid-session.
 *
 * `trackingKey` overrides what the "already revealed" memory is keyed on —
 * pass this when `container` itself gets recreated on every render (e.g. a
 * <tbody> that's replaced wholesale via its parent <table>'s innerHTML) but
 * some stable ancestor (the <table>) isn't. Defaults to `container`.
 *
 * With reduced motion, items are made visible immediately with no animation.
 */
export function revealOnScroll(container, { childSelector, getKey, trackingKey } = {}) {
  if (!container) return;
  const items = childSelector ? container.querySelectorAll(childSelector) : Array.from(container.children);

  if (prefersReducedMotion()) {
    items.forEach(el => el.classList.add('reveal-in'));
    return;
  }

  let revealedKeys = null;
  if (getKey) {
    const memoryKey = trackingKey || container;
    revealedKeys = revealedKeysByContainer.get(memoryKey);
    if (!revealedKeys) {
      revealedKeys = new Set();
      revealedKeysByContainer.set(memoryKey, revealedKeys);
    }
  }

  const observer = getRevealObserver();
  let newItemIndex = 0;
  items.forEach((el, i) => {
    const key = getKey ? getKey(el, i) : null;
    if (key !== null && revealedKeys.has(key)) {
      el.classList.add('reveal-in'); // already played its reveal in an earlier render — show as-is
      return;
    }
    if (key !== null) revealedKeys.add(key);

    el.classList.add('reveal-item');
    // Cap the stagger so a long list doesn't make later cards wait noticeably —
    // items beyond the first ~6 *new* items in a batch reveal together rather
    // than queuing (indexed among new items only, not the full list).
    el.style.setProperty('--reveal-delay', `${Math.min(newItemIndex, 6) * 55}ms`);
    newItemIndex++;
    observer.observe(el);
  });
}

/**
 * Animates the text content of `el` from its current numeric value to `newValue`
 * over `duration`ms, formatting each frame with `format` (default: identity).
 * No-ops (jumps straight to the final value) if the value hasn't actually
 * changed, if reduced motion is on, or if this is the element's first render
 * (nothing to transition *from* yet) — passing `animate: false` forces the jump.
 */
export function animateCount(el, newValue, { duration = 500, format = (n) => String(n), animate = true } = {}) {
  if (!el) return;
  const prev = el.dataset.countValue !== undefined ? Number(el.dataset.countValue) : null;
  el.dataset.countValue = String(newValue);

  if (!animate || prev === null || prev === newValue || prefersReducedMotion()) {
    el.textContent = format(newValue);
    return;
  }

  const start = performance.now();
  const from = prev;
  const to = newValue;

  function tick(now) {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
    const current = Math.round(from + (to - from) * eased);
    el.textContent = format(current);
    if (t < 1) requestAnimationFrame(tick);
    else el.textContent = format(to);
  }
  requestAnimationFrame(tick);
}

/**
 * Transient "this just changed by user action" signal for completion cells.
 * The app re-renders lists by rebuilding innerHTML from scratch (see CLAUDE.md —
 * "no diffing"), so a freshly-created checkbox node has no memory of whether it
 * just flipped to checked or was always checked. The mutation call site (e.g.
 * cycleCompletion in modals.js) marks a cell key here right before calling
 * renderAll(); the render function for that cell checks + consumes the mark so
 * the pop/checkmark animation plays exactly once, only on the actual change.
 */
const pendingPulses = new Set();
export function markPendingPulse(key) {
  pendingPulses.add(key);
}
export function consumePendingPulse(key) {
  if (pendingPulses.has(key)) {
    pendingPulses.delete(key);
    return true;
  }
  return false;
}

/**
 * Opens a modal overlay, clearing any leftover .closing state from an
 * interrupted close (e.g. user reopens the same modal immediately after
 * dismissing it) so the open animation isn't fighting a still-animating close.
 */
export function openModal(overlayEl) {
  if (!overlayEl) return;
  overlayEl.classList.remove('closing');
  overlayEl.classList.add('open');
}

/**
 * Closes a modal overlay with its reverse (fade + scale-down) animation instead
 * of an instant display:none — plays .closing (see the modalOut/overlayOut
 * keyframes in style.css), waits for it to finish, then removes .open and
 * .closing so the overlay is ready to reopen cleanly next time. Skips straight
 * to the instant close under reduced motion.
 */
export function closeModal(overlayEl) {
  if (!overlayEl || !overlayEl.classList.contains('open')) return;

  if (prefersReducedMotion()) {
    overlayEl.classList.remove('open');
    return;
  }

  overlayEl.classList.add('closing');
  const done = () => {
    overlayEl.classList.remove('open', 'closing');
  };
  overlayEl.addEventListener('animationend', done, { once: true });
  // Safety net: if animationend never fires (e.g. the overlay was hidden by
  // other means mid-transition), don't leave the modal permanently stuck open.
  setTimeout(done, 400);
}
