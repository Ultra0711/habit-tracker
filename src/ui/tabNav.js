// Mobile tab bar behavior: keep the active tab scrolled into view, and show a
// right-edge fade hint only while there's more content to scroll toward.
// Desktop layout doesn't scroll (tabs fit via flex:1), so this is a no-op there —
// the scrollWidth/clientWidth check below naturally evaluates to "nothing to scroll".

export function initTabNavScroll() {
  const nav = document.getElementById('tabNav');
  const fade = document.getElementById('tabNavFade');
  if (!nav || !fade) return;

  function updateFade() {
    const maxScroll = nav.scrollWidth - nav.clientWidth;
    const remaining = maxScroll - nav.scrollLeft;
    fade.classList.toggle('visible', maxScroll > 4 && remaining > 4);
  }

  nav.addEventListener('scroll', updateFade, { passive: true });
  window.addEventListener('resize', updateFade);
  updateFade();

  nav.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
    });
  });
}
