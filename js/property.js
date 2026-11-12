// property.html: reads ?id= and renders one listing from properties.json.

import { loadProperties, formatPrice, formatNumber, escapeHTML, pictureHTML, lqipStyle, loadDeferred } from './listings.js';
import { createMap, LOCATIONS } from './map.js';
import { initCursor } from './sections.js';
import { prefersReducedMotion } from './motion.js';

const WHATSAPP = '972500000000';

const main = document.getElementById('main');
const reduce = prefersReducedMotion();
let lenis = null;

const sqm = n => `${formatNumber(n)} מ״ר`;

function factsHTML(p) {
  const facts = [];
  if (p.rooms) facts.push(['חדרים', formatNumber(p.rooms)]);
  if (p.builtArea) facts.push(['שטח בנוי', sqm(p.builtArea)]);
  if (p.plotArea) facts.push(['מגרש', sqm(p.plotArea)]);
  if (p.terraceArea) facts.push(['מרפסת', sqm(p.terraceArea)]);
  if (p.gardenArea) facts.push(['גינה', sqm(p.gardenArea)]);
  if (p.daysToSell) facts.push(['נמכר תוך', `${formatNumber(p.daysToSell)} ימים`]);
  return facts.map(([k, v]) => `<div class="fact"><dt>${k}</dt><dd>${v}</dd></div>`).join('');
}

function whatsappLink(p) {
  const text = `שלום נועה, אשמח לתאם סיור בנכס: ${p.title}, ${p.city}`;
  return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(text)}`;
}

function notFoundHTML() {
  return `
    <section class="property__missing container">
      <p class="label">נכסים</p>
      <h1>הנכס לא נמצא</h1>
      <p>ייתכן שהקישור שגוי או שהנכס כבר אינו מוצג באתר.</p>
      <a class="btn" href="index.html#listings"><span>→ חזרה לנכסים</span></a>
    </section>`;
}

function propertyHTML(p, { sold }) {
  const gallery = p.gallery?.length ? p.gallery : null;
  const features = p.features?.length
    ? `<ul class="pills" aria-label="מאפייני הנכס">${p.features.map(f => `<li class="pill">${escapeHTML(f)}</li>`).join('')}</ul>`
    : '';
  const galleryHTML = gallery ? `
    <section class="pgallery" aria-labelledby="gallery-title">
      <div class="container pgallery__head">
        <p class="label">גלריה</p>
        <h2 id="gallery-title">סיור בתמונות</h2>
        <p class="pgallery__hint">גררו או גללו לצדדים · לחיצה פותחת מסך מלא</p>
      </div>
      <ul class="pgallery__strip" tabindex="0" aria-label="תמונות הנכס – גלילה אופקית">
        ${gallery.map((g, i) => `
          <li class="pgallery__item">
            <button type="button" class="pgallery__btn" data-lb-open="${i}" data-cursor="צפייה">
              <span class="visually-hidden">הגדלת התמונה: </span>
              <span class="pgallery__media" style="${lqipStyle(g.file)}">${pictureHTML(g.file, g.alt, { sizes: '(min-width: 1024px) 60vw, 86vw', deferred: true })}</span>
              <span class="pgallery__num" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>
            </button>
          </li>`).join('')}
      </ul>
    </section>` : '';

  return `
    <article>
      <header class="phero">
        <div class="phero__media" style="${lqipStyle(p.image)}">
          ${pictureHTML(p.image, `${p.title}, ${p.city}`, { sizes: '100vw', eager: true, portrait: true })}
        </div>
        <div class="container phero__content">
          <a class="phero__back" href="index.html#listings">→ חזרה לנכסים</a>
          <p class="label">${escapeHTML(p.city)}${sold ? ' · נמכר' : ''}</p>
          <h1 class="phero__title">${escapeHTML(p.title)}</h1>
        </div>
      </header>

      <section class="pinfo container" aria-label="פרטי הנכס">
        <div class="pinfo__price">
          <p class="pinfo__price-label">${sold ? 'נמכר במחיר' : 'מחיר מבוקש'}</p>
          <p class="pinfo__price-value">${formatPrice(p.price)}</p>
        </div>
        <div class="pinfo__body">
          ${p.description ? `<p class="pinfo__desc">${escapeHTML(p.description)}</p>` : ''}
          <dl class="facts">${factsHTML(p)}</dl>
          ${features}
        </div>
      </section>

      ${galleryHTML}

      <section class="pmap container" aria-labelledby="pmap-title">
        <div class="pmap__text">
          <p class="label">מיקום</p>
          <h2 id="pmap-title">${escapeHTML(p.city)}</h2>
          <a class="btn btn--ghost pmap__back" href="index.html#listings"><span>→ חזרה לכל הנכסים</span></a>
        </div>
        <div class="map map--small" id="property-map" role="region" aria-label="מפה: ${escapeHTML(p.city)}"></div>
      </section>
    </article>

    ${sold ? '' : `
    <aside class="pcta" aria-label="תיאום סיור">
      <div class="container pcta__inner">
        <p class="pcta__text"><strong>${escapeHTML(p.title)}</strong><span>${escapeHTML(p.city)} · ${formatPrice(p.price)}</span></p>
        <a class="btn btn--solid" href="${whatsappLink(p)}" target="_blank" rel="noopener"><span>תיאום סיור בנכס</span></a>
      </div>
    </aside>`}`;
}

/* ---------- Gallery: drag-to-scroll strip ---------- */
function initStrip(strip) {
  let down = false, startX = 0, moved = 0;
  strip.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    down = true; startX = e.clientX; moved = 0;
  });
  window.addEventListener('pointermove', e => {
    if (!down) return;
    const dx = e.clientX - startX;
    startX = e.clientX;
    moved += Math.abs(dx);
    if (moved > 4) strip.classList.add('is-dragging');
    strip.scrollLeft -= dx;                   // delta-based, so it works with RTL scroll offsets
  });
  window.addEventListener('pointerup', () => {
    if (!down) return;
    down = false;
    setTimeout(() => strip.classList.remove('is-dragging'), 0);
  });
  // A drag must not open the lightbox.
  strip.addEventListener('click', e => {
    if (moved > 6) { e.preventDefault(); e.stopPropagation(); moved = 0; }
  }, true);
  strip.addEventListener('dragstart', e => e.preventDefault());
}

/* ---------- Gallery: fullscreen lightbox (keyboard + swipe) ---------- */
function initLightbox(items) {
  const dialog = document.getElementById('lightbox');
  if (!dialog || !items?.length) return;
  const img = dialog.querySelector('.lightbox__img');
  const text = dialog.querySelector('[data-lb-text]');
  const count = dialog.querySelector('[data-lb-count]');
  let index = 0, opener = null;

  const show = i => {
    index = (i + items.length) % items.length;
    const name = items[index].file.replace(/\.(jpe?g|png)$/i, '');
    img.classList.remove('is-loaded');
    img.onload = () => img.classList.add('is-loaded');
    img.srcset = `images/opt/${name}-768.webp 768w, images/opt/${name}-1280.webp 1280w, images/opt/${name}-2560.webp 2560w`;
    img.sizes = '100vw';
    img.src = `images/${items[index].file}`;
    img.alt = items[index].alt;
    text.textContent = items[index].alt;
    count.textContent = `${index + 1} / ${items.length}`;
  };
  const open = (i, from) => {
    opener = from;
    show(i);
    dialog.showModal();
    lenis?.stop();
    document.documentElement.classList.add('lightbox-open');
  };
  const close = () => dialog.close();

  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-lb-open]');
    if (btn) open(Number(btn.dataset.lbOpen), btn);
  });
  dialog.querySelector('[data-lb-close]').addEventListener('click', close);
  dialog.querySelector('[data-lb-next]').addEventListener('click', () => show(index + 1));
  dialog.querySelector('[data-lb-prev]').addEventListener('click', () => show(index - 1));
  dialog.addEventListener('click', e => { if (e.target === dialog) close(); });     // backdrop
  dialog.addEventListener('close', () => {
    lenis?.start();
    document.documentElement.classList.remove('lightbox-open');
    opener?.focus();
  });
  dialog.addEventListener('keydown', e => {
    // RTL: the next image is to the left.
    if (e.key === 'ArrowLeft') { e.preventDefault(); show(index + 1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); show(index - 1); }
    if (e.key === 'Home') { e.preventDefault(); show(0); }
    if (e.key === 'End') { e.preventDefault(); show(items.length - 1); }
  });

  // Swipe: dragging the image to the right brings the next one (it sits to the left in RTL).
  let sx = 0, sy = 0, tracking = false;
  dialog.addEventListener('pointerdown', e => { tracking = true; sx = e.clientX; sy = e.clientY; });
  dialog.addEventListener('pointerup', e => {
    if (!tracking) return;
    tracking = false;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) show(index + (dx > 0 ? 1 : -1));
  });
  dialog.addEventListener('pointercancel', () => { tracking = false; });
}

/* ---------- Page ---------- */
async function init() {
  const id = new URLSearchParams(location.search).get('id');
  let property = null, sold = false;
  try {
    const data = await loadProperties();
    property = (data.forSale || []).find(p => p.id === id) || null;
    if (!property) { property = (data.sold || []).find(p => p.id === id) || null; sold = !!property; }
  } catch (err) {
    console.error(err);
  }

  main.setAttribute('aria-busy', 'false');
  if (!property) {
    main.innerHTML = notFoundHTML();
    document.title = 'הנכס לא נמצא · נועה ארד – נדל"ן פרטי';
    return;
  }

  main.innerHTML = propertyHTML(property, { sold });
  document.title = `${property.title}, ${property.city} · נועה ארד – נדל"ן פרטי`;
  document.querySelector('meta[name="description"]')?.setAttribute('content', `${property.title}, ${property.city}. ${property.description || ''} אתר תצוגה.`);
  document.body.classList.toggle('has-cta', !sold);

  const strip = document.querySelector('.pgallery__strip');
  if (strip) {
    initStrip(strip);
    // Gallery photos download only when the gallery comes near the screen.
    const gio = new IntersectionObserver(entries => {
      if (!entries.some(e => e.isIntersecting)) return;
      gio.disconnect();
      loadDeferred(strip);
    }, { rootMargin: '400px 0px' });
    gio.observe(strip);
  }
  initLightbox(property.gallery || []);

  const heroImg = document.querySelector('.phero__media img');
  const ready = () => requestAnimationFrame(() => document.body.classList.add('is-ready'));
  if (heroImg && !heroImg.complete) {
    heroImg.addEventListener('load', ready, { once: true });
    heroImg.addEventListener('error', ready, { once: true });
    setTimeout(ready, 1500);
  } else {
    ready();
  }

  // This module loads async (it renders before the libraries arrive).
  // Map, smooth scroll and cursor need Leaflet / Lenis / GSAP, so they wait for the page load.
  if (document.readyState !== 'complete') await new Promise(r => window.addEventListener('load', r, { once: true }));

  // Small map with the city marker.
  const loc = LOCATIONS.find(l => l.city === property.city);
  const mapEl = document.getElementById('property-map');
  if (loc && mapEl) {
    const io = new IntersectionObserver(entries => {
      if (!entries.some(e => e.isIntersecting)) return;
      io.disconnect();
      createMap(mapEl, { locations: [loc], center: [loc.lat, loc.lng], zoom: 13, showDeals: false });
    }, { rootMargin: '300px 0px' });
    io.observe(mapEl);
  } else {
    mapEl?.closest('.pmap')?.classList.add('pmap--nomap');
  }

  // Motion: smooth scroll + cursor.
  if (!reduce && window.Lenis) {
    lenis = new window.Lenis({ lerp: 0.1, autoRaf: true });
  }
  if (!reduce && window.gsap && window.matchMedia('(min-width: 1024px) and (hover: hover) and (pointer: fine)').matches) {
    initCursor(window.gsap);
  }
}

init();
