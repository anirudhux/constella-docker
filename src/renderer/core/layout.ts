import type { GraphNode } from "../../types/graph";

/* ===========================================================================
   Deterministic polar layout with semantic Z — pure math, no THREE, no DOM.
   Extracted verbatim from hybridGraph's layout() so the app renderer and the
   standalone export runtime place nodes identically.
   ========================================================================== */

export interface PlacedNode {
  angle: number;
  r: number;
  x: number;
  y: number;
  z: number;
}

const RADII = [0, 145, 278, 395, 500, 610];
const Z_STEP = -34;

/* Survivors of the envelope bake-off (ellipse, superellipse, hexagon,
   cardioid, lemniscate, and the radial-ease experiment were prototyped and
   culled): circle is the default; twinhub is a structural two-lobe layout
   (the Infinity shape), not an r(θ) envelope — the lemniscate multiplier it
   replaced squashed whichever branches happened to sit at ±90°, which read
   as broken rather than deliberate on real data. */
export type EnvelopeKind = "circle" | "twinhub";

/* The user-facing shape picker (graph view): three named presets over
   LayoutOpts. Lives in core so the app renderer and the export runtime map a
   shape to identical layout options — a shared spiral exports as a spiral. */
export type GraphShape = "circle" | "spiral" | "infinity";

export function shapeLayoutOpts(shape: GraphShape): LayoutOpts {
  switch (shape) {
    case "spiral":
      // The full galaxy recipe: arm twist + ring scatter (star dust is a
      // renderer concern — see shapeHasDust — not a layout one).
      return { spiralTwist: 0.35, radiusScatter: 0.12 };
    case "infinity":
      return { envelope: "twinhub" };
    default:
      return {};
  }
}

/** Spiral ships with the background star-dust layer; both renderers ask here
    so the app view and the export can't disagree. */
export const shapeHasDust = (shape: GraphShape): boolean => shape === "spiral";

export interface LayoutOpts {
  envelope?: EnvelopeKind; // default "circle"
  /** Radians of angular drift per depth level. Branches sweep into spiral
      arms instead of pointing straight out — the galaxy look. 0 = off. */
  /** All sibling wedges equal, ignoring subtree size. Used only as the START
      frame of the settle-in intro — the graph mounts evenly spaced and eases
      into the √size-weighted truth. Never the resting state. */
  uniformArcs?: boolean;
  spiralTwist?: number;
  /** Fractional radius jitter (e.g. 0.12 = ±12%), deterministic per node.
      Dissolves the crisp concentric rings into a star-field falloff. 0 = off. */
  radiusScatter?: number;
}

/* PARKED (2026-08): the Infinity shape is off the nav — three layouts were
   tried (r(θ) squash, twin hubs, this path version) and none earned the
   button on real data. The code below stays compiled and reachable via
   shapeLayoutOpts("infinity") so old exports keep rendering and revival is
   a one-line nav change in Output.tsx.

   Infinity as a PATH, not two centers: branch heads sit ON a lemniscate of
   Bernoulli — beads on a wire — and each subtree fans outward along the
   curve's normal. Nothing converges anywhere except the origin, where the
   curve genuinely self-intersects and the actual root lives. (The earlier
   hub-centred version made lobes read as two extra parents: radial
   convergence manufactures a parent wherever its center is.) */
const INF_A = 640; // lemniscate half-width — max |x| of the wire
const INF_FAN = 0.6; // subtree ring scale, measured outward from the wire
/* Trim each loop's usable arc at both crossing approaches so no branch head
   (or its fan) sits on top of the root. */
const INF_MARGIN = 0.08;
const INF_SAMPLES = 256;

/** The Infinity wire itself, for renderers to draw as a faint guide: the
    beads genuinely sit on this curve, so stroking it is decor that tells the
    truth. Returns a closed polyline over the full figure eight. */
export function infinityWire(samples = 160): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = -Math.PI / 2 + (Math.PI * 2 * i) / samples;
    const s = Math.sin(t);
    const den = 1 + s * s;
    pts.push({ x: (INF_A * Math.cos(t)) / den, y: (INF_A * s * Math.cos(t)) / den });
  }
  return pts;
}

/** Stable per-node angular jitter so sibling fans don't look machine-regular. */
const jitterOf = (id: string) =>
  ((id.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 17) - 8) * 0.004;

export function computePolarLayout(
  nodes: GraphNode[],
  depthOf: (n: GraphNode) => number,
  childrenOf: Map<string, GraphNode[]>,
  opts: LayoutOpts = {},
): Map<string, PlacedNode> {
  const envelope = opts.envelope ?? "circle";

  const placed = new Map<string, PlacedNode>();
  const depths = new Map(nodes.map((n) => [n.id, depthOf(n)]));
  for (const n of nodes) {
    const d = depths.get(n.id)!;
    placed.set(n.id, {
      angle: 0,
      r: RADII[Math.min(d, RADII.length - 1)] ?? 130 + d * 100,
      x: 0,
      y: 0,
      z: 0,
    });
  }

  // Subtree sizes for weighted arcs — memoized so the walk stays O(n).
  const sizeMemo = new Map<string, number>();
  const sizeOf = (n: GraphNode): number => {
    const hit = sizeMemo.get(n.id);
    if (hit !== undefined) return hit;
    const total =
      1 + (childrenOf.get(n.id) ?? []).reduce((a, k) => a + sizeOf(k), 0);
    sizeMemo.set(n.id, total);
    return total;
  };

  const placeSubtree = (
    node: GraphNode,
    angle: number,
    wedge: number,
    depth: number,
  ) => {
    const p = placed.get(node.id)!;
    p.angle = angle;
    p.r = RADII[Math.min(depth, RADII.length - 1)] ?? 140 + depth * 110;
    const kids = childrenOf.get(node.id) ?? [];
    if (!kids.length) return;
    const childWedge = Math.min(wedge * 0.82, Math.PI * 0.82);
    // Wedge width ∝ √(subtree size): big branches still read big, but the
    // ratio is compressed — linear weighting gave a 14-node branch 14× a
    // 1-node sibling's angle, bunching small spokes into slivers on lopsided
    // data. (The sunburst stays linear, correctly: it encodes area; spokes
    // encode placement.) The 15%-of-mean floor still guards clickability;
    // the recursion wedge is the child's own slice.
    const meanSize = kids.reduce((a, k) => a + sizeOf(k), 0) / kids.length;
    const weights = kids.map((k) => opts.uniformArcs ? 1 : Math.sqrt(Math.max(sizeOf(k), 0.15 * meanSize)));
    const total = weights.reduce((a, w) => a + w, 0);
    let cum = 0;
    kids.forEach((kid, i) => {
      const w = weights[i];
      const frac = (cum + w / 2) / total;
      cum += w;
      const local = kids.length === 1 ? 0 : (frac - 0.5) * childWedge;
      placeSubtree(
        kid,
        angle + local + jitterOf(kid.id),
        (childWedge * w) / total,
        depth + 1,
      );
    });
  };

  // Infinity anchors, filled only for that shape: each top-level branch gets
  // a point ON the lemniscate wire; every descendant maps to its branch so
  // the cartesian pass can offset the whole subtree from that anchor.
  const infAnchor = new Map<string, { x: number; y: number }>();
  const infHeadOf = new Map<string, string>();

  const roots = nodes.filter((n) => depths.get(n.id) === 0);
  if (roots.length <= 1) {
    const root = roots[0] ?? nodes[0];
    if (root) {
      const rp = placed.get(root.id)!;
      rp.angle = 0;
      rp.r = 0;
    }
    const first = root
      ? childrenOf.get(root.id) ?? []
      : nodes.filter((n) => depths.get(n.id) === 1);
    const ringStart = -Math.PI / 2;
    if (envelope === "twinhub" && first.length >= 2) {
      // Infinity = beads on a wire. Branches partition into two size-balanced
      // families (greedy over size-descending order, deterministic); each
      // family strings its branch heads along one loop of the lemniscate,
      // claiming arc length ∝ subtree size, and each subtree fans outward
      // along the curve's normal at its bead. No hubs, no radial convergence
      // anywhere except the origin — where the curve genuinely crosses and
      // the actual root sits.
      const sorted = [...first].sort((a, b) => sizeOf(b) - sizeOf(a));
      const sideOf = new Map<string, 1 | -1>();
      let loadL = 0;
      let loadR = 0;
      for (const b of sorted) {
        if (loadL <= loadR) {
          sideOf.set(b.id, -1);
          loadL += sizeOf(b);
        } else {
          sideOf.set(b.id, 1);
          loadR += sizeOf(b);
        }
      }
      const inherit = (n: GraphNode, headId: string) => {
        infHeadOf.set(n.id, headId);
        for (const k of childrenOf.get(n.id) ?? []) inherit(k, headId);
      };

      for (const side of [-1, 1] as const) {
        const group = sorted.filter((b) => sideOf.get(b.id) === side);
        if (!group.length) continue;
        // One loop of the Bernoulli lemniscate, sampled for an arc-length
        // table. Right loop: t ∈ (−π/2, π/2); left: (π/2, 3π/2). Both start
        // and end at the origin crossing.
        const t0 = side < 0 ? Math.PI / 2 : -Math.PI / 2;
        const t1 = t0 + Math.PI;
        const px: number[] = [];
        const py: number[] = [];
        const cum: number[] = [0];
        for (let i = 0; i <= INF_SAMPLES; i++) {
          const t = t0 + ((t1 - t0) * i) / INF_SAMPLES;
          const s = Math.sin(t);
          const den = 1 + s * s;
          px.push((INF_A * Math.cos(t)) / den);
          py.push((INF_A * s * Math.cos(t)) / den);
          if (i > 0)
            cum.push(cum[i - 1] + Math.hypot(px[i] - px[i - 1], py[i] - py[i - 1]));
        }
        const L = cum[INF_SAMPLES];
        const meanSize = group.reduce((a, k) => a + sizeOf(k), 0) / group.length;
        const weights = group.map((k) => opts.uniformArcs ? 1 : Math.sqrt(Math.max(sizeOf(k), 0.15 * meanSize)));
        const total = weights.reduce((a, w) => a + w, 0);
        let acc = 0;
        group.forEach((b, gi) => {
          const w = weights[gi];
          // Bead position: centre of this branch's stretch of usable wire.
          const frac = INF_MARGIN + (1 - 2 * INF_MARGIN) * ((acc + w / 2) / total);
          acc += w;
          const target = frac * L;
          let idx = 1;
          while (idx < INF_SAMPLES && cum[idx] < target) idx++;
          const bead = { x: px[idx], y: py[idx] };
          // Outward normal: perpendicular to the wire, signed away from the
          // origin so fans grow off the outside of the loop.
          const tx = px[idx] - px[idx - 1];
          const ty = py[idx] - py[idx - 1];
          const tl = Math.hypot(tx, ty) || 1;
          let nx = -ty / tl;
          let ny = tx / tl;
          if (nx * bead.x + ny * bead.y < 0) {
            nx = -nx;
            ny = -ny;
          }
          const normalAngle = Math.atan2(ny, nx);
          // Fan wedge ∝ claimed wire length, capped so deep fans stay tidy.
          const wedge = Math.min(
            Math.PI * 0.72,
            Math.max(0.55, ((w / total) * (1 - 2 * INF_MARGIN) * L) / (RADII[2] ?? 278)),
          );
          placeSubtree(b, normalAngle + jitterOf(b.id), wedge, 1);
          infAnchor.set(b.id, bead);
          inherit(b, b.id);
        });
      }
    } else if (first.length) {
      // First ring: sector width proportional to subtree size, same 15% floor.
      const meanSize = first.reduce((a, k) => a + sizeOf(k), 0) / first.length;
      const weights = first.map((k) => opts.uniformArcs ? 1 : Math.sqrt(Math.max(sizeOf(k), 0.15 * meanSize)));
      const total = weights.reduce((a, w) => a + w, 0);
      let cum = 0;
      first.forEach((domain, i) => {
        const w = weights[i];
        const sector = (Math.PI * 2 * w) / total;
        const start = ringStart + (Math.PI * 2 * (cum + w / 2)) / total;
        cum += w;
        placeSubtree(domain, start, sector * 0.78, 1);
      });
    }
  } else {
    // Multiple roots: each gets its own sector (∝ subtree size, same 15%
    // floor as everywhere else), pushed to ring 1, subtrees start at ring 2.
    // Twin-hub deliberately isn't applied here — multi-root manifests are
    // rare and the circle handles them; Infinity falls back to it.
    const ringStart = -Math.PI / 2;
    const meanSize = roots.reduce((a, r) => a + sizeOf(r), 0) / roots.length;
    const rWeights = roots.map((r) => opts.uniformArcs ? 1 : Math.sqrt(Math.max(sizeOf(r), 0.15 * meanSize)));
    const rTotal = rWeights.reduce((a, w) => a + w, 0);
    let rCum = 0;
    roots.forEach((rn, i) => {
      const rw = rWeights[i];
      const sector = (Math.PI * 2 * rw) / rTotal;
      const angle = ringStart + (Math.PI * 2 * (rCum + rw / 2)) / rTotal;
      rCum += rw;
      const rp = placed.get(rn.id)!;
      rp.angle = angle;
      rp.r = RADII[1] ?? 145;
      const kids = childrenOf.get(rn.id) ?? [];
      if (!kids.length) return;
      const sectorWedge = sector * 0.78;
      const kMean = kids.reduce((a, k) => a + sizeOf(k), 0) / kids.length;
      const kWeights = kids.map((k) => Math.max(sizeOf(k), 0.15 * kMean));
      const kTotal = kWeights.reduce((a, w) => a + w, 0);
      let kCum = 0;
      kids.forEach((kid, j) => {
        const kw = kWeights[j];
        const frac = (kCum + kw / 2) / kTotal;
        kCum += kw;
        const local = kids.length === 1 ? 0 : (frac - 0.5) * sectorWedge;
        placeSubtree(
          kid,
          angle + local + jitterOf(kid.id),
          (sectorWedge * kw) / kTotal,
          2,
        );
      });
    });
  }

  // Spiral twist and radius scatter perturb only this pass: p.angle/p.r keep
  // clean ring semantics downstream. The scatter hash differs from jitterOf's
  // so the two don't correlate per node.
  const twist = opts.spiralTwist ?? 0;
  const scatter = opts.radiusScatter ?? 0;
  const scatterOf = (id: string) => {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 997;
    return (h / 997 - 0.5) * 2; // [-1, 1]
  };

  // Infinity cartesian frame: every node offsets from its branch's bead on
  // the wire, along the fan direction, by how far past ring 1 its depth sits.
  // The bead itself (depth 1, r = RADII[1]) lands exactly on the wire.
  const ring1 = RADII[1] ?? 145;

  for (const n of nodes) {
    const p = placed.get(n.id)!;
    const d = depths.get(n.id)!;
    if (infAnchor.size && d === 0) {
      p.x = 0;
      p.y = 0;
      p.z = 0;
      continue;
    }
    const anchor = infAnchor.get(infHeadOf.get(n.id) ?? "");
    if (anchor) {
      const rLocal = (p.r - ring1) * INF_FAN;
      p.x = anchor.x + Math.cos(p.angle) * rLocal;
      p.y = anchor.y + Math.sin(p.angle) * rLocal;
      p.z = d * Z_STEP;
      continue;
    }
    const a = p.angle + twist * d;
    const r = p.r * (scatter && d > 0 ? 1 + scatter * scatterOf(n.id) : 1);
    p.x = Math.cos(a) * r;
    p.y = Math.sin(a) * r;
    p.z = d * Z_STEP;
  }

  // fan out deep leaves a touch
  const leafGroups = new Map<string, GraphNode[]>();
  for (const n of nodes) {
    if (depths.get(n.id)! >= 3) {
      const key = n.parent ?? "";
      (leafGroups.get(key) ?? leafGroups.set(key, []).get(key)!).push(n);
    }
  }
  leafGroups.forEach((group) => {
    group.forEach((n, i) => {
      const p = placed.get(n.id)!;
      // Fans scale with the wire frame under Infinity — an unscaled 18px
      // spread at 0.6× ring spacing is oversize and collides with siblings.
      const unit = infHeadOf.has(n.id) ? 18 * INF_FAN : 18;
      const spread = (i - (group.length - 1) / 2) * unit;
      p.x += Math.cos(p.angle + Math.PI / 2) * spread;
      p.y += Math.sin(p.angle + Math.PI / 2) * spread;
    });
  });

  return placed;
}
