// Dark Leaflet map of the Sharon area.
//
// The brief asks for CARTO "Dark Matter" tiles, but basemaps.cartocdn.com now answers every
// request with an "API KEY REQUIRED" placeholder tile (see carto.com/basemaps/apikey).
// Until a key is available the map uses OpenStreetMap tiles, darkened with a CSS filter
// (.map--filtered in style.css). To switch back: put the keyed CARTO tile URL in CARTO_TILES.

export const LOCATIONS = [
  { city: 'רעננה', lat: 32.1848, lng: 34.8713, deals: 46 },
  { city: 'הרצליה פיתוח', lat: 32.1700, lng: 34.8030, deals: 23 },
  { city: 'כפר שמריהו', lat: 32.1855, lng: 34.8205, deals: 14 },
  { city: 'סביון', lat: 32.0490, lng: 34.8770, deals: 12 },
  { city: 'כוכב יאיר', lat: 32.2235, lng: 34.9880, deals: 9 },
  { city: 'תל אביב', lat: 32.0853, lng: 34.7818, deals: 18 },
];

const CARTO_TILES = '';   // e.g. the dark_all URL from your CARTO account, including its API key
const OSM = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const TILES = CARTO_TILES
  ? { url: CARTO_TILES, attribution: `${OSM} &copy; <a href="https://carto.com/attributions">CARTO</a>`, subdomains: 'abcd', filtered: false }
  : { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: OSM, subdomains: 'abc', filtered: true };

function goldIcon(L, feature = false) {
  const size = feature ? 28 : 18;
  return L.divIcon({
    className: feature ? 'gold-marker gold-marker--feature' : 'gold-marker',
    html: '<span class="gold-marker__pulse"></span>' + (feature ? '<span class="gold-marker__ring"></span>' : '') + '<span class="gold-marker__dot"></span>',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2 + 3)],
  });
}

/**
 * Creates a map in `el`. Returns { map, markers }.
 * @param {HTMLElement} el
 * `featured`: city names that get a larger, ringed marker and NO popup (the caller wires their click).
 * `lockTouch`: phones, so the map never captures page scroll.
 * @param {{ locations?: typeof LOCATIONS, center?: [number, number], zoom?: number, showDeals?: boolean, featured?: string[], lockTouch?: boolean }} opts
 */
export function createMap(el, { locations = LOCATIONS, center = [32.135, 34.86], zoom = 11, showDeals = true, featured = [], lockTouch = false } = {}) {
  const L = window.L;
  if (!L || !el) return null;

  const map = L.map(el, {
    center, zoom,
    scrollWheelZoom: false,
    ...(lockTouch ? { dragging: false, touchZoom: false, tap: false, doubleClickZoom: false } : {}),
    zoomControl: false,
    attributionControl: true,
  });
  // Phones: top-left, because the floating WhatsApp button sits in the bottom-left corner there.
  const zoomPos = window.matchMedia('(max-width: 1023.98px)').matches ? 'topleft' : 'bottomleft';
  L.control.zoom({ position: zoomPos, zoomInTitle: 'הגדלה', zoomOutTitle: 'הקטנה' }).addTo(map);
  el.classList.toggle('map--filtered', TILES.filtered);
  L.tileLayer(TILES.url, { attribution: TILES.attribution, subdomains: TILES.subdomains, maxZoom: 19 }).addTo(map);

  const markers = locations.map(loc => {
    const isFeature = featured.includes(loc.city);
    const m = L.marker([loc.lat, loc.lng], { icon: goldIcon(L, isFeature), title: loc.city, keyboard: true, alt: loc.city }).addTo(map);
    if (isFeature) return m;
    const body = showDeals ? `<span class="map-tip__deals">${loc.deals} עסקאות</span>` : '';
    m.bindPopup(`<div class="map-tip"><strong>${loc.city}</strong>${body}</div>`, {
      className: 'map-popup', closeButton: false, offset: [0, -4],
    });
    return m;
  });

  if (locations.length > 1) {
    map.fitBounds(L.latLngBounds(locations.map(l => [l.lat, l.lng])), { padding: [40, 40] });
  }
  return { map, markers };
}

/** Initialises the home-page map lazily, when it approaches the viewport. */
export function initHomeMap() {
  const el = document.getElementById('sharon-map');
  if (!el) return;
  const io = new IntersectionObserver(entries => {
    if (!entries.some(e => e.isIntersecting)) return;
    io.disconnect();
    const featured = [...document.querySelectorAll('.testimonial[data-city]')].map(f => f.dataset.city);
    const lockTouch = window.matchMedia('(max-width: 1023.98px)').matches;
    const result = createMap(el, { featured, lockTouch });
    if (result) document.dispatchEvent(new CustomEvent('map:ready', { detail: result }));
  }, { rootMargin: '400px 0px' });
  io.observe(el);
}
