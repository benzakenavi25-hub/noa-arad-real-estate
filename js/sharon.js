// "השרון, עסקה אחרי עסקה": one testimonial at a time, synchronised with the map.
//
// Change sequence (motion):  quote fades out (.4s) → map flies to that city → its marker pulses
//                            → the new quote reveals line by line.
// Only one quote is ever visible: the old one is fully gone before the next one is switched on.
// Reduced motion: map.setView without animation and an instant quote swap.

import { LOCATIONS } from './map.js';
import { prefersReducedMotion } from './motion.js';

const FADE_OUT = .4;
const FLY = 1.6;
const ZOOM = 13;
const INTERVAL = 7000;

export function initSharon() {
  const root = document.getElementById('testimonials');
  if (!root) return;
  const grid = root.closest('.sharon__grid') || root;
  const stage = root.querySelector('.testimonials__stage');
  const items = [...root.querySelectorAll('.testimonial')];
  const dots = [...root.querySelectorAll('.testimonials__dots [role="tab"]')];
  const caps = items.map(f => f.querySelector('figcaption'));
  const paras = items.map(f => f.querySelector('blockquote p'));
  const cityOf = f => LOCATIONS.find(l => l.city === f.dataset.city);

  let current = 0;
  let mapCtx = null;                // { map, markers } once the lazy map exists
  let master = null, revealTl = null, split = null;
  let shown = false;                // first quote revealed?
  let inView = false, held = false, timer = null;

  const gsap = () => (prefersReducedMotion() ? null : window.gsap || null);

  /* ---------- state helpers ---------- */
  const setActive = idx => items.forEach((f, n) => {
    const on = n === idx;
    f.classList.toggle('is-active', on);
    f.toggleAttribute('inert', !on);
    if (on) f.removeAttribute('aria-hidden'); else f.setAttribute('aria-hidden', 'true');
  });
  const updateDots = () => dots.forEach((d, n) => {
    d.setAttribute('aria-selected', String(n === current));
    d.tabIndex = n === current ? 0 : -1;
  });
  const clearInline = () => {
    const g = window.gsap;
    if (!g) return;
    g.killTweensOf([...items, ...caps, ...paras]);
    g.set([...items, ...caps, ...paras], { clearProps: 'opacity,visibility,transform' });
  };
  const markerFor = f => mapCtx?.markers.find(m => m.options.title === f.dataset.city);

  /* ---------- map ---------- */
  function moveMap(f, animate) {
    const l = cityOf(f);
    if (!mapCtx || !l) return;
    mapCtx.map.closePopup();
    if (animate) mapCtx.map.flyTo([l.lat, l.lng], ZOOM, { duration: FLY, easeLinearity: .25 });
    else mapCtx.map.setView([l.lat, l.lng], ZOOM, { animate: false });
  }
  function pulse(f) {
    const el = markerFor(f)?.getElement();
    if (!el) return;
    el.classList.remove('is-pulsing');
    void el.offsetWidth;                           // restart the CSS animation
    el.classList.add('is-pulsing');
    setTimeout(() => el.classList.remove('is-pulsing'), 2400);
  }

  /* ---------- quote reveal (mask, line by line) ---------- */
  function reveal(f) {
    const g = window.gsap, S = window.SplitText;
    const p = f.querySelector('blockquote p'), cap = f.querySelector('figcaption');
    const t = g.timeline();
    g.set(f, { autoAlpha: 1 });
    if (S) {
      split = S.create(p, { type: 'lines', mask: 'lines', linesClass: 'line', aria: 'none' });
      t.fromTo(split.lines, { yPercent: 110 }, {
        yPercent: 0, duration: 1.2, ease: 'expo.out', stagger: .09,
        onComplete: () => { split?.revert(); split = null; },
      }, 0);
    } else {
      t.fromTo(p, { autoAlpha: 0 }, { autoAlpha: 1, duration: .8 }, 0);
    }
    t.fromTo(cap, { autoAlpha: 0 }, { autoAlpha: 1, duration: 1 }, .45);
    return t;
  }

  /* ---------- change testimonial ---------- */
  function go(i, { instant = false } = {}) {
    const next = (i + items.length) % items.length;
    if (next === current && shown) return;
    const g = gsap();
    const prevActive = items.find(f => f.classList.contains('is-active'));
    current = next;
    updateDots();
    const f = items[current];

    // Stop whatever was in flight.
    master?.kill(); revealTl?.kill(); master = revealTl = null;
    if (split) { split.revert(); split = null; }

    if (!g || instant) {
      clearInline();
      setActive(current);
      shown = true;
      moveMap(f, false);
      return;
    }

    // Anything that is not the visible quote must be fully hidden.
    g.killTweensOf([...caps, ...paras]);
    g.set([...caps, ...paras], { clearProps: 'opacity,visibility,transform' });
    g.set(items.filter(x => x !== prevActive), { clearProps: 'opacity,visibility' });

    master = g.timeline();
    let t = 0;
    if (prevActive && shown) {
      master.to(prevActive, { autoAlpha: 0, duration: FADE_OUT, ease: 'power1.out' }, 0);
      t = FADE_OUT;
    }
    master.add(() => {
      setActive(-1);                               // nothing visible now
      g.set(items, { clearProps: 'opacity,visibility' });
      moveMap(f, true);
    }, t);
    const hasMap = !!mapCtx;
    master.add(() => pulse(f), t + (hasMap ? FLY - .3 : 0));
    master.add(() => {
      setActive(current);
      shown = true;
      revealTl = reveal(f);
    }, t + (hasMap ? FLY - .1 : .1));
  }

  /* ---------- auto-advance ---------- */
  const stop = () => { clearInterval(timer); timer = null; };
  const start = () => {
    stop();
    if (inView && !held && shown && !prefersReducedMotion()) {
      stage.setAttribute('aria-live', 'off');      // do not announce automatic changes
      timer = setInterval(() => go(current + 1), INTERVAL);
    }
  };
  const hold = v => () => {
    held = v;
    if (v) stage.setAttribute('aria-live', 'polite');
    start();
  };
  grid.addEventListener('mouseenter', hold(true));
  grid.addEventListener('mouseleave', hold(false));
  grid.addEventListener('focusin', hold(true));
  grid.addEventListener('focusout', hold(false));

  /* ---------- first reveal + visibility ---------- */
  const g0 = gsap();
  if (g0) g0.set(items[0], { autoAlpha: 0 });      // hidden until the section scrolls in
  new IntersectionObserver(([e]) => {
    inView = e.isIntersecting;
    if (inView && !shown) {
      shown = true;
      if (gsap()) revealTl = reveal(items[0]); else clearInline();
    }
    start();
  }, { threshold: .35 }).observe(grid);

  /* ---------- dots + keyboard ---------- */
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

  /* ---------- map ready: testimonial markers select their quote ---------- */
  document.addEventListener('map:ready', e => {
    mapCtx = e.detail;
    items.forEach((f, n) => {
      markerFor(f)?.on('click', () => { go(n); start(); });
    });
  });

  setActive(0);
  updateDots();
}
