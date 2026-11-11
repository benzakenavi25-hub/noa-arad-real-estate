// Single source of truth for "should this page move?".
//
// Reduced motion comes from the OS setting (prefers-reduced-motion).
// For testing in a browser that cannot emulate it, add ?reduce-motion to the URL.

const FORCED = /[?&]reduce-motion\b/.test(location.search);
const query = window.matchMedia('(prefers-reduced-motion: reduce)');

export const prefersReducedMotion = () => FORCED || query.matches;

/** Media query for gsap.matchMedia(): always true when forced. */
export const REDUCE_QUERY = FORCED ? '(min-width: 0px)' : '(prefers-reduced-motion: reduce)';

/** Lets CSS follow the same decision (see `.reduce-motion` in style.css). */
function syncClass() {
  document.documentElement.classList.toggle('reduce-motion', prefersReducedMotion());
}
syncClass();
query.addEventListener?.('change', syncClass);
