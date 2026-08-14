// Mobile tab bar behavior: keep the active tab scrolled into view, show a
// right-edge fade hint only while there's more content to scroll toward, and
// move a shared "pill" indicator behind whichever tab is active instead of
// swapping backgrounds instantly. Desktop layout doesn't scroll (tabs fit via
// flex:1), so the scroll-related parts are no-ops there.

let indicatorEl = null;
let navEl = null;

export function initTabNavScroll() {
  const nav = document.getElementById('tabNav');
  const fade = document.getElementById('tabNavFade');
  navEl = nav;
  indicatorEl = document.getElementById('tabIndicator');
  if (!nav || !fade) return;

  function updateFade() {
    const maxScroll = nav.scrollWidth - nav.clientWidth;
    const remaining = maxScroll - nav.scrollLeft;
    fade.classList.toggle('visible', maxScroll > 4 && remaining > 4);
  }

  nav.addEventListener('scroll', updateFade, { passive: true });
  window.addEventListener('resize', () => {
    updateFade();
    moveIndicatorToActiveTab();
  });
  updateFade();
  moveIndicatorToActiveTab();

  nav.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
    });
  });
}

/** Slides the pill indicator to sit behind whichever .tab-btn currently has .active. */
export function moveIndicatorToActiveTab() {
  if (!indicatorEl || !navEl) return;
  const active = navEl.querySelector('.tab-btn.active');
  if (!active) return;
  indicatorEl.style.width = `${active.offsetWidth}px`;
  indicatorEl.style.transform = `translateX(${active.offsetLeft}px)`;
}
