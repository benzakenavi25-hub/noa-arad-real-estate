// Renders listings from properties.json. Never hard-code a listing in HTML.

const DATA_URL = 'properties.json';
let cache = null;

export async function loadProperties() {
  if (!cache) {
    cache = window.__properties || fetch(DATA_URL).then(r => {
      if (!r.ok) throw new Error(`properties.json: ${r.status}`);
      return r.json();
    });
  }
  return cache;
}

const ils = new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 });
const num = new Intl.NumberFormat('he-IL');

export const formatPrice = n => ils.format(n);
export const formatNumber = n => num.format(n);

export const escapeHTML = s => String(s).replace(/[&<>"']/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

/**
 * Responsive <picture> for an image in images/ (with WebP from images/opt/).
 * `deferred: true` writes data-srcset / data-src instead, so nothing downloads until
 * loadDeferred() swaps them in (native lazy loading starts far too early for some layouts).
 * `portrait: true` adds the 3:4 crop (scripts/optimize.mjs) for portrait screens; use it only for
 * full-bleed covers of listing photos, where a phone shows ~30% of a 16:9 frame.
 * The 768w size is for images drawn at about screen width (cards, gallery); full-bleed covers on the
 * home page list 1280/2560 only, because a cover on a tall screen is drawn far wider than 100vw.
 */
export function pictureHTML(file, alt, { sizes = '100vw', eager = false, deferred = false, portrait = false } = {}) {
  const name = file.replace(/\.(jpe?g|png)$/i, '');
  const p = deferred ? 'data-' : '';
  return `
    <picture>${portrait ? `
      <source type="image/webp" media="(max-aspect-ratio: 3/4)" ${p}srcset="images/opt/${name}-portrait.webp">` : ''}
      <source type="image/webp" ${p}srcset="images/opt/${name}-768.webp 768w, images/opt/${name}-1280.webp 1280w, images/opt/${name}-2560.webp 2560w" sizes="${sizes}">
      <img ${p}src="images/${file}" width="1600" height="900" alt="${escapeHTML(alt)}"
           ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">
    </picture>`;
}

/** Swaps data-srcset / data-src into place for every deferred <picture> inside `root`. */
export function loadDeferred(root) {
  root.querySelectorAll('source[data-srcset]').forEach(s => { s.srcset = s.dataset.srcset; s.removeAttribute('data-srcset'); });
  root.querySelectorAll('img[data-src]').forEach(i => { i.src = i.dataset.src; i.removeAttribute('data-src'); });
}

export const lqipStyle = file => `background-image:url(images/opt/${file.replace(/\.(jpe?g|png)$/i, '')}-lqip.webp)`;

/** "7 חדרים · 420 מ״ר בנוי" */
export function factsLine(p) {
  return `${formatNumber(p.rooms)} חדרים · ${formatNumber(p.builtArea)} מ״ר בנוי`;
}

function saleCardHTML(p, { featured = false } = {}) {
  const tag = featured ? 'div' : 'li';
  const sizes = featured ? '(min-width: 1024px) 1320px, 100vw' : '(min-width: 1024px) 50vw, 100vw';
  return `
    <${tag} class="card${featured ? ' card--featured' : ''}">
      <a class="card__link" href="property.html?id=${encodeURIComponent(p.id)}">
        <div class="card__media" style="${lqipStyle(p.image)}">
          <div class="card__px">${pictureHTML(p.image, `${p.title}, ${p.city}`, { sizes })}</div>
        </div>
        <div class="card__body">
          <p class="card__city">${escapeHTML(p.city)}</p>
          <h3 class="card__title">${escapeHTML(p.title)}</h3>
          <p class="card__facts">${factsLine(p)}</p>
          <p class="card__price-wrap">
            <span class="card__price">${formatPrice(p.price)}</span>
            <span class="card__cta" aria-hidden="true">לצפייה בנכס</span>
          </p>
        </div>
      </a>
    </${tag}>`;
}

function soldCardHTML(p, i) {
  return `
    <li class="sold-card sold-card--${(i % 3) + 1}">
      <div class="sold-card__media" style="${lqipStyle(p.image)}">
        ${pictureHTML(p.image, `${p.title}, ${p.city} – נמכר`, { sizes: '(min-width: 1024px) 45vw, 100vw' })}
        <span class="stamp-wrap" aria-hidden="true"><span class="stamp">נמכר</span></span>
      </div>
      <div class="sold-card__body">
        <p class="sold-card__city">${escapeHTML(p.city)}</p>
        <h3 class="sold-card__title">${escapeHTML(p.title)}</h3>
        <p class="sold-card__days">נמכר תוך ${formatNumber(p.daysToSell)} ימים</p>
      </div>
    </li>`;
}

export async function renderListings(root = document) {
  const featuredEl = root.querySelector('[data-listings="featured"]');
  const gridEl = root.querySelector('[data-listings="grid"]');
  const soldEl = root.querySelector('[data-listings="sold"]');
  if (!featuredEl && !gridEl && !soldEl) return;

  try {
    const { forSale = [], sold = [] } = await loadProperties();
    const featured = forSale.find(p => p.featured);
    const rest = forSale.filter(p => p !== featured);

    if (featuredEl) featuredEl.innerHTML = featured ? saleCardHTML(featured, { featured: true }) : '';
    if (gridEl) gridEl.innerHTML = rest.map(p => saleCardHTML(p)).join('');
    if (soldEl) soldEl.innerHTML = sold.map(soldCardHTML).join('');
  } catch (err) {
    console.error(err);
    const msg = '<p class="load-error">לא ניתן לטעון את הנכסים כרגע.</p>';
    if (featuredEl) featuredEl.innerHTML = msg;
  }
}
