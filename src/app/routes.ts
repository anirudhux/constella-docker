/* Tiny path helper — the offline shell is a single page at "/". navigateTo
   just clears any address left in the bar (e.g. after "start over"). */
export function navigateTo(path: "/" = "/") {
  if (window.location.pathname !== path) {
    window.history.pushState(null, "", path);
  }
  window.scrollTo(0, 0);
}
