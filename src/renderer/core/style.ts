/* ===========================================================================
   Pure style scalars — colour assignment and size/opacity tiers shared by the
   app renderer and the standalone export runtime. No THREE, no DOM.
   ========================================================================== */

/** Group→palette colour; depth 0 is always the theme accent. */
export function groupColor(
  group: string | null,
  depth: number,
  groupOrder: string[],
  palette: string[],
  accent: string,
): string {
  if (depth === 0) return accent;
  const p = palette.length ? palette : ["#888"];
  if (group) {
    const i = groupOrder.indexOf(group);
    if (i >= 0) return p[i % p.length];
  }
  return p[Math.min(Math.max(depth - 1, 0), p.length - 1)];
}

/* Strong, legible depth tiers so the hierarchy reads at a glance: the root is
   the clear anchor, branches are prominent, leaves recede. */
export function nodeRadius(
  depth: number,
  hasChildren: boolean,
  degree: number,
  placeholder = false,
): number {
  if (placeholder) return 1.2;
  const base =
    depth === 0 ? 13 : depth === 1 ? 7.5 : depth === 2 ? 4.6 : hasChildren ? 3.6 : 3;
  return base + Math.min(degree, 8) * 0.18;
}

/** Default (un-focused) "hero" state: deeper nodes fade to ambient context. */
export const baseNodeOpacity = (depth: number) =>
  depth <= 1 ? 1 : depth === 2 ? 0.9 : depth === 3 ? 0.78 : 0.66;
