// Scroll animations (GSAP + ScrollTrigger + SplitText + Lenis).
// This file: smooth scroll, preloader, global scroll UI and the hero "through the door" sequence.
// Sections 4.2–4.9 and the custom cursor live in sections.js.

import { sectionAnimations } from './sections.js';
import { prefersReducedMotion, REDUCE_QUERY } from './motion.js';

const clamp01 = v => Math.min(1, Math.max(0, v));
const range = (p, a, b) => clamp01((p - a) / (b - a));       // progress of p inside [a, b]
const easeInOut = t => (t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const wait = ms => new Promise(r => setTimeout(r, ms));

/** Door (walnut leaf) position inside entrance-door.jpg, as fractions of the source image. */
const DOOR = { x0: .429, x1: .569, y0: .232, y1: .706 };
/** Same, inside entrance-door-mobile.jpg (941×1672 portrait, served when aspect ratio ≤ 4/5). */
const DOOR_MOBILE = { x0: .423, x1: .579, y0: .322, y1: .498 };
const PORTRAIT_HERO = '(max-aspect-ratio: 4/5)';   // must match the <source media> in index.html
/** The hall starts to open when the door is at this fraction of "touching the viewport edge". */
const REVEAL_LEAD = .82;

let lenis = null;

/* =========================================================
   Smooth scroll
   ========================================================= */
function initLenis(gsap, ScrollTrigger, reduce) {
  if (reduce || !window.Lenis) return null;
  const l = new window.Lenis({ lerp: 0.1, anchors: false });
  l.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(t => l.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  return l;
}

/** In-page anchor links scroll through Lenis (falls back to native). */
function initAnchors() {
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href').slice(1);
    const target = id === 'top' || id === '' ? document.body : document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    const focusTarget = () => {
      if (target === document.body) return;
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    };
    if (lenis) {
      lenis.scrollTo(target === document.body ? 0 : target, { duration: 1.6, onComplete: focusTarget });
    } else {
      target.scrollIntoView({ behavior: 'auto', block: 'start' });
      focusTarget();
    }
    history.replaceState(null, '', id && id !== 'top' ? `#${id}` : location.pathname + location.search);
  });
}

/* =========================================================
   Global scroll UI: progress line, header hide/show, WhatsApp button
   ========================================================= */
function initGlobalUI(gsap, ScrollTrigger) {
  const progress = document.querySelector('.scroll-progress');
  const header = document.querySelector('.site-header');
  const wa = document.querySelector('.wa-float');
  const hero = document.getElementById('hero');
  const setProgress = progress ? gsap.quickSetter(progress, 'scaleX') : null;

  // Sections the WhatsApp button must never sit on: the tour (full-screen photos with captions in
  // the same corner) and the finale (it has its own WhatsApp CTA).
  const noWa = [document.querySelector('.tour__viewport'), document.getElementById('contact')].filter(Boolean);
  /** True when the button's corner of the screen is over one of those sections. */
  const waBlocked = () => {
    if (!wa) return false;
    const r = wa.getBoundingClientRect();
    const y = r.top + r.height / 2 || window.innerHeight - 50;
    return noWa.some(el => {
      const box = (el.parentElement?.classList.contains('pin-spacer') ? el.parentElement : el).getBoundingClientRect();
      return box.top <= y && box.bottom >= y;
    });
  };

  /** The button's resting box (ignores its show/hide scale), grown by a small safety margin. */
  const waZone = () => {
    const m = 10;
    return { l: wa.offsetLeft - m, t: wa.offsetTop - m, r: wa.offsetLeft + wa.offsetWidth + m, b: wa.offsetTop + wa.offsetHeight + m };
  };
  const caretAt = (x, y) => {
    if (document.caretRangeFromPoint) return document.caretRangeFromPoint(x, y);
    const p = document.caretPositionFromPoint?.(x, y);
    if (!p) return null;
    const r = document.createRange(); r.setStart(p.offsetNode, p.offset); return r;
  };
  /**
   * True when any visible text lies under the button. In RTL every line starts at the inline-start
   * edge, exactly where the button sits, so headings and captions pass under it while scrolling.
   * Samples a few points in the button's zone and checks the actual glyph boxes there.
   */
  const textUnder = () => {
    if (!wa) return false;
    const z = waZone();
    // 4×4 grid (~20px apart): fine enough to catch small glyphs such as the map's "+ / −".
    const f = [.12, .37, .63, .88];
    const pts = f.flatMap(fx => f.map(fy => [z.l + (z.r - z.l) * fx, z.t + (z.b - z.t) * fy]));
    const prev = wa.style.pointerEvents;
    wa.style.pointerEvents = 'none';                 // hit-test what is underneath, not the button
    try {
      for (const [x, y] of pts) {
        const range = caretAt(x, y);
        const node = range?.startContainer;
        if (!node || node.nodeType !== 3 || !/\S/.test(node.data)) continue;
        if (getComputedStyle(node.parentElement).visibility === 'hidden') continue;
        const off = range.startOffset;
        const glyph = document.createRange();
        glyph.setStart(node, Math.max(0, off - 1));
        glyph.setEnd(node, Math.min(node.length, off + 1));
        for (const r of glyph.getClientRects()) {
          if (r.right > z.l && r.left < z.r && r.bottom > z.t && r.top < z.b) return true;
        }
      }
    } finally {
      wa.style.pointerEvents = prev;
    }
    return false;
  };

  const pastHeroNow = () => {
    if (!hero) return true;
    // The hero is pinned, so "after the hero" = its pin spacer has left the top of the viewport.
    const box = (hero.parentElement?.classList.contains('pin-spacer') ? hero.parentElement : hero).getBoundingClientRect();
    return box.bottom <= (header?.offsetHeight || 0) + 1;
  };
  const wantWa = () => pastHeroNow() && !waBlocked() && !textUnder();
  // Hide at once; show again only after the spot has stayed clear briefly (no flicker between lines).
  let showTimer = null;
  const syncWa = () => {
    if (!wa) return;
    if (!wantWa()) {
      clearTimeout(showTimer); showTimer = null;
      wa.classList.remove('is-visible');
    } else if (!wa.classList.contains('is-visible') && !showTimer) {
      showTimer = setTimeout(() => { showTimer = null; if (wantWa()) wa.classList.add('is-visible'); }, 300);
    }
  };
  // Content can also change under a still page (testimonials, lazy images, resize).
  setInterval(syncWa, 700);
  window.addEventListener('resize', syncWa);

  ScrollTrigger.create({
    start: 0,
    end: 'max',
    onUpdate(self) {
      setProgress?.(self.progress);
      syncWa();
      if (!hero) return;
      const pastHero = pastHeroNow();
      if (header) {
        const hide = pastHero && self.direction === 1 && !header.contains(document.activeElement);
        header.classList.toggle('is-hidden', hide);
      }
    },
  });
}

/* =========================================================
   Preloader
   ========================================================= */
function runPreloader(gsap, reduce) {
  const el = document.getElementById('preloader');
  if (!el) return Promise.resolve();

  if (reduce) {
    // Reduced motion: no line, no curtain. Wait briefly for the hero image, then fade out.
    const img = document.querySelector('.hero__layer--door img');
    const loaded = img && !img.complete ? new Promise(r => { img.addEventListener('load', r, { once: true }); img.addEventListener('error', r, { once: true }); }) : Promise.resolve();
    // Plain CSS fade + timer (no GSAP ticker), so it completes even if animation frames are paused.
    return Promise.race([loaded, wait(1200)]).then(() => {
      el.style.transition = 'opacity .4s linear';
      el.style.opacity = '0';
      return wait(420).then(() => { el.dataset.done = '1'; el.remove(); });
    });
  }

  const fill = el.querySelector('.preloader__fill');
  const line = el.querySelector('.preloader__line');
  const name = el.querySelector('.preloader__name');
  const imgs = [...document.querySelectorAll('.hero__layer img')];
  const total = imgs.length + 1;
  let loaded = 0;

  lenis?.stop();
  document.documentElement.style.overflow = 'hidden';

  const allLoaded = new Promise(resolve => {
    const tick = () => {
      loaded += 1;
      gsap.to(fill, { scaleX: loaded / total, duration: .5, ease: 'power2.out', overwrite: true });
      if (loaded >= total) resolve();
    };
    imgs.forEach(img => {
      if (img.complete && img.naturalWidth) tick();
      else { img.addEventListener('load', tick, { once: true }); img.addEventListener('error', tick, { once: true }); }
    });
    (document.fonts?.ready ?? Promise.resolve()).then(tick);
  });

  // Whole preloader stays under 2.5s: loading is capped at 1.3s, the exit takes ~1.2s.
  return Promise.all([wait(700), Promise.race([allLoaded, wait(1300)])]).then(() => new Promise(resolve => {
    const expand = window.innerWidth / (line.offsetWidth || 1);
    gsap.timeline({
      defaults: { overwrite: true },
      onComplete() {
        el.dataset.done = '1';
        el.remove();
      },
    })
      .to(fill, { scaleX: 1, duration: .25, ease: 'power2.out' })
      .to(line, { scaleX: expand, duration: .55, ease: 'expo.inOut' })
      .to(name, { yPercent: -40, autoAlpha: 0, duration: .45, ease: 'power3.in' }, '<')
      .add(() => {
        document.documentElement.style.overflow = '';
        lenis?.start();
        resolve();                       // hero intro starts as the curtain lifts
      })
      .to(el, { clipPath: 'inset(0% 0% 100% 0%)', duration: .9, ease: 'expo.inOut' });
  }));
}

/* =========================================================
   Hero intro (on load, not on scroll)
   ========================================================= */
function prepareHeroIntro(gsap, SplitText, reduce) {
  const title = document.querySelector('.hero__title');
  const subtitle = document.querySelector('.hero__subtitle');
  const cue = document.querySelector('.hero__scroll');
  if (!title) return () => {};

  if (reduce || !SplitText) {
    const els = [title, subtitle, ...cue.children];
    gsap.set(els, { autoAlpha: 0 });
    return () => gsap.to(els, { autoAlpha: 1, duration: .8, stagger: .12 });
  }

  const split = SplitText.create(title, { type: 'words', mask: 'words', wordsClass: 'hero__word' });
  gsap.set(split.words, { yPercent: 110 });
  gsap.set(subtitle, { autoAlpha: 0, y: 18 });
  gsap.set(cue.children, { autoAlpha: 0 });

  return () => gsap.timeline()
    .to(split.words, { yPercent: 0, duration: 1.3, ease: 'expo.out', stagger: .08 })
    .to(subtitle, { autoAlpha: 1, y: 0, duration: 1.1, ease: 'power3.out' }, .35)
    .to(cue.children, { autoAlpha: 1, duration: 1.2, ease: 'power2.out' }, .9);
}

/* =========================================================
   Hero: walking through the door (scrubbed)
   ========================================================= */
function heroSequence(gsap, ScrollTrigger, pinLength) {
  const hero = document.getElementById('hero');
  const stage = hero?.querySelector('.hero__stage');
  if (!stage) return;
  const door = stage.querySelector('.hero__layer--door');
  const doorImg = door.querySelector('img');
  const hall = stage.querySelector('.hero__layer--hall');
  const hallImg = hall.querySelector('img');
  const flash = stage.querySelector('.hero__flash');
  const content = stage.querySelector('.hero__content');
  const cue = stage.querySelector('.hero__scroll');

  // Geometry, recomputed on every refresh/resize.
  const g = { W: 0, H: 0, l: 0, r: 0, t: 0, b: 0, cx: 0, cy: 0, maxScale: 3.4, revealAt: .5 };

  function measure() {
    const W = stage.clientWidth, H = stage.clientHeight;
    // Use the constants of whichever file the <picture> is showing. Before it has loaded,
    // fall back to the media query that decides which file it will be.
    const portrait = doorImg.naturalWidth
      ? doorImg.naturalHeight > doorImg.naturalWidth
      : window.matchMedia(PORTRAIT_HERO).matches;
    const D = portrait ? DOOR_MOBILE : DOOR;
    const nw = doorImg.naturalWidth || (portrait ? 941 : 1672);
    const nh = doorImg.naturalHeight || (portrait ? 1672 : 941);
    const s = Math.max(W / nw, H / nh);                 // object-fit: cover
    const w = nw * s, h = nh * s;
    const ox = (W - w) / 2, oy = (H - h) / 2;           // object-position: center
    g.W = W; g.H = H;
    g.l = ox + D.x0 * w; g.r = ox + D.x1 * w;
    g.t = oy + D.y0 * h; g.b = oy + D.y1 * h;
    g.cx = (g.l + g.r) / 2; g.cy = (g.t + g.b) / 2;
    // Scale at which the door first touches a viewport edge.
    const contain = Math.min(W / (g.r - g.l), H / (g.b - g.t));
    g.maxScale = Math.max(3.4, contain * 1.5);
    // Zoom progress (0..1) at which the door is almost that big: the hall starts to open there,
    // while the door frame is still fully visible on every viewport shape.
    g.revealAt = clamp01(Math.log(contain * REVEAL_LEAD) / Math.log(g.maxScale));
    door.style.transformOrigin = `${g.cx}px ${g.cy}px`;
  }

  // Timeline map (p = 0..1 across the pin):
  //   0.00–0.15  title + subtitle blur/fade out
  //   0.03–0.72  camera walks to the door (exponential scale = constant perceived speed)
  //   reveal     starts when the door touches the viewport edge, ends at 0.86
  //   0.86–1.00  rest on the hall
  const ZOOM_A = .03, ZOOM_B = .72, REVEAL_END = .86;

  function render(p) {
    // 1. Title
    const out = range(p, 0, .15);
    content.style.opacity = 1 - out;
    content.style.filter = out > 0 && out < 1 ? `blur(${(out * 8).toFixed(2)}px)` : 'none';
    content.style.visibility = out >= 1 ? 'hidden' : 'visible';
    cue.style.opacity = 1 - range(p, 0, .08);
    cue.style.visibility = p >= .08 ? 'hidden' : 'visible';

    // 2. Camera
    const z = range(p, ZOOM_A, ZOOM_B);
    const S = Math.pow(g.maxScale, z);
    door.style.transform = `scale(${S.toFixed(4)})`;

    // 3. Hall opens from the door's current on-screen rectangle
    const revealStart = ZOOM_A + g.revealAt * (ZOOM_B - ZOOM_A);
    const rv = range(p, revealStart, REVEAL_END);
    if (rv <= 0) {
      hall.style.visibility = 'hidden';
      flash.style.opacity = 0;
      door.style.visibility = 'visible';
      return;
    }
    const e = easeInOut(rv);
    const keep = 1 - e;
    const top = Math.max(0, g.cy + (g.t - g.cy) * S) * keep;
    const left = Math.max(0, g.cx + (g.l - g.cx) * S) * keep;
    const right = Math.max(0, g.W - (g.cx + (g.r - g.cx) * S)) * keep;
    const bottom = Math.max(0, g.H - (g.cy + (g.b - g.cy) * S)) * keep;
    hall.style.visibility = 'visible';
    hall.style.clipPath = rv >= 1 ? 'none' : `inset(${top.toFixed(1)}px ${right.toFixed(1)}px ${bottom.toFixed(1)}px ${left.toFixed(1)}px)`;
    hall.style.opacity = clamp01(rv / .22);
    hallImg.style.transform = rv >= 1 ? 'none' : `scale(${(1.2 - .2 * e).toFixed(4)})`;

    // 4. Warm light at the moment of crossing
    flash.style.opacity = (.25 * Math.sin(Math.PI * range(rv, 0, .7))).toFixed(3);

    // 5. Door layer leaves once the hall covers everything
    door.style.visibility = rv >= 1 ? 'hidden' : 'visible';
  }

  // The story section is pulled up under the pinned hero and stays hidden until the pin ends.
  // At that exact moment it shows the same hall image at the same crop, so the handoff is seamless.
  const story = document.getElementById('story');
  story?.classList.add('is-continuous');
  const syncStory = progress => { if (story) story.style.visibility = progress >= 1 ? '' : 'hidden'; };

  const state = { p: 0 };
  measure();
  render(0);
  syncStory(0);
  // The <picture> swaps files when the viewport crosses 4/5 (rotation, resize): re-measure on every load.
  const onDoorLoad = () => { measure(); render(state.p); };
  doorImg.addEventListener('load', onDoorLoad);

  const tween = gsap.to(state, {
    p: 1,
    ease: 'none',
    onUpdate: () => render(state.p),
    scrollTrigger: {
      trigger: hero,
      start: 'top top',
      end: `+=${pinLength}%`,
      pin: true,
      scrub: 1,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onRefresh: self => { measure(); render(state.p); syncStory(self.progress); },
      onUpdate: self => syncStory(self.progress),
      onToggle: self => {
        const wc = self.isActive ? 'transform' : 'auto';
        door.style.willChange = wc;
        hallImg.style.willChange = wc;
      },
    },
  });

  return () => {
    doorImg.removeEventListener('load', onDoorLoad);
    tween.scrollTrigger?.kill();
    tween.kill();
    if (story) { story.classList.remove('is-continuous'); story.style.visibility = ''; }
    [door, hall, hallImg, flash, content, cue].forEach(el => {
      ['transform', 'transformOrigin', 'clipPath', 'opacity', 'visibility', 'filter', 'willChange'].forEach(p => { el.style[p] = ''; });
    });
  };
}

/**
 * Reduced motion: no pin, no scrub, no zoom, no movement.
 * The door simply crossfades to the hall on first scroll, and content blocks fade in (opacity only).
 */
function heroReduced(gsap, ScrollTrigger) {
  const hall = document.querySelector('.hero__layer--hall');
  if (!hall) return;
  const heroText = [...document.querySelectorAll('.hero__content, .hero__scroll')];
  gsap.set(hall, { autoAlpha: 0 });
  const st = ScrollTrigger.create({
    start: 40,
    end: 'max',
    onToggle: self => {
      gsap.to(hall, { autoAlpha: self.isActive ? 1 : 0, duration: .8, ease: 'power1.inOut', overwrite: true });
      gsap.to(heroText, { autoAlpha: self.isActive ? 0 : 1, duration: .5, ease: 'none', overwrite: true });
    },
  });

  const blocks = [...document.querySelectorAll(
    '.story__inner > *, .tour__head, .tour__caption, .section-head, .card, .sold-card, .map, .testimonials__stage, .vform, .finale__content > *',
  )];
  const fades = blocks.map(el => gsap.from(el, {
    autoAlpha: 0, duration: .8, ease: 'none',
    scrollTrigger: { trigger: el, start: 'top 92%', once: true },
  }));

  return () => {
    st.kill();
    fades.forEach(t => { t.scrollTrigger?.kill(); t.kill(); });
    gsap.set([hall, ...heroText, ...blocks], { clearProps: 'opacity,visibility' });
  };
}

/* =========================================================
   Entry point
   ========================================================= */
export async function initAnimations() {
  const { gsap, ScrollTrigger, SplitText } = window;
  const preloader = document.getElementById('preloader');
  if (!gsap || !ScrollTrigger) { preloader?.remove(); return; }

  gsap.registerPlugin(ScrollTrigger);
  if (SplitText) gsap.registerPlugin(SplitText);
  ScrollTrigger.config({ ignoreMobileResize: true });

  // Line splitting needs the real fonts (the preloader is covering the page meanwhile).
  await Promise.race([document.fonts?.ready ?? Promise.resolve(), wait(1500)]);

  const reduce = prefersReducedMotion();
  lenis = initLenis(gsap, ScrollTrigger, reduce);
  window.lenis = lenis;                 // handy for debugging from the console
  initAnchors();

  const playIntro = prepareHeroIntro(gsap, SplitText, reduce);

  const mm = gsap.matchMedia();
  mm.add({
    desktop: '(min-width: 1024px)',
    mobile: '(max-width: 1023.98px)',
    reduce: REDUCE_QUERY,
  }, ctx => {
    const { desktop, reduce: r } = ctx.conditions;
    if (r) return heroReduced(gsap, ScrollTrigger);
    // Created in DOM order so every pin is measured after the pins above it.
    const cleanups = [
      heroSequence(gsap, ScrollTrigger, desktop ? 250 : 180),
      sectionAnimations({ gsap, ScrollTrigger, SplitText, desktop }),
    ];
    return () => cleanups.forEach(fn => fn?.());
  });

  initGlobalUI(gsap, ScrollTrigger);

  await runPreloader(gsap, reduce);
  playIntro();

  // Layout can still move after fonts and lazy images arrive.
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
  window.addEventListener('load', () => ScrollTrigger.refresh(), { once: true });
}
