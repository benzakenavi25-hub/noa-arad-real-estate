import { renderListings } from './listings.js';
import { initForm } from './form.js';
import { initHomeMap } from './map.js';
import { initAnimations } from './animations.js';
import { prefersReducedMotion } from './motion.js';

function initTestimonials() {
  const root = document.getElementById('testimonials');
  if (!root) return;
  const items = [...root.querySelectorAll('.testimonial')];
  const dots = [...root.querySelectorAll('.testimonials__dots [role="tab"]')];
  let current = 0;

  const go = (i, { silent = false } = {}) => {
    const prev = current;
    current = (i + items.length) % items.length;
    items.forEach((el, n) => {
      const on = n === current;
      el.classList.toggle('is-active', on);
      el.toggleAttribute('inert', !on);
      if (on) el.removeAttribute('aria-hidden'); else el.setAttribute('aria-hidden', 'true');
    });
    dots.forEach((d, n) => {
      d.setAttribute('aria-selected', String(n === current));
      d.tabIndex = n === current ? 0 : -1;
    });
    if (!silent && prev !== current) {
      document.dispatchEvent(new CustomEvent('testimonial:change', { detail: { el: items[current] } }));
    }
  };

  // Auto-advance every 6s. Pauses when out of view, hovered, focused, or with reduced motion.
  const stage = root.querySelector('.testimonials__stage');
  let timer = null, inView = false, held = false;
  const stop = () => { clearInterval(timer); timer = null; };
  const start = () => {
    stop();
    if (inView && !held && !prefersReducedMotion()) {
      stage.setAttribute('aria-live', 'off');       // do not announce automatic changes
      timer = setInterval(() => go(current + 1), 6000);
    }
  };
  new IntersectionObserver(([e]) => { inView = e.isIntersecting; start(); }, { threshold: .35 }).observe(root);
  const hold = v => () => { held = v; if (v) stage.setAttribute('aria-live', 'polite'); start(); };
  root.addEventListener('mouseenter', hold(true));
  root.addEventListener('mouseleave', hold(false));
  root.addEventListener('focusin', hold(true));
  root.addEventListener('focusout', hold(false));

  dots.forEach((d, n) => {
    d.addEventListener('click', () => { go(n); start(); });
    d.addEventListener('keydown', e => {
      // RTL: ArrowLeft = next, ArrowRight = previous.
      const delta = { ArrowLeft: 1, ArrowRight: -1 }[e.key];
      if (!delta) return;
      e.preventDefault();
      go(current + delta);
      dots[current].focus();
    });
  });
  go(0, { silent: true });
}

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
  initHomeMap();
  initTestimonials();
  initAnimations();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
