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

function goldIcon(L) {
  return L.divIcon({
    className: 'gold-marker',
    html: '<span class="gold-marker__pulse"></span><span class="gold-marker__dot"></span>',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -12],
  });
}

/**
 * Creates a map in `el`. Returns { map, markers }.
 * @param {HTMLElement} el
 * @param {{ locations?: typeof LOCATIONS, center?: [number, number], zoom?: number, showDeals?: boolean }} opts
 */
export function createMap(el, { locations = LOCATIONS, center = [32.135, 34.86], zoom = 11, showDeals = true } = {}) {
  const L = window.L;
  if (!L || !el) return null;

  const map = L.map(el, {
    center, zoom,
    scrollWheelZoom: false,
    zoomControl: false,
    attributionControl: true,
  });
  L.control.zoom({ position: 'bottomleft', zoomInTitle: 'הגדלה', zoomOutTitle: 'הקטנה' }).addTo(map);
  el.classList.toggle('map--filtered', TILES.filtered);
  L.tileLayer(TILES.url, { attribution: TILES.attribution, subdomains: TILES.subdomains, maxZoom: 19 }).addTo(map);

  const icon = goldIcon(L);
  const markers = locations.map(loc => {
    const m = L.marker([loc.lat, loc.lng], { icon, title: loc.city, keyboard: true, alt: loc.city }).addTo(map);
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
    const result = createMap(el);
    if (result) document.dispatchEvent(new CustomEvent('map:ready', { detail: result }));
  }, { rootMargin: '400px 0px' });
  io.observe(el);
}
