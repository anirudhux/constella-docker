import type { GraphDocument, GraphNode } from "../../types/graph";

/* ===========================================================================
   Pure graph model — no THREE, no DOM. Extracted verbatim from hybridGraph's
   "model" section so the app renderer and the standalone export runtime can
   share one truth. Everything here is data-in → data-out.
   ========================================================================== */

/** Structural placeholders — positional, never a real identity. Never shown. */
const STRUCTURAL_TYPES = new Set([
  "root",
  "domain",
  "folder",
  "document",
  "item",
]);

const IMAGE_EXT = /\.(jpg|jpeg|png|gif|webp|svg|heic|bmp|avif)([?#].*)?$/i;

/** The image to show inside a node's tooltip, when the data provides one:
    an explicit `image` (or `cover`) in metadata — the manifest author's or
    agent's word — or the node's own url when it IS an image. Data-driven only:
    nothing is fetched or inferred beyond what the node already carries. */
export function mediaImageOf(n: GraphNode): string | null {
  const meta = (n.metadata ?? {}) as Record<string, unknown>;
  const explicit = meta.image ?? meta.cover;
  if (typeof explicit === "string" && explicit.trim()) return explicit.trim();
  if (n.url && (IMAGE_EXT.test(n.url) || n.url.startsWith("data:image/")))
    return n.url;
  // YouTube: the poster url is derivable from the video id — an ordinary <img>
  // load off img.youtube.com, no API, no fetch by us. The one place we go a
  // step beyond "only what the data says", because the mapping is mechanical.
  if (n.url) {
    const yt =
      /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{6,20})/.exec(
        n.url,
      );
    if (yt) return `https://img.youtube.com/vi/${yt[1]}/hqdefault.jpg`;
  }
  return null;
}

/** The type shown in a tooltip eyebrow — only when it's a real identity.
    The five STRUCTURAL words (root/domain/folder/document/item) are positional
    placeholders, not identities — suppressed whether fabricated or baked into
    the data. A real explicit type ("platform", "person") shows as the user's
    own word; otherwise inferred from the url (.jpg → Photo, youtube → Video);
    with neither, there's nothing true to say, so show nothing. */
export function typeLabelOf(n: GraphNode): string {
  const t = (n.type ?? "").trim().toLowerCase();
  if (t && !STRUCTURAL_TYPES.has(t)) return titleCase(n.type as string);
  if (n.url) return typeFromUrl(n.url);
  return "";
}

const VIDEO_EXT = /\.(mp4|webm|mov|m4v|ogv)([?#].*)?$/i;

const youTubeId = (url: string): string | null =>
  /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{6,20})/.exec(
    url,
  )?.[1] ?? null;

/** A playable rendering of a node's video, for surfaces that accept input
    (side panel / dialog — NOT the hover tooltip, which is pointer-events:none).
    "embed" is an iframe src (YouTube/Vimeo); "file" is a direct <video> src. */
export function videoOf(
  n: GraphNode,
): { kind: "embed" | "file"; src: string } | null {
  if (!n.url) return null;
  const yt = youTubeId(n.url);
  if (yt)
    return { kind: "embed", src: `https://www.youtube-nocookie.com/embed/${yt}` };
  const vimeo = /vimeo\.com\/(\d+)/.exec(n.url)?.[1];
  if (vimeo)
    return { kind: "embed", src: `https://player.vimeo.com/video/${vimeo}` };
  if (VIDEO_EXT.test(n.url)) return { kind: "file", src: n.url };
  return null;
}

/** Sentence-case a free-text type ("platform" → "Platform"). */
function titleCase(s: string): string {
  const t = s.trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : "";
}

/** Infer a real type from a node's url — extension first, then a few known
    hosts. A url with no recognised extension is just a Link. */
function typeFromUrl(url: string): string {
  const u = url.toLowerCase();
  const ext = u.split(/[?#]/)[0].split(".").pop() ?? "";
  if (/^(jpg|jpeg|png|gif|webp|svg|heic|bmp|avif)$/.test(ext)) return "Photo";
  if (/^(mp4|mov|webm|mkv|avi|m4v)$/.test(ext)) return "Video";
  if (/^(mp3|wav|flac|aac|ogg|m4a)$/.test(ext)) return "Audio";
  if (/^(ppt|pptx|key)$/.test(ext)) return "Presentation";
  if (ext === "pdf") return "PDF";
  if (/^(doc|docx|md|txt|rtf|pages)$/.test(ext)) return "Doc";
  if (/^(xls|xlsx|csv|tsv)$/.test(ext)) return "Spreadsheet";
  if (/(youtube\.com|youtu\.be|vimeo\.com)/.test(u)) return "Video";
  return "Link";
}

export interface ELink {
  s: string;
  t: string;
  ref: boolean;
}

export interface RefRow {
  from: string;
  to: string;
}

export interface FocusModel {
  full: Set<string>; // chain + immediate children — bright
  grand: Set<string>; // grandchildren — dim hint
  refTargets: Set<string>; // referenced (external) nodes — highlighted
  secondary: Set<string>; // grand ∪ refTargets (label eligibility)
  grandEdges: Set<string>; // child→grandchild hierarchy edges (edgeKey)
  refList: RefRow[]; // branch references for the legend (from → to)
}

export const edgeKey = (a: string, b: string) =>
  a < b ? `${a}|${b}` : `${b}|${a}`;

export interface GraphModel {
  byId: Map<string, GraphNode>;
  childrenOf: Map<string, GraphNode[]>;
  elinks: ELink[];
  degree: Map<string, number>;
  refNeighbors: Map<string, GraphNode[]>;
  groupOrder: string[];
  rootId: string | null;
  parentChain(n: GraphNode): GraphNode[];
  depthOf(n: GraphNode): number;
  groupOf(n: GraphNode): string | null;
  pathOf(n: GraphNode): string;
  typeLabel(n: GraphNode): string;
  isTrunk(l: ELink): boolean;
  focusChainSet(id: string): Set<string>;
  focusEdgeSet(id: string): Set<string>;
  grandchildrenIds(id: string): Set<string>;
  computeFocus(id: string): FocusModel;
}

export function buildGraphModel(data: GraphDocument): GraphModel {
  const byId = new Map<string, GraphNode>(data.nodes.map((n) => [n.id, n]));
  const childrenOf = new Map<string, GraphNode[]>(
    data.nodes.map((n) => [n.id, []]),
  );
  for (const n of data.nodes) {
    if (n.parent && childrenOf.has(n.parent)) childrenOf.get(n.parent)!.push(n);
  }
  const parentChain = (n: GraphNode): GraphNode[] => {
    const chain: GraphNode[] = [];
    let cur: GraphNode | undefined = n;
    const guard = new Set<string>();
    while (cur && !guard.has(cur.id)) {
      guard.add(cur.id);
      chain.push(cur);
      cur = cur.parent ? byId.get(cur.parent) : undefined;
    }
    return chain;
  };
  const depthOf = (n: GraphNode) => parentChain(n).length - 1;
  const groupOf = (n: GraphNode): string | null => {
    const c = parentChain(n);
    return c.length <= 1 ? null : c[c.length - 2].id;
  };

  const elinks: ELink[] = data.links.map((l) => ({
    s: l.source,
    t: l.target,
    ref: l.kind === "reference",
  }));
  const degree = new Map<string, number>();
  for (const l of elinks) {
    degree.set(l.s, (degree.get(l.s) ?? 0) + 1);
    degree.set(l.t, (degree.get(l.t) ?? 0) + 1);
  }
  // Cross-reference neighbours per node (the "related" nodes), for the tooltip.
  const refNeighbors = new Map<string, GraphNode[]>();
  for (const l of data.links) {
    if (l.kind !== "reference") continue;
    const s = byId.get(l.source);
    const t = byId.get(l.target);
    if (!s || !t) continue;
    (refNeighbors.get(s.id) ?? refNeighbors.set(s.id, []).get(s.id)!).push(t);
    (refNeighbors.get(t.id) ?? refNeighbors.set(t.id, []).get(t.id)!).push(s);
  }
  // Selecting a node shows the whole line from root down to the node, plus the
  // node's immediate children (one layer). Used for click/tap focus.
  const focusChainSet = (id: string) => {
    const s = new Set<string>();
    const node = byId.get(id);
    if (!node) return s;
    for (const a of parentChain(node)) s.add(a.id); // node → … → root
    for (const child of childrenOf.get(id) ?? []) s.add(child.id);
    return s;
  };
  // The contains-link chain root→node, plus node→each child.
  const focusEdgeSet = (id: string) => {
    const e = new Set<string>();
    const node = byId.get(id);
    if (!node) return e;
    const chain = parentChain(node); // node, parent, …, root
    for (let i = 0; i < chain.length - 1; i++)
      e.add(edgeKey(chain[i].id, chain[i + 1].id));
    for (const child of childrenOf.get(id) ?? []) e.add(edgeKey(id, child.id));
    return e;
  };
  // Grandchildren of a node (children of its immediate children).
  const grandchildrenIds = (id: string) => {
    const g = new Set<string>();
    for (const c of childrenOf.get(id) ?? [])
      for (const gc of childrenOf.get(c.id) ?? []) g.add(gc.id);
    return g;
  };
  // Everything a selection reveals beyond the bright root→node→children path:
  // the grandchild layer (one deeper, dimmer) and the dependency (reference)
  // links of the selected node and the descendants it shows.
  function computeFocus(id: string): FocusModel {
    const full = focusChainSet(id); // chain + immediate children
    const grand = grandchildrenIds(id);
    const grandEdges = new Set<string>();
    for (const c of childrenOf.get(id) ?? [])
      for (const gc of childrenOf.get(c.id) ?? [])
        grandEdges.add(edgeKey(c.id, gc.id));
    // Reference scope = the whole branch: selected node + children + grandchildren.
    // References are surfaced by highlighting the referenced node + a legend row,
    // not connector lines — so grandchildren can be included without clutter.
    const scope = new Set<string>([id]);
    for (const c of childrenOf.get(id) ?? []) scope.add(c.id);
    for (const g of grand) scope.add(g);
    const refTargets = new Set<string>();
    const refList: RefRow[] = [];
    const seen = new Set<string>();
    for (const l of elinks) {
      if (!l.ref) continue;
      const sIn = scope.has(l.s);
      const tIn = scope.has(l.t);
      if (!sIn && !tIn) continue;
      const from = sIn ? l.s : l.t; // the in-branch endpoint
      const to = sIn ? l.t : l.s;
      const k = from + "|" + to;
      if (seen.has(k)) continue;
      seen.add(k);
      refList.push({ from, to });
      if (!full.has(to) && !grand.has(to)) refTargets.add(to);
    }
    const secondary = new Set<string>([...grand, ...refTargets]);
    return { full, grand, refTargets, secondary, grandEdges, refList };
  }

  // group ordering for palette assignment
  const groupOrder: string[] = [];
  for (const n of data.nodes) {
    const g = groupOf(n);
    if (g && !groupOrder.includes(g)) groupOrder.push(g);
  }

  const rootId =
    data.nodes.find((n) => depthOf(n) === 0)?.id ?? data.nodes[0]?.id ?? null;
  const isTrunk = (l: ELink) => !!rootId && (l.s === rootId || l.t === rootId);
  const typeLabel = typeLabelOf;
  const pathOf = (n: GraphNode) =>
    parentChain(n)
      .reverse()
      .map((x) => x.name)
      .join("  ›  ");

  return {
    byId,
    childrenOf,
    elinks,
    degree,
    refNeighbors,
    groupOrder,
    rootId,
    parentChain,
    depthOf,
    groupOf,
    pathOf,
    typeLabel,
    isTrunk,
    focusChainSet,
    focusEdgeSet,
    grandchildrenIds,
    computeFocus,
  };
}
