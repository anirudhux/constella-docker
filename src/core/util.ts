/** Lowercase, machine-safe slug (doc 01 §7). */
export function slugify(input: string): string {
  const s = input
    .toLowerCase()
    .trim()
    .replace(/['"`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || "node";
}

/**
 * Deterministic id generator. Identical slugs collide → suffixed -2, -3, …
 * (doc 01 §7). Callers dedupe *intended* repeats themselves (e.g. via a
 * path→id map) before minting a new id.
 */
export function createIdFactory() {
  const counts = new Map<string, number>();
  return function newId(raw: string): string {
    const base = slugify(raw);
    const seen = counts.get(base);
    if (seen === undefined) {
      counts.set(base, 1);
      return base;
    }
    counts.set(base, seen + 1);
    return `${base}-${seen + 1}`;
  };
}
