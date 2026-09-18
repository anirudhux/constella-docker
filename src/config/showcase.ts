/* Showcase bench — vertical URLs (/v/<slug>) for curated demos.

   PUBLISHING NEEDS NO CODE CHANGE. The slug IS the filename:

     /v/sarvam  →  public/showcase/sarvam.json

   Drop the JSON in public/showcase/ (nodes-and-links manifest, same shape
   the JSON uploader accepts), cbv, share the link. Slugs whose file doesn't
   exist fall through to the home page. The bench below is the ledger of the
   15 slots — update the comment when you fill one, purely for bookkeeping:

     1. atlas          (the 350-node sample — the reference demo)
     2. —
     3. —
     4. —
     5. —
     6. —
     7. —
     8. —
     9. —
    10. —
    11. —
    12. —
    13. —
    14. —
    15. —

   TITLES: the browser-tab title defaults to "<root node name> — Constella",
   derived from the JSON itself. Add an entry to TITLE_OVERRIDES only when a
   slug needs something different — this is the only reason to touch code.

   PUBLIC BY DESIGN: anything in public/showcase/ is world-readable to anyone
   holding (or guessing) the URL. Curate accordingly. */

export const TITLE_OVERRIDES: Record<string, string> = {
  atlas: "Atlas Knowledge Base — Constella",
};

/** The bench (/bench, dev only) shows this many slots. */
export const SLOT_COUNT = 15;
/* The slot ledger — MANAGED BY THE BENCH. "Save bench" rewrites the array
   below (dev middleware, see vite.config.ts), so the bench reopens exactly
   as saved. Hand-edit only to reorder or evict; keep it one line. */
export const SLOTS: string[] = ["atlas","sarvam","heavy","ddn"];

/** /v/<slug> → slug, or null for every other path. Slug charset is the
    guard: lowercase letters, digits, hyphens — nothing traversal-shaped. */
export function showcaseSlugFromPath(path: string): string | null {
  const m = /^\/v\/([a-z0-9][a-z0-9-]{0,63})\/?$/.exec(path);
  return m ? m[1] : null;
}

export function showcaseFileFor(slug: string): string {
  return `/showcase/${slug}.json`;
}

export function showcaseTitleFor(slug: string, rootName?: string): string {
  return TITLE_OVERRIDES[slug] ?? (rootName ? `${rootName} — Constella` : "Constella");
}

/** The bundled sample/demo slug — atlas is the 350-node reference demo. */
export const SAMPLE_SLUG = "atlas";

/** Is this the bundled sample file ("atlas.json")? The "Sample" badge keys off
    this — only the sample is tagged, not every curated /v/ showcase. */
export function isSampleFile(filename: string): boolean {
  return filename === `${SAMPLE_SLUG}.json`;
}
