import type { GraphDocument } from "../types/graph";

/* Shared "Branch References" legend — the same left-side sidebar the hybrid
   graph renders on selection, reused by the D3 views (Sunburst). Same
   DOM structure and .hg-legend classes, so app.css styles it identically.

   Scope semantics match hybridGraph: the selected branch = node + children +
   grandchildren; a reference row is shown when either endpoint is in scope,
   listed as (in-branch endpoint → other endpoint). */

export interface BranchLegend {
  /** Show refs for this node's branch; null hides the legend. */
  update(focusId: string | null): void;
  destroy(): void;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function createBranchLegend(
  container: HTMLElement,
  doc: GraphDocument,
): BranchLegend {
  const nameOf = new Map(doc.nodes.map((n) => [n.id, n.name]));
  const childrenOf = new Map<string, string[]>();
  for (const n of doc.nodes) {
    if (!n.parent) continue;
    const kids = childrenOf.get(n.parent);
    if (kids) kids.push(n.id);
    else childrenOf.set(n.parent, [n.id]);
  }
  const refs = doc.links.filter((l) => l.kind === "reference");

  const legendEl = document.createElement("div");
  legendEl.className = "hg-legend";
  legendEl.style.display = "none";
  container.appendChild(legendEl);

  function update(focusId: string | null): void {
    if (!focusId) {
      legendEl.style.display = "none";
      legendEl.innerHTML = "";
      return;
    }
    const scope = new Set<string>([focusId]);
    for (const c of childrenOf.get(focusId) ?? []) {
      scope.add(c);
      for (const gc of childrenOf.get(c) ?? []) scope.add(gc);
    }
    const seen = new Set<string>();
    const rows: string[] = [];
    for (const l of refs) {
      const sIn = scope.has(l.source);
      const tIn = scope.has(l.target);
      if (!sIn && !tIn) continue;
      const from = sIn ? l.source : l.target; // the in-branch endpoint
      const to = sIn ? l.target : l.source;
      const k = from + "|" + to;
      if (seen.has(k)) continue;
      seen.add(k);
      rows.push(
        `<li class="hg-legend__row"><span class="hg-legend__from">${escapeHtml(
          nameOf.get(from) ?? from,
        )}</span><span class="hg-legend__arrow">→</span><span class="hg-legend__to">${escapeHtml(
          nameOf.get(to) ?? to,
        )}</span></li>`,
      );
    }
    if (!rows.length) {
      legendEl.style.display = "none";
      legendEl.innerHTML = "";
      return;
    }
    legendEl.innerHTML = `<div class="hg-legend__title">Branch References</div><ul class="hg-legend__list">${rows.join("")}</ul>`;
    legendEl.style.display = "block";
  }

  return {
    update,
    destroy: () => legendEl.remove(),
  };
}
