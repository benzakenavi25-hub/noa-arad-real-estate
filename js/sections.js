// Section animations (4.2–4.9) + custom cursor.
// Called from animations.js inside gsap.matchMedia(), never with reduced motion.
// Everything hidden here is hidden by JS, so the page stays complete without it.

const clamp01 = v => Math.min(1, Math.max(0, v));

export function sectionAnimations({ gsap, ScrollTrigger, SplitText, desktop }) {
  const root = document.documentElement;
  const cleanups = [];
  const on = (target, type, fn) => { target.addEventListener(type, fn); cleanups.push(() => target.removeEventListener(type, fn)); };
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

  root.classList.add('motion');
  cleanups.push(() => root.classList.remove('motion'));

  /** Splits into masked lines. Falls back to the element itself if SplitText is missing. */
  const splitLines = (el, opts = {}) => (SplitText
    ? SplitText.create(el, { type: 'lines', mask: 'lines', linesClass: 'line', aria: 'none', ...opts })
    : { lines: [el], revert() {} });

  /** One-shot masked line reveal when `trigger` enters. The split is reverted afterwards so text can re-wrap. */
  function revealLines(el, { trigger = el, start = 'top 86%', delay = 0, stagger = .09 } = {}) {
    if (!el) return;
    const split = splitLines(el);
    gsap.from(split.lines, {
      yPercent: 110, duration: 1.25, ease: 'expo.out', stagger, delay,
      scrollTrigger: { trigger, start, once: true },
      onComplete: () => split.revert(),
    });
  }

  const fadeUp = (els, { trigger, start = 'top 86%', delay = 0, y = 22, stagger = .1 } = {}) => {
    const list = [].concat(els).filter(Boolean);
    if (!list.length) return;
    gsap.from(list, {
      autoAlpha: 0, y, duration: 1.1, ease: 'power3.out', stagger, delay,
      scrollTrigger: { trigger: trigger || list[0], start, once: true },
    });
  };

  /** "Ink fill": words start faint and fill to full colour one by one, scrubbed with scroll,
   *  then a short gold rule draws in. DOM order is already the Hebrew reading order. */
  function inkFill(h) {
    if (!h) return;
    const split = SplitText ? SplitText.create(h, { type: 'words', wordsClass: 'ink-word' }) : null;
    if (!split) return;
    h.classList.add('ink-head');
    cleanups.push(() => { h.classList.remove('ink-head'); h.style.removeProperty('--rule'); });
    gsap.timeline({
      scrollTrigger: { trigger: h, start: 'top 85%', end: 'top 45%', scrub: true },
    })
      .fromTo(split.words, { opacity: .18 }, { opacity: 1, ease: 'none', duration: 1, stagger: 1 })
      .fromTo(h, { '--rule': 0 }, { '--rule': 1, ease: 'none', duration: Math.max(1, split.words.length * .5) });
  }

  const markIn = (el, start = 'top 86%') => ScrollTrigger.create({
    trigger: el, start, once: true, onEnter: () => el.classList.add('is-in'),
  });

  /* ---------------------------------------------------------
     4.2 Story
     --------------------------------------------------------- */
  {
    const story = $('#story');
    const bg = $('.story__bg', story);
    // The overlay darkens over the hall image as the text scrolls in.
    gsap.fromTo(bg, { '--dim': 0 }, {
      '--dim': 1, ease: 'none',
      scrollTrigger: { trigger: story, start: 'top top', end: '+=75%', scrub: true },
    });
    cleanups.push(() => bg.style.removeProperty('--dim'));

    fadeUp($('.label', story), { start: 'top 90%' });
    inkFill($('.story__title', story));
    revealLines($('.story__subtitle', story), { delay: .15 });
    $$('.story__lines p', story).forEach((p, i) => revealLines(p, { trigger: $('.story__lines', story), start: 'top 82%', delay: i * .18 }));

    $$('.stat', story).forEach((stat, i) => {
      const numEl = $('.stat__num', stat);
      const end = Number(numEl.dataset.count);
      const decimals = Number(numEl.dataset.decimals || 0);
      const fmt = new Intl.NumberFormat('he-IL', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
      const finalText = numEl.textContent;
      const counter = { v: 0 };
      numEl.textContent = fmt.format(0);
      cleanups.push(() => { numEl.textContent = finalText; stat.classList.remove('is-in'); });
      ScrollTrigger.create({
        trigger: stat, start: 'top 90%', once: true,
        onEnter: () => {
          stat.classList.add('is-in');
          gsap.to(counter, {
            v: end, duration: 2, ease: 'power2.out', delay: i * .12,
            onUpdate: () => { numEl.textContent = fmt.format(counter.v); },
          });
        },
      });
      fadeUp([$('.stat__label', stat), $('.stat__suffix', stat)], { trigger: stat, start: 'top 90%', delay: i * .12, y: 0 });
    });
  }

  /* ---------------------------------------------------------
     Section heads (tour, listings, sold, map, valuation)
     --------------------------------------------------------- */
  $$('.section-head, .tour__head').forEach(head => {
    fadeUp($('.label', head), { trigger: head });
    inkFill($('h2', head));
    fadeUp($('.section-head__sub', head), { trigger: head, delay: .3 });
    markIn(head);
    cleanups.push(() => head.classList.remove('is-in'));
  });

  /* ---------------------------------------------------------
     4.3 Tour
     --------------------------------------------------------- */
  {
    const tour = $('#tour');
    const viewport = $('.tour__viewport', tour);
    const track = $('.tour__track', tour);
    const panels = $$('.tour__panel', tour);
    const imgs = panels.map(p => $('.tour__media img', p));
    const n = panels.length;

    // Caption timeline per panel: number, title, line, button.
    const captions = panels.map(panel => {
      const cap = $('.tour__caption', panel);
      const title = splitLines($('h3', cap));
      const line = splitLines($('p:not(.label)', cap));
      const tl = gsap.timeline({ paused: true })
        .from($('.label', cap), { autoAlpha: 0, duration: .7, ease: 'power2.out' }, 0)
        .from(title.lines, { yPercent: 110, duration: 1.1, ease: 'expo.out', stagger: .08 }, .05)
        .from(line.lines, { yPercent: 110, duration: 1.1, ease: 'expo.out', stagger: .08 }, .2);
      const btn = $('.btn', cap);
      if (btn) tl.from(btn, { autoAlpha: 0, y: 18, duration: .9, ease: 'power3.out' }, .45);
      return tl;
    });

    if (desktop) {
      // Horizontal: in RTL the next panel arrives from the LEFT, so the track moves along +X.
      tour.classList.add('is-horizontal');
      cleanups.push(() => tour.classList.remove('is-horizontal'));
      const current = $('.tour__current', tour);
      const bar = $('.tour__progress-bar', tour);
      const distance = () => track.scrollWidth - viewport.clientWidth;
      let active = -1;

      const setActive = i => {
        if (i === active) return;
        active = i;
        current.textContent = String(i + 1).padStart(2, '0');
        captions.forEach((tl, k) => (k === i ? tl.play() : tl.reverse()));
      };
      const update = progress => {
        const f = progress * (n - 1);                     // position in "panels"
        imgs.forEach((img, i) => { img.style.transform = `scale(${(1 + .15 * clamp01(Math.abs(i - f))).toFixed(4)})`; });
        bar.style.transform = `scaleX(${((f + 1) / n).toFixed(4)})`;
        if (active !== -1) setActive(Math.round(f));
      };
      update(0);

      const tween = gsap.to(track, {
        x: () => distance(),
        ease: 'none',
        onUpdate() { update(this.progress()); },
        scrollTrigger: {
          trigger: viewport,
          start: 'top top',
          end: () => `+=${distance()}`,
          pin: true,
          scrub: 1,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          snap: { snapTo: 1 / (n - 1), duration: { min: .25, max: .6 }, delay: .08, ease: 'power2.inOut' },
        },
      });
      // First caption plays when the tour comes into view (before the pin starts).
      ScrollTrigger.create({
        trigger: viewport, start: 'top 55%', once: true,
        onEnter: () => { if (active === -1) setActive(Math.round(tween.progress() * (n - 1))); },
      });
      cleanups.push(() => {
        imgs.forEach(img => { img.style.transform = ''; });
        bar.style.transform = '';
        current.textContent = '01';
      });
    } else {
      // Mobile: vertical full-height panels.
      panels.forEach((panel, i) => {
        gsap.fromTo(imgs[i], { scale: 1.1 }, {
          scale: 1, ease: 'none',
          scrollTrigger: { trigger: panel, start: 'top bottom', end: 'top top', scrub: true },
        });
        ScrollTrigger.create({ trigger: panel, start: 'top 45%', once: true, onEnter: () => captions[i].play() });
      });
    }
  }

  /* ---------------------------------------------------------
     4.4 Listings
     --------------------------------------------------------- */
  {
    const cards = $$('.listings .card');
    const media = c => $('.card__media', c);
    const px = c => $('.card__px', c);
    const body = c => $('.card__body', c);

    gsap.set(cards.map(media), { clipPath: 'inset(100% 0% 0% 0%)' });
    gsap.set(cards.map(px), { scale: 1.2 });
    gsap.set(cards.map(body), { autoAlpha: 0, y: 26 });

    ScrollTrigger.batch(cards, {
      start: 'top 88%',
      once: true,
      onEnter: batch => {
        gsap.to(batch.map(media), { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.4, ease: 'expo.out', stagger: .12 });
        gsap.to(batch.map(px), { scale: 1, duration: 1.8, ease: 'expo.out', stagger: .12 });
        gsap.to(batch.map(body), { autoAlpha: 1, y: 0, duration: 1.1, ease: 'power3.out', stagger: .12, delay: .3 });
      },
    });

    if (desktop) {
      // Inner parallax: the image travels at ~0.85x inside its frame.
      cards.forEach(card => {
        gsap.fromTo(px(card), { yPercent: -7.6 }, {
          yPercent: 7.6, ease: 'none',
          scrollTrigger: { trigger: card, start: 'top bottom', end: 'bottom top', scrub: true },
        });
      });
    }
  }

  /* ---------------------------------------------------------
     City marquee: slow base drift, pushed by scroll velocity, easing back
     --------------------------------------------------------- */
  {
    const marquee = $('.marquee');
    const track = $('.marquee__track', marquee);
    const group = $('.marquee__group', marquee);
    const base = desktop ? 46 : 26;          // px/s; positive = +X, i.e. along the RTL reading direction
    let x = 0, speed = base, loopW = 0;
    const measure = () => { loopW = group.getBoundingClientRect().width; };
    const velocitySource = ScrollTrigger.create({ start: 0, end: 'max' });

    const tick = (time, dtMs) => {
      const dt = Math.min(dtMs, 64) / 1000;
      const target = base + gsap.utils.clamp(-1400, 1400, velocitySource.getVelocity()) * .32;
      speed += (target - speed) * (1 - Math.exp(-dt * 3.2));     // ease back to base once scrolling stops
      if (loopW) {
        x = gsap.utils.wrap(0, loopW, x + speed * dt);
        track.style.transform = `translate3d(${x.toFixed(2)}px,0,0)`;
      }
    };
    let running = false;
    const setRunning = on => {
      if (on === running) return;
      running = on;
      on ? gsap.ticker.add(tick) : gsap.ticker.remove(tick);
    };
    measure();
    ScrollTrigger.addEventListener('refresh', measure);
    const st = ScrollTrigger.create({
      trigger: marquee, start: 'top bottom', end: 'bottom top',
      onToggle: self => setRunning(self.isActive),
    });
    cleanups.push(() => {
      setRunning(false); st.kill(); velocitySource.kill();
      ScrollTrigger.removeEventListener('refresh', measure);
      track.style.transform = '';
    });
  }

  /* ---------------------------------------------------------
     4.5 Sold wall
     --------------------------------------------------------- */
  {
    const cards = $$('.sold-card');
    const media = c => $('.sold-card__media', c);
    const stamp = c => $('.stamp', c);
    const body = c => $('.sold-card__body', c);

    gsap.set(cards.map(media), { clipPath: 'inset(100% 0% 0% 0%)' });
    gsap.set(cards.map(stamp), { autoAlpha: 0, scale: 2.4, rotation: -14 });
    gsap.set(cards.map(body), { autoAlpha: 0, y: 20 });

    ScrollTrigger.batch(cards, {
      start: 'top 78%',
      once: true,
      onEnter: batch => batch.forEach((card, i) => {
        gsap.timeline({ delay: i * .25 })
          .to(media(card), { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.2, ease: 'expo.out' }, 0)
          .to(body(card), { autoAlpha: 1, y: 0, duration: 1, ease: 'power3.out' }, .3)
          // The one bouncy moment on the site: the stamp lands…
          .to(stamp(card), { autoAlpha: 1, scale: 1, duration: .5, ease: 'back.out(2)' }, .7)
          // …and the card takes a tiny 2px hit.
          .to(card, { keyframes: { x: [0, -2, 2, -1, 0] }, duration: .3, ease: 'none' }, .86);
      }),
    });
  }

  /* ---------------------------------------------------------
     4.6 Map markers pop in one by one
     --------------------------------------------------------- */
  {
    const mapEl = $('#sharon-map');
    let done = false;
    const arm = () => {
      if (done) return;
      const dots = $$('.gold-marker__dot, .gold-marker__ring', mapEl);
      const pulses = $$('.gold-marker__pulse', mapEl);
      if (!dots.length) return;
      done = true;
      gsap.set(dots, { scale: 0 });
      gsap.set(pulses, { visibility: 'hidden' });       // opacity is owned by the CSS pulse animation
      ScrollTrigger.create({
        trigger: mapEl, start: 'top 72%', once: true,
        onEnter: () => {
          gsap.to(dots, { scale: 1, duration: 1, ease: 'expo.out', stagger: .16 });
          pulses.forEach((p, i) => gsap.delayedCall(.3 + i * .16, () => { p.style.visibility = 'visible'; }));
        },
      });
    };
    arm();
    on(document, 'map:ready', arm);
  }

  /* ---------------------------------------------------------
     4.8 Valuation: "sunrise" (ink → cream) and back to ink before the finale
     --------------------------------------------------------- */
  {
    const dawn = $('.dawn');
    const valuation = $('#valuation');
    const finale = $('#contact');
    const NIGHT = { '--bg': [14, 13, 11, 1], '--fg': [237, 230, 218, 1], '--fg-2': [217, 204, 184, 1], '--accent': [184, 148, 90, 1], '--rule': [184, 148, 90, .32] };
    const DAY = { '--bg': [243, 237, 227, 1], '--fg': [14, 13, 11, 1], '--fg-2': [74, 66, 55, 1], '--accent': [122, 92, 46, 1], '--rule': [122, 92, 46, .35] };
    const props = Object.keys(NIGHT);
    let last = -1;

    valuation.classList.remove('theme-cream');
    dawn.classList.add('is-dawn');

    const update = () => {
      const vh = window.innerHeight;
      const rise = clamp01((vh * .9 - valuation.getBoundingClientRect().top) / (vh * .6));   // section scrolls in
      const fall = clamp01((vh * .5 - finale.getBoundingClientRect().top) / (vh * .5));    // finale covers the upper half
      const m = Math.round(Math.min(rise, 1 - fall) * 200) / 200;
      if (m === last) return;
      last = m;
      props.forEach(p => {
        const a = NIGHT[p], b = DAY[p];
        const c = a.map((v, i) => v + (b[i] - v) * m);
        dawn.style.setProperty(p, `rgba(${Math.round(c[0])}, ${Math.round(c[1])}, ${Math.round(c[2])}, ${c[3].toFixed(3)})`);
      });
    };
    update();
    ScrollTrigger.create({ trigger: dawn, start: 'top bottom', endTrigger: finale, end: 'top top', onUpdate: update, onRefresh: update });
    cleanups.push(() => {
      props.forEach(p => dawn.style.removeProperty(p));
      dawn.classList.remove('is-dawn');
      valuation.classList.add('theme-cream');
    });

    fadeUp($('.vform', valuation), { start: 'top 82%' });

    // Step transitions: RTL-aware slide. Forward = the new step arrives from the left.
    on(document, 'valuation:step', e => {
      const { step, dir } = e.detail;
      gsap.fromTo(step, { x: -40 * dir, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: .7, ease: 'power3.out', overwrite: true, clearProps: 'transform' });
    });
    on(document, 'valuation:submitted', e => {
      gsap.from(e.detail.thanks.children, { autoAlpha: 0, y: 24, duration: 1.2, ease: 'power3.out', stagger: .25 });
    });
  }

  /* ---------------------------------------------------------
     4.9 Finale
     --------------------------------------------------------- */
  {
    const finale = $('#contact');
    const img = $('.finale__media img', finale);
    const title = $('.finale__title', finale);
    const split = SplitText ? SplitText.create(title, { type: 'words', mask: 'words' }) : { words: [title] };

    gsap.timeline({
      scrollTrigger: {
        trigger: finale,
        start: 'top top',
        end: desktop ? '+=130%' : '+=90%',
        pin: true,
        scrub: 1,
        anticipatePin: 1,
      },
    })
      // The camera steps back to look at the house.
      .fromTo(img, { scale: 1.35 }, { scale: 1, ease: 'none', duration: 1 }, 0)
      .from(split.words, { yPercent: 110, ease: 'power3.out', duration: .3, stagger: .07 }, .18)
      .from($('.finale__cta', finale), { y: 44, autoAlpha: 0, ease: 'power3.out', duration: .22 }, .62)
      .from($('.finale__details', finale), { autoAlpha: 0, ease: 'none', duration: .18 }, .78);
  }

  /* ---------------------------------------------------------
     Custom cursor (desktop + fine pointer only)
     --------------------------------------------------------- */
  if (desktop && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    cleanups.push(initCursor(gsap));
  }

  return () => cleanups.forEach(fn => fn());
}

/* =========================================================
   Custom cursor: gold dot + lagging ring
   ========================================================= */
export function initCursor(gsap) {
  const root = document.documentElement;
  const dot = Object.assign(document.createElement('div'), { className: 'cursor-dot' });
  const ring = Object.assign(document.createElement('div'), { className: 'cursor-ring' });
  const label = Object.assign(document.createElement('span'), { className: 'cursor-ring__label' });
  [dot, ring].forEach(el => el.setAttribute('aria-hidden', 'true'));
  ring.append(label);
  document.body.append(ring, dot);
  root.classList.add('has-cursor');

  const dotX = gsap.quickTo(dot, 'x', { duration: .12, ease: 'power3.out' });
  const dotY = gsap.quickTo(dot, 'y', { duration: .12, ease: 'power3.out' });
  const ringX = gsap.quickTo(ring, 'x', { duration: .55, ease: 'power3.out' });
  const ringY = gsap.quickTo(ring, 'y', { duration: .55, ease: 'power3.out' });

  const onMove = e => {
    root.classList.add('cursor-on');
    dotX(e.clientX); dotY(e.clientY);
    ringX(e.clientX); ringY(e.clientY);
  };
  const onOver = e => {
    const t = e.target instanceof Element ? e.target : null;
    const view = t?.closest('[data-cursor]');
    const text = !view && t?.closest('input, textarea, select');
    const hover = !view && !text && t?.closest('a, button, label, img, .leaflet-marker-icon');
    label.textContent = view ? view.dataset.cursor : '';
    ring.classList.toggle('is-view', !!view);
    ring.classList.toggle('is-text', !!text);
    ring.classList.toggle('is-hover', !!hover);
    root.classList.toggle('cursor-view', !!view);
  };
  const onLeave = () => root.classList.remove('cursor-on');

  window.addEventListener('mousemove', onMove, { passive: true });
  document.addEventListener('mouseover', onOver, { passive: true });
  document.documentElement.addEventListener('mouseleave', onLeave);

  return () => {
    window.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseover', onOver);
    document.documentElement.removeEventListener('mouseleave', onLeave);
    root.classList.remove('has-cursor', 'cursor-on', 'cursor-view');
    dot.remove(); ring.remove();
  };
}
