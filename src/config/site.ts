// Single source of truth for Constella's public origin.
//
// Everything user-facing that names the site — the "Made with Constella" badge
// baked into every export, the canonical/OG tags in index.html, and the
// host-redirect in middleware — derives from here. Change the domain in ONE
// place and it propagates; `scripts/check-hosts.mjs` fails the build if a stale
// host ever sneaks back into shipped output.

/** Canonical public origin, no trailing slash. */
export const SITE_URL = "https://constella.anirudhux.com";

/** Hostname only (no scheme) — used for host matching in middleware. */
export const SITE_HOST = "constella.anirudhux.com";

/**
 * Hosts Constella has historically answered on and now permanently redirects
 * away from. Add old deploy hosts here as they're retired.
 */
export const LEGACY_HOSTS = ["constella.vercel.app", "constella-viz.vercel.app"] as const;
