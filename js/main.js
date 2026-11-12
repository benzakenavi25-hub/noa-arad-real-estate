import { renderListings } from './listings.js';
import { initForm } from './form.js';
import { initHomeMap } from './map.js';
import { initSharon } from './sharon.js';
import { initAnimations } from './animations.js';

/** Header: transparent over the hero, solid ink + blur after it. */
function initHeaderState() {
  const header = document.querySelector('.site-header');
  const hero = document.getElementById('hero');
  if (!header || !hero) return;
  const io = new IntersectionObserver(([entry]) => {
    header.classList.toggle('is-solid', !entry.isIntersecting);
  }, { rootMargin: `-${header.offsetHeight}px 0px 0px 0px` });
  io.observe(hero);
}

async function init() {
  initHeaderState();
  await renderListings();
  initForm();
  initSharon();          // before the map, so it hears 'map:ready'
  initHomeMap();
  initAnimations();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
