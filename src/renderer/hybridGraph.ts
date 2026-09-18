import * as THREE from "three";
import type { GraphDocument, GraphNode } from "../types/graph";
import {
  buildGraphModel,
  edgeKey,
  mediaImageOf,
  type ELink,
  type FocusModel,
} from "./core/model";
import { baseNodeOpacity, groupColor, nodeRadius } from "./core/style";
import {
  computePolarLayout,
  infinityWire,
  shapeHasDust,
  shapeLayoutOpts,
} from "./core/layout";
import type { GraphShape, LayoutOpts } from "./core/layout";

/* ===========================================================================
   Hybrid hierarchy graph renderer (extracted & generalized from the Atlas
   prototype). 2D-first with ambient depth; flattens on interaction; click to
   focus. Framework-agnostic: mount into any element, drive via the handle.
   ========================================================================== */

export interface GraphTheme {
  bg: string;
  surface: string;
  text: string;
  muted: string;
  border: string;
  link: string;
  accent: string;
  referenceLink: string;
}

export type MotionMode = "off" | "subtle" | "presentation";
export type LabelMode = "smart" | "parents" | "all" | "none";
export type NodeStyle = "flat" | "glow";
export type ClickAction = "tooltip" | "panel" | "modal" | "url" | "none";

export interface HybridGraphConfig {
  // Layout shape variant (circle | spiral | infinity). Applied at mount only —
  // positions are static per mount by design, so a change means a remount
  // (GraphCanvas keys on it). Defaults to "circle".
  shape?: GraphShape;
  motion: MotionMode;
  motionSpeed: number;
  flattenOnInteraction: boolean;
  labelMode: LabelMode;
  labelSize: number;
  // Shaded backing behind label text (theme-aware) for readability over busy
  // links/nodes. Toggled from Settings → Label background.
  labelBackground: boolean;
  nodeStyle: NodeStyle;
  clickAction: ClickAction;
  palette: string[];
  theme: GraphTheme;
  reducedMotion: boolean;
  // Called with the node on select, and with `null` when a click deselects
  // (empty space, or clicking the focused node again) so an external panel can
  // close in step with the graph.
  onNodeClick?: (node: GraphNode | null) => void;
  // Fired when shape mode ("All nodes") dissolves because the user clicked a
  // node — so the owning UI can flip its toggle chip off in step.
  onShapeExit?: () => void;
  onRefsExit?: () => void;
}

export interface HybridGraphHandle {
  update(patch: Partial<HybridGraphConfig>): void;
  reset(): void;
  focus(id: string): void;
  /** "All nodes" shape mode: every node lit, all links drawn, no labels. */
  setShapeMode(on: boolean): void;
  setRefsMode(on: boolean): void;
  snapshotPng(opts?: { mark?: boolean }): string | null;
  destroy(): void;
}

interface NodeView {
  node: GraphNode;
  depth: number;
  group: string | null;
  hasChildren: boolean;
  degree: number;
  angle: number;
  r: number;
  baseX: number;
  baseY: number;
  baseZ: number;
  /** Settle-in intro endpoints: equal-spaced start → weighted target. */
  introSX: number;
  introSY: number;
  introTX: number;
  introTY: number;
  x: number;
  y: number;
  z: number;
  sprite: THREE.Sprite;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export function mountHybridGraph(
  container: HTMLElement,
  data: GraphDocument,
  initial: HybridGraphConfig,
): HybridGraphHandle {
  const cfg: HybridGraphConfig = { ...initial };

  // Touch devices (phones + tablets/iPad) get a static, flat, pannable map with
  // pinch-to-zoom and tap-to-focus — no ambient motion, no hover, no tooltip.
  // `?touch=1` forces it on for testing on a non-touch machine.
  const touchMode =
    typeof window !== "undefined" &&
    ((window.matchMedia?.("(pointer: coarse)").matches ?? false) ||
      new URLSearchParams(window.location.search).has("touch"));

  // Shape variant is a config concern (user-facing segmented control), not a
  // URL seam. The shape→LayoutOpts mapping lives in core/layout so the app and
  // the export runtime can never disagree about what a shape means.
  const shape: GraphShape = cfg.shape ?? "circle";
  const layoutOpts: LayoutOpts = shapeLayoutOpts(shape);

  // ---- DOM scaffold inside the container ----
  container.classList.add("hg-root");
  const sceneEl = document.createElement("div");
  sceneEl.className = "hg-scene";
  const labelsEl = document.createElement("div");
  labelsEl.className = "hg-labels";
  // Optional shaded backing behind labels — the CSS hangs off this modifier.
  labelsEl.classList.toggle("hg-labels--boxed", !!cfg.labelBackground);
  const tooltipEl = document.createElement("div");
  tooltipEl.className = "hg-tooltip";
  // "Branch References" legend (left side) — lists the selected branch's
  // cross-references as text so referenced nodes need no connector lines.
  const legendEl = document.createElement("div");
  legendEl.className = "hg-legend";
  legendEl.style.display = "none";
  container.append(sceneEl, labelsEl, tooltipEl, legendEl);

  // ---- model (pure — shared with the standalone runtime via core/) ----
  const model = buildGraphModel(data);
  const {
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
    isTrunk,
    focusChainSet,
    focusEdgeSet,
    computeFocus,
  } = model;

  let focusModel: FocusModel | null = null;
  // What the highlight/labels keep visible: the full path root→node→children
  // when a node is selected (selection is the only state — see the matrix).
  const currentKeep = () =>
    state.focusId ? focusChainSet(state.focusId) : null;

  const colorOf = (v: NodeView) =>
    groupColor(v.group, v.depth, groupOrder, cfg.palette, cfg.theme.accent);
  const radiusOf = (v: NodeView) =>
    nodeRadius(v.depth, v.hasChildren, v.degree, !!v.node.metadata?.placeholder);

  // ---- three.js scene ----
  let W = container.clientWidth || 800;
  let H = container.clientHeight || 600;
  // Small viewports (embeds, mobile) get tighter framing, more visible lines,
  // and a less dominant root label. Desktop is unchanged (SMALL stays false).
  const SMALL = touchMode || W < 760;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(W, H);
  sceneEl.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-W / 2, W / 2, H / 2, -H / 2, 0.1, 4000);
  camera.position.set(0, 0, 1000);
  const graphGroup = new THREE.Group();
  scene.add(graphGroup);

  // ---- circle textures ----
  let textureCache = new Map<string, THREE.CanvasTexture>();
  function makeCircleTexture(color: string, glow: boolean): THREE.CanvasTexture {
    const s = 96;
    const c = document.createElement("canvas");
    c.width = c.height = s;
    const ctx = c.getContext("2d")!;
    const cx = s / 2;
    const cy = s / 2;
    if (glow) {
      const g = ctx.createRadialGradient(cx, cy, 8, cx, cy, 46);
      g.addColorStop(0, color);
      g.addColorStop(0.55, color);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, 45, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy, glow ? 25 : 32, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = glow ? 2 : 4;
    ctx.strokeStyle = cfg.theme.bg;
    ctx.stroke();
    const tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;
    return tex;
  }
  const textureFor = (color: string) => {
    const key = `${color}|${cfg.nodeStyle}`;
    if (!textureCache.has(key))
      textureCache.set(key, makeCircleTexture(color, cfg.nodeStyle === "glow"));
    return textureCache.get(key)!;
  };

  // ---- node views + sprites ----
  const views: NodeView[] = [];
  const viewById = new Map<string, NodeView>();
  for (const n of data.nodes) {
    const mat = new THREE.SpriteMaterial({
      map: textureFor("#888"),
      transparent: true,
      depthTest: true,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(mat);
    const v: NodeView = {
      node: n,
      depth: depthOf(n),
      group: groupOf(n),
      hasChildren: (childrenOf.get(n.id) ?? []).length > 0,
      degree: degree.get(n.id) ?? 0,
      angle: 0,
      r: 0,
      baseX: 0,
      baseY: 0,
      baseZ: 0,
      introSX: 0,
      introSY: 0,
      introTX: 0,
      introTY: 0,
      x: 0,
      y: 0,
      z: 0,
      sprite,
    };
    sprite.userData.id = n.id;
    views.push(v);
    viewById.set(n.id, v);
    graphGroup.add(sprite);
  }

  // ---- links ----
  const linkObjs: THREE.Line[] = [];
  for (const l of elinks) {
    const mat = new THREE.LineBasicMaterial({
      color: new THREE.Color(l.ref ? cfg.theme.referenceLink : cfg.theme.link),
      transparent: true,
      opacity: l.ref ? 0.48 : 0.58,
      depthTest: true,
      depthWrite: false,
    });
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(),
      new THREE.Vector3(),
    ]);
    const line = new THREE.Line(geo, mat);
    line.userData.link = l;
    linkObjs.push(line);
    graphGroup.add(line);
  }

  // ---- layout (deterministic polar with semantic Z — pure math in core/) ----
  function layout() {
    const placed = computePolarLayout(data.nodes, depthOf, childrenOf, layoutOpts);
    // Settle-in intro start frame: the same layout with every wedge equal.
    // The graph mounts evenly spaced and eases into the weighted truth — a
    // static unequal wheel reads as a bug; one you watched settle reads as
    // data. Reduced-motion users get the final state immediately.
    const start = computePolarLayout(data.nodes, depthOf, childrenOf, {
      ...layoutOpts,
      uniformArcs: true,
    });
    for (const v of views) {
      const p = placed.get(v.node.id)!;
      const s = start.get(v.node.id)!;
      v.angle = p.angle;
      v.r = p.r;
      v.baseX = p.x;
      v.baseY = p.y;
      v.baseZ = p.z;
      v.introSX = s.x;
      v.introSY = s.y;
      v.introTX = p.x;
      v.introTY = p.y;
    }
  }
  layout();
  // Node positions and the thin background-link geometry are STATIC after layout
  // (this is a 2D graph that never re-lays-out for a given mount), so write them
  // once here. The render loop used to reset every sprite position and rebuild
  // every link buffer on each frame — O(nodes+links) of pure waste plus a GPU
  // re-upload — which was the dominant cost on large graphs.
  function placeStatic() {
    for (const v of views) {
      v.x = v.baseX;
      v.y = v.baseY;
      v.z = 0;
      v.sprite.position.set(v.baseX, v.baseY, 0);
    }
    for (const line of linkObjs) {
      const l = line.userData.link as ELink;
      const s = viewById.get(l.s)!;
      const t = viewById.get(l.t)!;
      const attr = line.geometry.attributes.position as THREE.BufferAttribute;
      const arr = attr.array as Float32Array;
      arr[0] = s.baseX; arr[1] = s.baseY; arr[2] = 0;
      arr[3] = t.baseX; arr[4] = t.baseY; arr[5] = 0;
      attr.needsUpdate = true;
    }
  }
  placeStatic();
  const EXTENT = Math.max(
    520,
    Math.max(...views.map((v) => Math.hypot(v.baseX, v.baseY))) + 90,
  );

  // Star dust: a static backdrop of faint stars behind the graph, on for the
  // shapes that want it (see shapeHasDust in core/layout). Deterministic LCG,
  // not Math.random, so reloads render the same sky; sits well behind the
  // deepest ring's z so it never occludes or hit-tests.
  if (shapeHasDust(shape)) {
    const N = 200;
    const pos = new Float32Array(N * 3);
    let seed = 42;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < N; i++) {
      const a = rand() * Math.PI * 2;
      const r = Math.sqrt(rand()) * EXTENT * 1.45;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = Math.sin(a) * r;
      pos[i * 3 + 2] = -320;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const dustMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 1.6,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    });
    const dust = new THREE.Points(dustGeo, dustMat);
    dust.raycast = () => {};
    scene.add(dust);
  }

  // Infinity wire: a faint stroke of the lemniscate the beads sit on — the
  // guide that makes the figure eight legible (without it the fans read as
  // scattered moths). Honest decor: every branch head lies exactly on it.
  if (shape === "infinity") {
    const pts = infinityWire().map((p) => new THREE.Vector3(p.x, p.y, -1));
    const wireGeo = new THREE.BufferGeometry().setFromPoints(pts);
    const wire = new THREE.Line(
      wireGeo,
      new THREE.LineBasicMaterial({
        color: new THREE.Color(cfg.theme.muted),
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
      }),
    );
    wire.raycast = () => {};
    graphGroup.add(wire);
  }
  // On touch, fit only the root + first two rings so the important nodes are
  // centered and legible; the rest is reached by panning/pinching out.
  const extentForFit = () => {
    if (!SMALL) return EXTENT;
    const near = views
      .filter((v) => v.depth <= 2)
      .map((v) => Math.hypot(v.baseX, v.baseY));
    return Math.max(280, (near.length ? Math.max(...near) : EXTENT) + 70);
  };
  const fitZoom = () => {
    // Fit the WHOLE graph within the canvas with a small margin. (A previous
    // 1.6x "boost" for >4 groups zoomed past the outermost ring, clipping the
    // top/bottom of the graph — the whole thing should be visible by default.)
    const base = Math.min(W, H) / (extentForFit() * 1.9);
    return clamp(base, 0.18, 4.5);
  };
  camera.zoom = fitZoom();
  camera.updateProjectionMatrix();

  function applyNodeVisuals() {
    for (const v of views) {
      const s = radiusOf(v) * 2.2;
      v.sprite.scale.set(s, s, 1);
      v.sprite.material.map = textureFor(colorOf(v));
      v.sprite.material.needsUpdate = true;
    }
  }
  applyNodeVisuals();

  // ---- interaction state ----
  // The graph is 2D-first and static: no auto-rotate, no ambient 3D depth
  // (those only made sense for the old 3D renderer). depthMix stays 0.
  const state = {
    mode: "inspect" as "inspect" | "focus",
    focusId: null as string | null, // the selection — the only real interaction state
    hoverId: null as string | null, // tooltip-only hover; never changes selection
    depthMix: 0,
    targetDepthMix: 0,
    yaw: 0,
    targetYaw: 0,
    pitch: 0,
    targetPitch: 0,
    panX: 0,
    panY: 0,
    targetPanX: 0,
    targetPanY: 0,
    zoom: camera.zoom,
    targetZoom: camera.zoom,
    lastInput: performance.now(),
  };
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const cvs = renderer.domElement;
  let down = false;
  let dragging = false;
  let moved = 0;
  let sx = 0;
  let sy = 0;
  let startPanX = 0;
  let startPanY = 0;
  // Active pointers for multi-touch. Two pointers → pinch-to-zoom.
  const pointers = new Map<number, { x: number; y: number }>();
  let pinch: { dist: number; zoom: number } | null = null;

  function setMode(mode: typeof state.mode) {
    state.mode = mode;
  }
  function noteInput() {
    state.lastInput = performance.now();
  }

  const rect = () => cvs.getBoundingClientRect();
  function pick(e: PointerEvent): NodeView | null {
    const r = rect();
    ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(
      views.map((v) => v.sprite),
      false,
    );
    return hits.length ? viewById.get(hits[0].object.userData.id) ?? null : null;
  }

  function pinchDistance() {
    const [a, b] = [...pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y) || 1;
  }
  function beginPan(x: number, y: number) {
    sx = x;
    sy = y;
    startPanX = state.targetPanX;
    startPanY = state.targetPanY;
  }
  // Touch fallback: tiny nodes are hard to hit, so accept the nearest node
  // within a finger-sized radius of the tap.
  const pickVec = new THREE.Vector3();
  function nearestNode(e: PointerEvent, maxPx = 34): NodeView | null {
    const r = rect();
    const px = e.clientX - r.left;
    const py = e.clientY - r.top;
    let best: NodeView | null = null;
    let bestD = Infinity;
    for (const v of views) {
      v.sprite.getWorldPosition(pickVec);
      pickVec.project(camera);
      if (pickVec.z < -1 || pickVec.z > 1) continue;
      const x = (pickVec.x * 0.5 + 0.5) * r.width;
      const y = (-pickVec.y * 0.5 + 0.5) * r.height;
      const d = Math.hypot(x - px, y - py);
      if (d < bestD) {
        bestD = d;
        best = v;
      }
    }
    return bestD <= maxPx ? best : null;
  }
  // Visible label boxes (canvas-space), so clicking/hovering a label counts as
  // clicking/hovering its node. Populated each frame by updateLabels().
  const labelRects = new Map<string, { x: number; y: number; w: number; h: number }>();
  function labelHit(e: PointerEvent): NodeView | null {
    const r = rect();
    const px = e.clientX - r.left;
    const py = e.clientY - r.top;
    for (const [id, b] of labelRects) {
      if (px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h)
        return viewById.get(id) ?? null;
    }
    return null;
  }
  // The single hit target ("node M" in the interaction matrix), in priority
  // order: the node disc, then its label box, then the nearest node within a
  // forgiving radius. Used identically by click and hover.
  function resolveHit(e: PointerEvent): NodeView | null {
    return pick(e) ?? labelHit(e) ?? nearestNode(e, touchMode ? 36 : 22);
  }
  function onPointerDown(e: PointerEvent) {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    down = true;
    dragging = false;
    moved = 0;
    noteInput();
    cvs.setPointerCapture(e.pointerId);
    if (pointers.size === 1) {
      pinch = null;
      beginPan(e.clientX, e.clientY);
    } else if (pointers.size === 2) {
      pinch = { dist: pinchDistance(), zoom: state.targetZoom };
      dragging = true; // a pinch is never a tap
    }
  }
  function onPointerMove(e: PointerEvent) {
    if (pointers.has(e.pointerId))
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size >= 2 && pinch) {
      noteInput();
      state.targetZoom = clamp(
        (pinch.zoom * pinchDistance()) / pinch.dist,
        0.18,
        4.5,
      );
      return;
    }
    if (down && pointers.size === 1) {
      const dx = e.clientX - sx;
      const dy = e.clientY - sy;
      moved = Math.max(moved, Math.abs(dx) + Math.abs(dy));
      if (moved > 3) {
        dragging = true;
        if (!touchMode) cvs.style.cursor = "grabbing"; // feedback while panning
        // A pan would leave the anchored tooltip stranded — dismiss it.
        if (state.hoverId !== null) {
          state.hoverId = null;
          hideTip();
        }
      }
      noteInput();
      state.targetPanX = startPanX - dx / state.zoom;
      state.targetPanY = startPanY + dy / state.zoom;
    } else if (!down && !touchMode) {
      hoverTest(e);
    }
  }
  function onPointerUp(e: PointerEvent) {
    const wasPinch = pointers.size >= 2;
    pointers.delete(e.pointerId);
    if (down && !dragging && !wasPinch) clickTest(e);
    if (pointers.size < 2) pinch = null;
    if (pointers.size === 1) {
      // One finger lifted from a pinch — keep panning with the other.
      const [p] = [...pointers.values()];
      beginPan(p.x, p.y);
      dragging = true;
    } else if (pointers.size === 0) {
      down = false;
      if (!touchMode) cvs.style.cursor = "default";
      setTimeout(() => (dragging = false), 0);
    }
  }
  function onPointerCancel(e: PointerEvent) {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (pointers.size === 0) down = false;
  }
  function onWheel(e: WheelEvent) {
    e.preventDefault();
    noteInput();
    const factor = Math.exp(-e.deltaY * 0.0012);
    state.targetZoom = clamp(state.targetZoom * factor, 0.18, 4.5);
  }

  /* ===========================================================================
     INTERACTION MATRIX — the single source of truth for selection. Hover is a
     separate, transient tooltip layer that NEVER changes the selection state.
     "node M" = resolveHit(): node disc → its label box → nearest within radius.

       State ↓ / Trigger →   hover M        hover empty   click M                 click empty   esc      drag   pinch/wheel
       ───────────────────   ────────────   ───────────   ─────────────────────   ───────────   ──────   ────   ───────────
       Default               tooltip(M)     hide tooltip  → Selected(M)           Default       Default  pan    zoom
       Selected(N)           tooltip(M)     hide tooltip  M=N→Default; else Sel(M) → Default     → Default pan    zoom

     Enter Selected(N): light path root→N→children, glow on N, dim rest, (touch)
     auto-zoom. Enter Default: clear highlight + glow. setSelection() is the ONLY
     function that mutates selection; clicks route through it per the table above.
     ========================================================================== */

  // Rebuilds the "Branch References" legend from the current selection's refs.
  function updateLegend() {
    const refs = focusModel?.refList;
    if (!refs || !refs.length) {
      legendEl.style.display = "none";
      legendEl.innerHTML = "";
      return;
    }
    const nameOf = (nid: string) => byId.get(nid)?.name ?? nid;
    const rows = refs
      .map(
        (r) =>
          `<li class="hg-legend__row"><span class="hg-legend__from">${escapeHtml(
            nameOf(r.from),
          )}</span><span class="hg-legend__arrow">→</span><span class="hg-legend__to">${escapeHtml(
            nameOf(r.to),
          )}</span></li>`,
      )
      .join("");
    legendEl.innerHTML = `<div class="hg-legend__title">Branch References</div><ul class="hg-legend__list">${rows}</ul>`;
    legendEl.style.display = "block";
  }

  // ---- shape mode ("All nodes") -------------------------------------------
  // A transient god-mode view: every node lit, every link drawn, zero labels —
  // the raw silhouette of the data. Sticky until the user clicks a node, which
  // dissolves the mode AND selects that node (onShapeExit tells the UI chip).
  // Pan/zoom/empty-space clicks never dismiss it. Not persisted.
  // Settle-in intro paints the whole structure lit (shape-mode visuals)
  // while nodes glide to their weighted positions, then relaxes to the
  // resting view — declared here so the paint/label passes can branch on it.
  let introLit = false;
  let shapeMode = false;
  function setShapeMode(on: boolean) {
    if (shapeMode === on) return;
    shapeMode = on;
    if (on) {
      // The "everything at once" state contradicts a selection — clear it.
      // The two chips are independent layers (All nodes = structure, Show
      // references = the web); entering one never exits the other.
      state.hoverId = null;
      hideTip();
      setSelection(null);
    } else {
      applyHighlight();
    }
  }

  // ---- refs mode ("Show references") --------------------------------------
  // The sibling of shape mode: only the cross-reference web. Reference lines
  // bright, their endpoint nodes lit, everything else receded to a faint
  // skeleton. Same transient contract: node click dissolves and selects.
  let refsMode = false;
  const refNodeIds = new Set<string>();
  for (const l of elinks) {
    if (l.ref) {
      refNodeIds.add(l.s);
      refNodeIds.add(l.t);
    }
  }
  // Hover cluster for refs mode: the hovered endpoint, its reference
  // partners, and every ancestor on their chains up to the root. Bounded:
  // (1 + partners) × tree depth. Endpoints get labels; ancestors only light
  // up — labelling them too is what wouldn't scale on reference-heavy nodes.
  const refsHoverCluster = () => {
    const endpoints = new Set<string>();
    const ancestors = new Set<string>();
    if (refsMode && state.hoverId) {
      endpoints.add(state.hoverId);
      for (const r of refNeighbors.get(state.hoverId) ?? []) endpoints.add(r.id);
      for (const id of endpoints) {
        const node = byId.get(id);
        if (!node) continue;
        for (const p of parentChain(node))
          if (!endpoints.has(p.id)) ancestors.add(p.id);
      }
    }
    return { endpoints, ancestors };
  };
  function setRefsMode(on: boolean) {
    if (refsMode === on) return;
    refsMode = on;
    if (on) {
      state.hoverId = null;
      hideTip();
      setSelection(null);
    } else {
      applyHighlight();
    }
  }

  // Sole selection mutator. id=null → Default; id → Selected(id).
  function setSelection(id: string | null) {
    state.focusId = id;
    focusModel = id ? computeFocus(id) : null;
    if (id) {
      setMode("focus");
      if (touchMode) frameFocus(id);
    } else {
      setMode("inspect");
    }
    applyHighlight();
    rebuildFocusPairs();
    updateLegend();
  }
  const clearFocus = () => setSelection(null);

  function hoverTest(e: PointerEvent) {
    const v = resolveHit(e);
    cvs.style.cursor = v ? "pointer" : "default";
    // Shape mode is a pure overview: no tooltip, no hover through-line (the
    // cursor still invites the dive-in click). hoverId stays null so the
    // hover-path pass draws nothing.
    if (shapeMode) {
      if (state.hoverId !== null) {
        state.hoverId = null;
        hideTip();
      }
      return;
    }
    // Refs mode: hovering an endpoint answers "what connects to what" —
    // that node's reference lines brighten, the rest recede, and labels
    // appear on the node + its partners (see the refs branches in
    // applyHighlight/updateLabels). Non-endpoint nodes are inert. The
    // highlight is re-applied only on hover *change*, so this stays cheap.
    if (refsMode) {
      const id = v && refNodeIds.has(v.node.id) ? v.node.id : null;
      if (state.hoverId !== id) {
        state.hoverId = id;
        hideTip();
        applyHighlight();
      }
      return;
    }
    // The tooltip is sticky: it anchors when you hover a node and STAYS — so
    // you can move off the node, into the card, and click the link inside.
    // It's replaced only when another node is hovered; leaving to empty space
    // does not dismiss it. (A drag, a canvas click, zoom, or opening the panel
    // all clear it — see those handlers.) When a node is open in the panel a
    // scrim covers the canvas, so no hover events reach here anyway.
    if (v && state.hoverId !== v.node.id) {
      state.hoverId = v.node.id;
      showTip(v.node, e);
    }
  }
  function clickTest(e: PointerEvent) {
    const v = resolveHit(e);
    // Shape mode dismissal: node click only. Empty-space clicks keep the
    // silhouette; a node click dissolves the mode and falls through to the
    // normal selection flow so the user dives straight into that branch.
    if (shapeMode) {
      if (!v) return;
      shapeMode = false;
      cfg.onShapeExit?.();
    }
    if (refsMode) {
      if (!v) return;
      refsMode = false;
      cfg.onRefsExit?.();
    }
    if (v && cfg.clickAction === "url" && v.node.url && !touchMode) {
      window.open(v.node.url, "_blank", "noopener");
      return;
    }
    // Matrix: empty or same-node → Default (deselect); a different node → Selected.
    const id = v ? v.node.id : null;
    const finalId = id !== null && id === state.focusId ? null : id;
    // Any canvas click clears the sticky tooltip — a node click hands off to the
    // panel, an empty click is a "clear" gesture. (Clicking the link INSIDE the
    // tooltip is a DOM anchor click, not a canvas event, so it still navigates.)
    state.hoverId = null;
    hideTip();
    setSelection(finalId);
    // The detail panel/dialog is a LEAF affordance. A leaf click opens it; the
    // root or an internal (parent) node still selects and frames its branch via
    // setSelection above, but does NOT open the panel — and closes one that's
    // open. So notify React with the resulting node only when it's a leaf, else
    // null (which both suppresses the open and closes any open panel in step).
    const openLeaf = finalId !== null && !!v && !v.hasChildren;
    cfg.onNodeClick?.(openLeaf ? v.node : null);
  }

  // Auto-zoom/pan so the node and its immediate children fill the viewport.
  function frameFocus(id: string) {
    const v = viewById.get(id);
    if (!v) return;
    const pts = [v, ...(childrenOf.get(id) ?? []).map((c) => viewById.get(c.id)!)].filter(
      Boolean,
    ) as NodeView[];
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const p of pts) {
      minX = Math.min(minX, p.baseX);
      maxX = Math.max(maxX, p.baseX);
      minY = Math.min(minY, p.baseY);
      maxY = Math.max(maxY, p.baseY);
    }
    const spanX = Math.max(maxX - minX, 160);
    const spanY = Math.max(maxY - minY, 160);
    const pad = 1.7;
    state.targetPanX = (minX + maxX) / 2;
    state.targetPanY = (minY + maxY) / 2;
    state.targetZoom = clamp(Math.min(W / (spanX * pad), H / (spanY * pad)), 0.18, 4.5);
  }

  // Light-vs-dark ground, read from the theme's bg token (e.g. "oklch(0.98 …)"
  // or an rgb fallback). Drives shape-mode intensity: additive glows vanish on
  // white, so light themes compensate with heavier links and larger dots.
  function themeIsLight(): boolean {
    const bg = cfg.theme.bg;
    const ok = bg.match(/oklch\(\s*([\d.]+)(%?)/);
    if (ok) {
      const l = parseFloat(ok[1]);
      return (ok[2] === "%" || l > 1 ? l / 100 : l) > 0.5;
    }
    const rgb = bg.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
    if (rgb)
      return (+rgb[1] * 0.299 + +rgb[2] * 0.587 + +rgb[3] * 0.114) / 255 > 0.5;
    return false; // unknown format → assume dark (the app default)
  }

  function applyHighlight() {
    // Refs mode: only the cross-reference web. Endpoint nodes lit, reference
    // lines bright, hierarchy receded to a faint skeleton for orientation.
    // When shape mode is also on (composable A/B), the shape branch below
    // owns the frame and just adds the ref lines to the silhouette.
    if (refsMode && !shapeMode) {
      const light = themeIsLight();
      // Hover narrows the web to one node's connections: its lines full
      // strength, the rest of the web receded (but still traceable). The
      // cluster's ancestor chains light up too so an endpoint is never a
      // floating dot — its parentage back to the root stays readable.
      const hov = state.hoverId;
      const { endpoints, ancestors } = refsHoverCluster();
      for (const v of views) {
        const id = v.node.id;
        const inWeb = refNodeIds.has(id);
        const isEndpoint = endpoints.has(id);
        const isAncestor = ancestors.has(id);
        v.sprite.material.opacity = v.node.metadata?.placeholder
          ? 0.08
          : isEndpoint
            ? 1
            : isAncestor
              ? 0.8
              : inWeb
                ? hov
                  ? 0.35
                  : 1
                : hov
                  ? 0.1
                  : 0.14;
        v.sprite.renderOrder = inWeb || isAncestor ? 3 : 0;
        const base =
          radiusOf(v) * 2.2 * (isEndpoint ? 1.45 : isAncestor ? 1.15 : inWeb ? 1.26 : 1);
        v.sprite.scale.set(base, base, 1);
      }
      for (const line of linkObjs) {
        const l = line.userData.link as ELink;
        const mat = line.material as THREE.LineBasicMaterial;
        const onHover = hov !== null && (l.s === hov || l.t === hov);
        mat.opacity = l.ref
          ? onHover
            ? 0.95
            : hov
              ? 0.15
              : light
                ? 0.85
                : 0.7
          : 0.05;
        mat.color.set(l.ref ? cfg.theme.referenceLink : cfg.theme.link);
      }
      return;
    }
    // Shape mode: the whole structure at once. Every node full-strength, every
    // hierarchy link lit in the colour of its deeper (group-side) endpoint so
    // the branches glow in their palette colours; references stay dashed-lilac.
    // On a light ground the additive glow contributes nothing, so the shape
    // leans on heavier links + slightly larger dots instead.
    if (shapeMode || introLit) {
      const light = themeIsLight();
      for (const v of views) {
        v.sprite.material.opacity = v.node.metadata?.placeholder ? 0.18 : 1;
        v.sprite.renderOrder = 0;
        const base = radiusOf(v) * 2.2 * (light ? 1.14 : 1);
        v.sprite.scale.set(base, base, 1);
      }
      for (const line of linkObjs) {
        const l = line.userData.link as ELink;
        const mat = line.material as THREE.LineBasicMaterial;
        const trunk = isTrunk(l);
        const s = viewById.get(l.s);
        const t = viewById.get(l.t);
        const deeper = s && t ? (s.depth >= t.depth ? s : t) : (s ?? t);
        // All nodes is structure-only; refs draw at their shape intensity
        // only when the Show-references layer is also on.
        mat.opacity = trunk
          // Infinity: the thick pass owns trunks here too (same double-wiring
          // problem as the default view, just at shape-mode brightness).
          ? shape === "infinity"
            ? 0
            : light
              ? 0.95
              : 0.85
          : l.ref
            ? refsMode
              ? light
                ? 0.6
                : 0.45
              : 0
            : light
              ? 0.8
              : SMALL
                ? 0.6
                : 0.5;
        mat.color.set(
          trunk
            ? cfg.theme.accent
            : l.ref
              ? cfg.theme.referenceLink
              : deeper
                ? colorOf(deeper)
                : cfg.theme.link,
        );
      }
      return;
    }
    const keep = currentKeep();
    const edges =
      state.focusId ? focusEdgeSet(state.focusId) : null;
    for (const v of views) {
      const foc = v.node.id === state.focusId;
      // Focused: bright path, dimmer grandchildren + dependency targets, rest
      // dimmed. Default: depth-based recession.
      v.sprite.material.opacity = v.node.metadata?.placeholder
        ? 0.18
        : keep
        ? keep.has(v.node.id)
          ? 1
          : focusModel?.refTargets.has(v.node.id)
            ? 0.85
            : focusModel?.grand.has(v.node.id)
              ? 0.5
              : 0.26
        : baseNodeOpacity(v.depth);
      // Path nodes sit ON the trunk line as distinct dots (above it), slightly
      // enlarged — "connect the dots" rather than one continuous worm.
      const onPath = !!keep && keep.has(v.node.id);
      v.sprite.renderOrder = onPath ? 3 : 0;
      const base = radiusOf(v) * 2.2 * (foc ? 1.4 : onPath ? 1.26 : 1);
      v.sprite.scale.set(base, base, 1);
    }
    for (const line of linkObjs) {
      const l = line.userData.link as ELink;
      const mat = line.material as THREE.LineBasicMaterial;
      const hit = edges
        ? edges.has(edgeKey(l.s, l.t))
        : state.focusId && (l.s === state.focusId || l.t === state.focusId);
      const trunk = !keep && isTrunk(l); // root→branch line in the default view
      mat.opacity = hit
        ? l.ref
          ? 0.82
          : 0.9
        : keep
          ? l.ref
            ? 0.09
            : 0.12
          : trunk
            // Infinity: the thick pass owns trunk rendering (bundled or
            // whisper-direct) — drawing the thin fan underneath doubled the
            // wiring and read as a laser show.
            ? shape === "infinity"
              ? 0
              : (SMALL ? 0.7 : 0.55)
            : l.ref
              // Resting cross-links read as noise scribbled over the star
              // field; they now live behind the "Show references" chip and
              // still surface on selection (the `hit` branch above).
              ? 0
              : (SMALL ? 0.36 : 0.24);
      mat.color.set(
        hit
          ? colorOf(viewById.get(state.focusId!)!)
          : trunk
            ? cfg.theme.accent
            : l.ref
              ? cfg.theme.referenceLink
              // --link is near-invisible on light bg; use muted at small sizes.
              : SMALL
                ? cfg.theme.muted
                : cfg.theme.link,
      );
    }
  }

  // ---- labels ----
  // A fixed pool of reusable label elements (NOT one element per node) keeps the
  // label layer light regardless of graph size: each frame the most important
  // on-screen labels are assigned to slots and the rest stay hidden. This is what
  // lets the renderer handle thousands of nodes without thousands of live divs.
  const MAX_LABELS = SMALL ? 44 : 92;
  const labelPool: HTMLDivElement[] = [];
  for (let i = 0; i < MAX_LABELS; i++) {
    const el = document.createElement("div");
    el.className = "hg-label";
    el.style.display = "none";
    el.style.transform = "none"; // positioned by exact top-left box (no CSS lift)
    labelsEl.appendChild(el);
    labelPool.push(el);
  }
  // Reflow-free text measurement. Reading `offsetWidth` per label per frame forced
  // a synchronous layout that made large graphs unusable; an offscreen 2D context
  // measures text with zero DOM cost. Cached by font + string.
  const measureCtx = document.createElement("canvas").getContext("2d");
  const labelFont =
    (typeof getComputedStyle !== "undefined" &&
      getComputedStyle(labelsEl).fontFamily) ||
    'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  const textWidthCache = new Map<string, number>();
  function measureLabel(text: string, fontPx: number, weight: number): number {
    const key = `${fontPx}|${weight}|${text}`;
    let w = textWidthCache.get(key);
    if (w === undefined) {
      if (measureCtx) {
        measureCtx.font = `${weight} ${fontPx}px ${labelFont}`;
        w = measureCtx.measureText(text).width;
      } else {
        w = text.length * fontPx * 0.56; // fallback if 2D context is unavailable
      }
      textWidthCache.set(key, w);
    }
    return w;
  }
  const labelVec = new THREE.Vector3();
  function labelEligible(v: NodeView, keep: Set<string> | null): boolean {
    if (v.node.metadata?.placeholder) return false;
    // The root is rendered as the chart title + a glowing dot, never an in-graph
    // label (it sits dead-centre where everything converges — the worst occluder).
    if (v.depth === 0) return false;
    if (cfg.labelMode === "none") return false;
    if (cfg.labelMode === "all") return true;
    if (cfg.labelMode === "parents") return v.depth <= 1;
    if (v.depth <= 1) return true;
    if (keep && keep.has(v.node.id)) return true;
    if (focusModel && focusModel.secondary.has(v.node.id)) return true;
    if (state.zoom > 1.45 && v.depth <= 2) return true;
    if (state.zoom > 2.15) return true;
    return false;
  }
  // Label box geometry — mirrors .hg-label CSS (padding 1px 5px, line-height
  // 1.25). Labels are positioned by exact top-left so they can sit on ANY side
  // of their node (radially outward), which is what keeps them anchored instead
  // of floating off toward the centre when crowded.
  const L_PAD_X = 5;
  const L_PAD_Y = 1;
  const L_LINE = 1.25;
  const L_GAP = 4; // px from node centre to the label's near edge
  const L_MAX_W = 160; // matches CSS max-width; text wider than this wraps
  // 8 placement directions, clockwise from +x in screen space (y points down).
  const L_DIRS: ReadonlyArray<readonly [number, number]> = [
    [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1],
  ];
  // Try the outward-radial direction first, then fan out to either side.
  const L_SEQ = [0, -1, 1, -2, 2, -3, 3, 4];

  function updateLabels() {
    // Shape mode / refs mode at rest: no text — the silhouette carries the
    // meaning. Refs mode with a hovered endpoint labels just that node and
    // its reference partners (a small bounded set) so the hover answers
    // "what connects to what" without re-admitting the full label pass.
    if (shapeMode || introLit) {
      labelRects.clear();
      for (const el of labelPool) {
        if (el.style.display !== "none") {
          el.style.display = "none";
          el.removeAttribute("data-id");
        }
      }
      return;
    }
    if (refsMode && state.hoverId) {
      // Hover is the guarantee: the focused node's full cluster labels always
      // appear, collision rules relaxed for this bounded set.
      labelRects.clear();
      const cluster = new Set<string>([state.hoverId]);
      for (const r of refNeighbors.get(state.hoverId) ?? []) cluster.add(r.id);
      const rr = rect();
      let slot = 0;
      for (const v of views) {
        if (slot >= labelPool.length) break;
        if (!cluster.has(v.node.id)) continue;
        v.sprite.getWorldPosition(labelVec);
        labelVec.project(camera);
        if (labelVec.z < -1 || labelVec.z > 1) continue;
        const x = (labelVec.x * 0.5 + 0.5) * rr.width;
        const y = (-labelVec.y * 0.5 + 0.5) * rr.height;
        const el = labelPool[slot++];
        el.textContent = v.node.name;
        el.style.display = "block";
        el.style.fontSize = `${Math.max(11, cfg.labelSize)}px`;
        el.style.fontWeight = v.node.id === state.hoverId ? "600" : "500";
        el.style.left = `${x + L_GAP + 6}px`;
        el.style.top = `${y - 8}px`;
        el.setAttribute("data-id", v.node.id);
      }
      for (; slot < labelPool.length; slot++) {
        const el = labelPool[slot];
        if (el.style.display !== "none") {
          el.style.display = "none";
          el.removeAttribute("data-id");
        }
      }
      return;
    }
    const keep = currentKeep();
    const r = rect();
    // Graph centre on screen (root projection) → labels fan radially outward.
    let cx = r.width / 2;
    let cy = r.height / 2;
    if (rootId) {
      const rv = viewById.get(rootId);
      if (rv) {
        rv.sprite.getWorldPosition(labelVec);
        labelVec.project(camera);
        cx = (labelVec.x * 0.5 + 0.5) * r.width;
        cy = (-labelVec.y * 0.5 + 0.5) * r.height;
      }
    }
    labelRects.clear(); // rebuilt below for visible labels (label-as-node hits)

    // 1) Gather eligible, on-screen candidates with a screen position + score.
    //    Lower score = more important (placed first, never culled). This bounds
    //    DOM work to MAX_LABELS no matter how many nodes the graph has.
    // Refs mode (no hover): endpoints run through THIS standard pass instead
    // of an unconditional stamp — the collision culling below drops what
    // doesn't fit, so sparse webs label fully and dense webs keep only their
    // most-connected endpoints. Hover (handled above) restores any cluster.
    const refsFilter = refsMode && !state.hoverId ? refNodeIds : null;
    const cands: { v: NodeView; x: number; y: number; score: number }[] = [];
    const margin = 48;
    for (const v of views) {
      if (refsFilter) {
        if (!refsFilter.has(v.node.id)) continue;
      } else if (!labelEligible(v, keep)) continue;
      v.sprite.getWorldPosition(labelVec);
      labelVec.project(camera);
      if (labelVec.z < -1 || labelVec.z > 1) continue;
      const x = (labelVec.x * 0.5 + 0.5) * r.width;
      const y = (-labelVec.y * 0.5 + 0.5) * r.height;
      if (x < -margin || x > r.width + margin || y < -margin || y > r.height + margin)
        continue;
      const id = v.node.id;
      const must =
        !refsFilter &&
        ((!!keep && keep.has(id)) ||
          id === state.hoverId ||
          !!focusModel?.refTargets.has(id));
      // Refs ordering: more connections = more important = placed first.
      const score = refsFilter
        ? -(refNeighbors.get(id)?.length ?? 0) * 50 + v.depth
        : (must ? -1000 : 0) + v.depth * 10 - Math.min(v.degree, 30) * 0.3;
      cands.push({ v, x, y, score });
    }
    cands.sort((a, b) => a.score - b.score);

    // 2) Place greedily: each label is anchored adjacent to its node, trying the
    //    radially-outward side first then fanning around it. If no side is free,
    //    prominent labels are kept (allowed to overlap) and the rest are dropped.
    const placed: { x: number; y: number; w: number; h: number }[] = [];
    const free = (bx: number, by: number, bw: number, bh: number): boolean => {
      for (let i = 0; i < placed.length; i++) {
        const p = placed[i];
        if (bx < p.x + p.w && bx + bw > p.x && by < p.y + p.h && by + bh > p.y)
          return false;
      }
      return true;
    };
    let slot = 0;
    for (let i = 0; i < cands.length && slot < labelPool.length; i++) {
      const { v, x, y } = cands[i];
      const id = v.node.id;
      // In refs mode nothing is overlap-exempt: a label that doesn't fit is
      // dropped, never stacked — that's the whole point of routing endpoints
      // through this pass.
      const prominent =
        !refsFilter &&
        (v.depth <= 1 || (!!keep && keep.has(id)) || !!focusModel?.refTargets.has(id));
      const depthMult =
        v.depth === 0 ? (SMALL ? 1.08 : 1.18) : v.depth === 1 ? 1.05 : 1;
      const fontPx = Math.max(
        8,
        Math.round(cfg.labelSize * depthMult * (prominent ? 1 : 0.8)),
      );
      const weight = v.depth === 0 ? 700 : v.depth <= 1 ? 600 : 500;
      const rawW = measureLabel(v.node.name, fontPx, weight);
      const lines = Math.ceil(rawW / L_MAX_W);
      const bw = Math.min(rawW, L_MAX_W) + 2 * L_PAD_X;
      const bh = fontPx * L_LINE * lines + 2 * L_PAD_Y;

      // Primary direction = radially outward from the graph centre.
      let primary = Math.round(Math.atan2(y - cy, x - cx) / (Math.PI / 4));
      primary = ((primary % 8) + 8) % 8;

      const boxFor = (dirIdx: number): [number, number] => {
        const d = L_DIRS[dirIdx];
        const dl = Math.hypot(d[0], d[1]) || 1;
        const ux = d[0] / dl;
        const uy = d[1] / dl;
        const half = Math.abs(ux) * (bw / 2) + Math.abs(uy) * (bh / 2);
        return [x + ux * (L_GAP + half) - bw / 2, y + uy * (L_GAP + half) - bh / 2];
      };

      let boxX = 0;
      let boxY = 0;
      let found = false;
      for (let s = 0; s < L_SEQ.length; s++) {
        const [tx, ty] = boxFor((((primary + L_SEQ[s]) % 8) + 8) % 8);
        if (free(tx, ty, bw, bh)) {
          boxX = tx;
          boxY = ty;
          found = true;
          break;
        }
      }
      if (!found) {
        if (!prominent) continue; // crowded context label — drop it
        [boxX, boxY] = boxFor(primary); // prominent: keep it even if it overlaps
      }

      const el = labelPool[slot++];
      if (el.dataset.id !== id) {
        el.textContent = v.node.name;
        el.dataset.id = id;
      }
      el.style.display = "block";
      el.style.left = `${boxX}px`;
      el.style.top = `${boxY}px`;
      el.style.fontSize = `${fontPx}px`;
      el.style.fontWeight = `${weight}`;
      el.style.color = focusModel?.refTargets.has(id)
        ? cfg.theme.accent // referenced node — marked in the reference colour
        : v.depth <= 1 || (keep && keep.has(id))
          ? cfg.theme.text
          : cfg.theme.muted;
      el.style.opacity = keep
        ? keep.has(id)
          ? "1"
          : focusModel?.refTargets.has(id)
            ? "0.95"
            : focusModel?.secondary.has(id)
              ? "0.55"
              : "0.22"
        : v.depth <= 1
          ? "1"
          : "0.72";
      placed.push({ x: boxX, y: boxY, w: bw, h: bh });
      // Padded hit box so the label is a forgiving click/hover target.
      labelRects.set(id, { x: boxX - 3, y: boxY - 3, w: bw + 6, h: bh + 6 });
    }
    // Release any pool slots not used this frame.
    for (let s = slot; s < labelPool.length; s++) {
      const el = labelPool[s];
      if (el.style.display !== "none") {
        el.style.display = "none";
        el.removeAttribute("data-id");
      }
    }
  }

  // ---- tooltip ----
  function showTip(n: GraphNode, e: PointerEvent) {
    const meta = n.metadata ?? {};
    // image/cover feed the cover art above — don't repeat them as text rows.
    const metaRows = Object.entries(meta)
      .filter(([k]) => k !== "image" && k !== "cover")
      .slice(0, 6)
      .map(([k, val]) => `<span><b>${escapeHtml(k)}</b> ${escapeHtml(String(val))}</span>`)
      .join("");
    const refs = refNeighbors.get(n.id) ?? [];
    const refRows = refs.length
      ? `<div class="hg-tt-refs"><span class="hg-tt-refs__label">References</span>${refs
          .slice(0, 6)
          .map((r) => `<span class="hg-tt-ref">${escapeHtml(r.name)}</span>`)
          .join("")}</div>`
      : "";
    // Media inside the tooltip: a cover image on top when the data carries one
    // (metadata.image/cover, or the url itself is an image). Data-driven only.
    // No type eyebrow — the app doesn't assign nodes a kind. When the node has a
    // url, the cover art is itself the link (the whole tile is the click target).
    const media = mediaImageOf(n);
    const href = n.url ? escapeHtml(n.url) : null;
    const img = media
      ? `<img class="hg-tt-media" src="${escapeHtml(media)}" alt="" loading="lazy" onerror="this.remove()" />`
      : "";
    const mediaHtml =
      media && href
        ? `<a class="hg-tt-medialink" href="${href}" target="_blank" rel="noopener noreferrer">${img}</a>`
        : img;
    tooltipEl.innerHTML =
      mediaHtml +
      `<div class="hg-tt-name">${escapeHtml(n.name)}</div>` +
      `<div class="hg-tt-path">${escapeHtml(pathOf(n))}</div>` +
      (metaRows ? `<div class="hg-tt-meta">${metaRows}</div>` : "") +
      refRows +
      (href
        ? `<a class="hg-tt-url" href="${href}" target="_blank" rel="noopener noreferrer">${escapeHtml(n.url as string)}</a>`
        : "");
    tooltipEl.classList.add("is-shown");
    // Anchor once, at the point of entry — the tooltip does NOT chase the
    // cursor, so it stays a stable target you can move onto and click.
    moveTip(e);
  }
  function hideTip() {
    tooltipEl.classList.remove("is-shown");
  }
  function moveTip(e: PointerEvent) {
    const r = container.getBoundingClientRect();
    const pad = 14;
    const tw = tooltipEl.offsetWidth;
    const th = tooltipEl.offsetHeight;
    let x = e.clientX - r.left + pad;
    let y = e.clientY - r.top + pad;
    if (x + tw > r.width) x = e.clientX - r.left - tw - pad;
    if (y + th > r.height) y = e.clientY - r.top - th - pad;
    tooltipEl.style.left = `${x}px`;
    tooltipEl.style.top = `${y}px`;
  }

  // ---- ambient link pulses ----------------------------------------------
  // Faint glints travel along the connectors in the background (a hint of
  // "play"), and brighter ones run the focused through-line when a node is
  // selected. Additive blending gives each a soft glow + comet trail.
  const pulseTex = (() => {
    const s = 64;
    const c = document.createElement("canvas");
    c.width = c.height = s;
    const ctx = c.getContext("2d")!;
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.35, "rgba(255,255,255,0.55)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    const t = new THREE.CanvasTexture(c);
    t.needsUpdate = true;
    return t;
  })();
  // Soft glow behind the selected node so it's clearly the active one.
  const selGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: pulseTex,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0,
    }),
  );
  selGlow.renderOrder = 2;
  selGlow.visible = false;
  graphGroup.add(selGlow);
  // Persistent gentle glow on the root — its label lives in the chart title, so
  // it reads as the anchor: a quietly pulsing dot.
  const rootGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: pulseTex,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0,
    }),
  );
  rootGlow.renderOrder = 1;
  rootGlow.visible = false;
  graphGroup.add(rootGlow);
  function updateRootGlow(now: number) {
    const v = rootId ? viewById.get(rootId) : null;
    if (!v) {
      rootGlow.visible = false;
      return;
    }
    rootGlow.visible = true;
    rootGlow.position.set(v.baseX, v.baseY, 0.3);
    const sz = radiusOf(v) * 2.2 * 3.2;
    rootGlow.scale.set(sz, sz, 1);
    const mat = rootGlow.material as THREE.SpriteMaterial;
    mat.color.set(cfg.theme.accent);
    mat.opacity = cfg.reducedMotion ? 0.3 : 0.24 + 0.12 * Math.sin(now * 0.0032);
  }
  // Faint pulsing aura behind each node on the selected path — so the through-
  // line reads as connected, breathing dots rather than one solid worm.
  const auraPool: THREE.Sprite[] = [];
  function getAura(i: number): THREE.Sprite {
    while (auraPool.length <= i) {
      const a = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: pulseTex,
          transparent: true,
          depthTest: false,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          opacity: 0,
        }),
      );
      a.renderOrder = 2; // above the trunk line, below the dot (renderOrder 3)
      a.visible = false;
      graphGroup.add(a);
      auraPool.push(a);
    }
    return auraPool[i];
  }
  function updateWaypointAura(now: number) {
    let n = 0;
    // Shape mode: breathe a soft aura on the structural tiers (root + branches
    // + groups — a bounded set) so the silhouette glows without paying for an
    // additive sprite on every leaf of a large graph.
    if (shapeMode) {
      for (const v of views) {
        if (v.depth > 2 || v.node.metadata?.placeholder) continue;
        const a = getAura(n++);
        a.visible = true;
        a.position.set(v.baseX, v.baseY, 0.45);
        const sz = radiusOf(v) * 2.2 * (v.depth === 0 ? 3.6 : 3.0);
        a.scale.set(sz, sz, 1);
        const m = a.material as THREE.SpriteMaterial;
        m.color.set(v.depth === 0 ? cfg.theme.accent : colorOf(v));
        m.opacity = cfg.reducedMotion ? 0.24 : 0.18 + 0.1 * Math.sin(now * 0.003 + n * 0.55);
      }
      for (; n < auraPool.length; n++) auraPool[n].visible = false;
      return;
    }
    const keep = currentKeep();
    if (keep) {
      for (const v of views) {
        if (!keep.has(v.node.id) || v.node.id === rootId) continue;
        const a = getAura(n++);
        a.visible = true;
        a.position.set(v.baseX, v.baseY, 0.45);
        const sz = radiusOf(v) * 2.2 * 3.0;
        a.scale.set(sz, sz, 1);
        const m = a.material as THREE.SpriteMaterial;
        m.color.set(colorOf(v));
        // staggered phase so waypoints breathe in a gentle wave, not in lockstep
        m.opacity = cfg.reducedMotion ? 0.22 : 0.16 + 0.1 * Math.sin(now * 0.004 + n * 0.8);
      }
    }
    for (; n < auraPool.length; n++) auraPool[n].visible = false;
  }
  function updateSelGlow(now: number) {
    if (state.focusId) {
      const v = viewById.get(state.focusId);
      if (v) {
        selGlow.visible = true;
        selGlow.position.set(v.baseX, v.baseY, 0.4);
        const sz = radiusOf(v) * 2.2 * 3.6;
        selGlow.scale.set(sz, sz, 1);
        const mat = selGlow.material as THREE.SpriteMaterial;
        mat.color.set(colorOf(v));
        // Gentle breathing glow (steady if reduced-motion).
        mat.opacity = cfg.reducedMotion ? 0.42 : 0.34 + 0.1 * Math.sin(now * 0.004);
        return;
      }
    }
    selGlow.visible = false;
  }

  // ---- thick "active" connectors ----
  // WebGL line width is capped at 1px, so the trunk / focused path read as
  // hairlines. Draw the active connections as solid quad meshes (real width,
  // near-full opacity) so they're unmistakably connected.
  const thickPool: THREE.Mesh[] = [];
  // Reused scratch colours for the per-link gradient (avoid per-frame allocs).
  const gradA = new THREE.Color();
  const gradB = new THREE.Color();
  function getThick(i: number): THREE.Mesh {
    while (thickPool.length <= i) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute(
        "position",
        new THREE.BufferAttribute(new Float32Array(12), 3),
      );
      // Per-vertex colour so each link can gradient between its two nodes.
      geo.setAttribute(
        "color",
        new THREE.BufferAttribute(new Float32Array(12), 3),
      );
      geo.setIndex([0, 1, 2, 0, 2, 3]);
      const mat = new THREE.MeshBasicMaterial({
        transparent: true,
        depthTest: false,
        depthWrite: false,
        vertexColors: true,
      });
      const m = new THREE.Mesh(geo, mat);
      m.renderOrder = 2;
      m.frustumCulled = false;
      graphGroup.add(m);
      thickPool.push(m);
    }
    return thickPool[i];
  }
  function updateThickLines() {
    const keep = currentKeep();
    const edges = state.focusId ? focusEdgeSet(state.focusId) : null;
    const hw = (SMALL ? 2.0 : 1.4) / state.zoom; // half-width, ~constant px
    // Refs-mode hover: only the trunk limb(s) leading to the hovered cluster
    // stay lit; unrelated limbs recede to background transparency so the
    // star doesn't shout over the traced connection.
    const refsCluster = refsMode && state.hoverId ? refsHoverCluster() : null;
    const limbRelated = (l: ELink): boolean => {
      if (!refsCluster) return true;
      const branch = l.s === rootId ? l.t : l.s;
      return refsCluster.ancestors.has(branch) || refsCluster.endpoints.has(branch);
    };
    let n = 0;
    const quad = (
      ax: number,
      ay: number,
      bx: number,
      by: number,
      w: number,
      colA: string,
      colB: string,
      opacity: number,
    ) => {
      const dx = bx - ax;
      const dy = by - ay;
      const len = Math.hypot(dx, dy) || 1;
      const px = (-dy / len) * w;
      const py = (dx / len) * w;
      const m = getThick(n++);
      const arr = (m.geometry.attributes.position as THREE.BufferAttribute)
        .array as Float32Array;
      arr[0] = ax + px; arr[1] = ay + py; arr[2] = 1;
      arr[3] = ax - px; arr[4] = ay - py; arr[5] = 1;
      arr[6] = bx - px; arr[7] = by - py; arr[8] = 1;
      arr[9] = bx + px; arr[10] = by + py; arr[11] = 1;
      (m.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      // Gradient along the link (verts 0,1 at `a`, 2,3 at `b`) — kills the
      // flat-orange spokes.
      const carr = (m.geometry.attributes.color as THREE.BufferAttribute)
        .array as Float32Array;
      gradA.set(colA);
      gradB.set(colB);
      carr[0] = carr[3] = gradA.r; carr[1] = carr[4] = gradA.g; carr[2] = carr[5] = gradA.b;
      carr[6] = carr[9] = gradB.r; carr[7] = carr[10] = gradB.g; carr[8] = carr[11] = gradB.b;
      (m.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
      m.visible = true;
      (m.material as THREE.MeshBasicMaterial).opacity = opacity;
    };

    // Infinity trunks whisper: root→bead threads stay direct (honest
    // topology — no invented junctions) but thin and faint, so many-branch
    // manifests read as silk through the crossing, not a laser knot.
    const whisper = shape === "infinity" && !keep && !edges;

    for (const line of linkObjs) {
      const l = line.userData.link as ELink;
      const k = edgeKey(l.s, l.t);
      const full = edges ? edges.has(k) : !keep && isTrunk(l);
      const grand = !full && !!focusModel && focusModel.grandEdges.has(k);
      if (!full && !grand) continue;
      const a = viewById.get(l.s)!;
      const b = viewById.get(l.t)!;
      let ax = a.baseX;
      let ay = a.baseY;
      let bx = b.baseX;
      let by = b.baseY;
      let colA = colorOf(a);
      let colB = colorOf(b);
      let w = grand ? hw * 0.6 : hw;
      let op = grand ? 0.5 : refsCluster && !limbRelated(l) ? 0.24 : 0.95;
      if (whisper && isTrunk(l)) {
        w = hw * 0.5;
        op = refsCluster && !limbRelated(l) ? 0.18 : 0.45;
      }
      quad(ax, ay, bx, by, w, colA, colB, op);
    }
    for (; n < thickPool.length; n++) thickPool[n].visible = false;
  }

  // ---- hover preview: a light root→node through-line for the hovered node ----
  // (desktop only) so the path is previewed before the user commits to a click.
  const hoverPool: THREE.Mesh[] = [];
  function getHoverLine(i: number): THREE.Mesh {
    while (hoverPool.length <= i) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute(
        "position",
        new THREE.BufferAttribute(new Float32Array(12), 3),
      );
      geo.setIndex([0, 1, 2, 0, 2, 3]);
      const mat = new THREE.MeshBasicMaterial({
        transparent: true,
        depthTest: false,
        depthWrite: false,
      });
      const m = new THREE.Mesh(geo, mat);
      m.renderOrder = 1; // under the thick selected trunk where they overlap
      m.frustumCulled = false;
      graphGroup.add(m);
      hoverPool.push(m);
    }
    return hoverPool[i];
  }
  function updateHoverPath() {
    let n = 0;
    const hid = state.hoverId;
    // Refs mode draws the through-line for the hovered endpoint AND each of
    // its reference partners — endpoints without parentage are floating dots.
    const chainIds =
      refsMode && hid ? [...refsHoverCluster().endpoints] : hid ? [hid] : [];
    for (const cid of chainIds) {
      if (cid === state.focusId || touchMode) continue;
      const node = byId.get(cid);
      const hv = node ? viewById.get(cid) : null;
      if (node && hv) {
        const chain = parentChain(node); // node → … → root
        const hw = (SMALL ? 1.0 : 0.75) / state.zoom; // thin — a hint, not the trunk
        const col = colorOf(hv);
        for (let i = 0; i < chain.length - 1; i++) {
          const a = viewById.get(chain[i].id)!;
          const b = viewById.get(chain[i + 1].id)!;
          const dx = b.baseX - a.baseX;
          const dy = b.baseY - a.baseY;
          const len = Math.hypot(dx, dy) || 1;
          const px = (-dy / len) * hw;
          const py = (dx / len) * hw;
          const m = getHoverLine(n++);
          const arr = (m.geometry.attributes.position as THREE.BufferAttribute)
            .array as Float32Array;
          arr[0] = a.baseX + px; arr[1] = a.baseY + py; arr[2] = 0.6;
          arr[3] = a.baseX - px; arr[4] = a.baseY - py; arr[5] = 0.6;
          arr[6] = b.baseX - px; arr[7] = b.baseY - py; arr[8] = 0.6;
          arr[9] = b.baseX + px; arr[10] = b.baseY + py; arr[11] = 0.6;
          (m.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
          m.visible = true;
          (m.material as THREE.MeshBasicMaterial).color.set(col);
          (m.material as THREE.MeshBasicMaterial).opacity = 0.5;
        }
      }
    }
    for (; n < hoverPool.length; n++) hoverPool[n].visible = false;
  }

  const hierLinks = elinks.filter((l) => !l.ref);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const TRAIL = 3;
  interface Pulse {
    sprites: THREE.Sprite[];
    s: NodeView;
    t: NodeView;
    start: number;
    dur: number;
    focus: boolean;
    focusSlot: boolean;
    color: THREE.Color;
  }
  // Focused through-line segments (root→…→node, and node→each child).
  const focusPairs: [NodeView, NodeView][] = [];
  function rebuildFocusPairs() {
    focusPairs.length = 0;
    const id = state.focusId;
    const node = id ? byId.get(id) : null;
    if (!node) return;
    const chain = parentChain(node);
    for (let i = 0; i < chain.length - 1; i++) {
      const a = viewById.get(chain[i].id);
      const b = viewById.get(chain[i + 1].id);
      if (a && b) focusPairs.push([a, b]);
    }
    const nv = viewById.get(node.id);
    for (const c of childrenOf.get(node.id) ?? []) {
      const cv = viewById.get(c.id);
      if (nv && cv) focusPairs.push([nv, cv]);
    }
  }
  function respawnPulse(p: Pulse, now: number) {
    p.start = now + Math.random() * 280;
    if (p.focusSlot && focusPairs.length) {
      const [a, b] = focusPairs[(Math.random() * focusPairs.length) | 0];
      p.s = a;
      p.t = b;
      p.focus = true;
      p.dur = 900 + Math.random() * 900;
      p.color.set(state.focusId ? colorOf(viewById.get(state.focusId)!) : cfg.theme.accent);
    } else if (hierLinks.length) {
      const l = hierLinks[(Math.random() * hierLinks.length) | 0];
      p.s = viewById.get(l.s)!;
      p.t = viewById.get(l.t)!;
      p.focus = false;
      p.dur = 1600 + Math.random() * 1500;
      p.color.set(cfg.theme.accent);
    }
  }
  const pulses: Pulse[] = [];
  const BG_PULSES = touchMode ? 6 : 12;
  const FOCUS_SLOTS = 5;
  let pulsesReady = false;
  function initPulses(now: number) {
    if (!hierLinks.length) return;
    for (let i = 0; i < BG_PULSES + FOCUS_SLOTS; i++) {
      const sprites: THREE.Sprite[] = [];
      for (let k = 0; k < TRAIL + 1; k++) {
        const m = new THREE.SpriteMaterial({
          map: pulseTex,
          transparent: true,
          depthTest: false,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          opacity: 0,
        });
        const sp = new THREE.Sprite(m);
        sp.renderOrder = 3;
        sp.visible = false;
        graphGroup.add(sp);
        sprites.push(sp);
      }
      const p: Pulse = {
        sprites,
        s: views[0],
        t: views[0],
        start: now + Math.random() * 2000,
        dur: 2000,
        focus: false,
        focusSlot: i >= BG_PULSES,
        color: new THREE.Color(cfg.theme.accent),
      };
      respawnPulse(p, now);
      pulses.push(p);
    }
    pulsesReady = true;
  }
  function updatePulses(now: number) {
    if (cfg.reducedMotion) return; // honour reduced-motion: no ambient drift
    if (!pulsesReady) initPulses(now);
    for (const p of pulses) {
      // Idle focus-slot pulses fall back to background links.
      if (p.focusSlot && p.focus && !focusPairs.length) respawnPulse(p, now);
      const elapsed = now - p.start;
      if (elapsed < 0) {
        for (const sp of p.sprites) sp.visible = false;
        continue;
      }
      if (elapsed > p.dur) {
        respawnPulse(p, now);
        continue;
      }
      const prog = elapsed / p.dur;
      const peak = Math.sin(prog * Math.PI);
      const baseOp = (p.focus ? 0.5 : 0.15) * peak;
      for (let i = 0; i < p.sprites.length; i++) {
        const sp = p.sprites[i];
        const tp = prog - i * 0.05;
        if (tp < 0 || tp > 1) {
          sp.visible = false;
          continue;
        }
        sp.visible = true;
        sp.position.set(lerp(p.s.baseX, p.t.baseX, tp), lerp(p.s.baseY, p.t.baseY, tp), 1);
        const sz = (p.focus ? 24 : 16) * (1 - i * 0.2);
        sp.scale.set(sz, sz, 1);
        const m = sp.material as THREE.SpriteMaterial;
        m.opacity = baseOp * (1 - i / (p.sprites.length + 1));
        m.color.copy(p.color);
      }
    }
  }

  // ---- animation loop (flat 2D: pan/zoom easing only) ----
  let raf = 0;
  // ---- settle-in intro ----------------------------------------------------
  // One-shot: hold the equal-spaced frame briefly, then ease every node to
  // its weighted position. The ONLY period where the static-layout invariant
  // bends — placeStatic() re-runs per frame for ~INTRO_MS, then the graph
  // freezes back into the one-shot regime for the life of the mount.
  const INTRO_HOLD = 250;
  const INTRO_MS = 700;
  let introStart: number | null = null;
  let introActive = !cfg.reducedMotion && views.length > 1;
  if (introActive) {
    introLit = true;
    for (const v of views) {
      v.baseX = v.introSX;
      v.baseY = v.introSY;
    }
    placeStatic();
    applyHighlight();
  }
  function introFrame(now: number) {
    if (!introActive) return;
    if (introStart === null) introStart = now;
    const t = (now - introStart - INTRO_HOLD) / INTRO_MS;
    if (t < 0) return; // holding the equal frame
    const p = Math.min(1, t);
    const e = 1 - Math.pow(1 - p, 3); // ease-out cubic
    for (const v of views) {
      v.baseX = v.introSX + (v.introTX - v.introSX) * e;
      v.baseY = v.introSY + (v.introTY - v.introSY) * e;
    }
    placeStatic();
    if (p >= 1) {
      for (const v of views) {
        v.baseX = v.introTX;
        v.baseY = v.introTY;
      }
      placeStatic();
      introActive = false;
      // Linger fully lit for a beat, then relax into the resting view.
      setTimeout(() => {
        introLit = false;
        applyHighlight();
      }, 350);
    }
  }

  function tick(now: number) {
    introFrame(now);
    state.panX += (state.targetPanX - state.panX) * 0.18;
    state.panY += (state.targetPanY - state.panY) * 0.18;
    state.zoom += (state.targetZoom - state.zoom) * 0.18;
    // Node + thin-link geometry are placed once in placeStatic() — not rebuilt
    // per frame. Only the animated layers below update each frame.
    updatePulses(now);
    updateRootGlow(now);
    updateWaypointAura(now);
    updateSelGlow(now);
    updateThickLines();
    updateHoverPath();
    camera.position.x = state.panX;
    camera.position.y = state.panY;
    camera.zoom = state.zoom;
    camera.updateProjectionMatrix();
    updateLabels();
    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  }
  raf = requestAnimationFrame(tick);

  // ---- resize ----
  function onResize() {
    W = container.clientWidth || W;
    H = container.clientHeight || H;
    renderer.setSize(W, H);
    camera.left = -W / 2;
    camera.right = W / 2;
    camera.top = H / 2;
    camera.bottom = -H / 2;
    state.targetZoom = state.zoom = fitZoom();
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(onResize);
  ro.observe(container);

  // ---- events ----
  cvs.addEventListener("pointerdown", onPointerDown);
  cvs.addEventListener("pointermove", onPointerMove);
  cvs.addEventListener("pointerup", onPointerUp);
  cvs.addEventListener("pointercancel", onPointerCancel);
  cvs.addEventListener("pointerleave", (e) => {
    // Leaving the canvas dismisses the hover tooltip — UNLESS the pointer is
    // moving onto the tooltip itself (it's a sibling over the canvas, so that
    // reach fires pointerleave). Dismissing there would make the sticky card
    // unreachable, which is the whole point of it being sticky.
    if ((e as PointerEvent).relatedTarget instanceof Node &&
        tooltipEl.contains((e as PointerEvent).relatedTarget as Node)) {
      return;
    }
    if (!touchMode) {
      state.hoverId = null;
      hideTip();
    }
  });
  cvs.addEventListener("wheel", onWheel, { passive: false });

  function refreshColors() {
    textureCache = new Map();
    applyNodeVisuals();
    applyHighlight();
  }

  // ---- handle ----
  return {
    update(patch) {
      Object.assign(cfg, patch);
      if (patch.palette || patch.theme || patch.nodeStyle) refreshColors();
      if ("labelBackground" in patch)
        labelsEl.classList.toggle("hg-labels--boxed", !!cfg.labelBackground);
    },
    reset() {
      state.targetPanX = state.panX = 0;
      state.targetPanY = state.panY = 0;
      state.targetZoom = state.zoom = fitZoom();
      clearFocus();
      setMode("inspect");
    },
    focus(id) {
      if (byId.has(id)) setSelection(id);
    },
    setShapeMode,
    setRefsMode,
    snapshotPng(opts = {}) {
      const mark = opts.mark !== false; // subtle "Constella" corner mark, default on
      try {
        renderer.render(scene, camera);
        const r = rect();
        const cssW = r.width;
        const cssH = r.height;
        if (cssW < 2 || cssH < 2)
          return renderer.domElement.toDataURL("image/png");

        // Bounding box of the actual content (on-screen nodes + visible labels),
        // so the export crops to the graph rather than capturing a full-width
        // canvas that's mostly empty.
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        for (const v of views) {
          v.sprite.getWorldPosition(labelVec);
          labelVec.project(camera);
          if (labelVec.z < -1 || labelVec.z > 1) continue;
          const x = (labelVec.x * 0.5 + 0.5) * cssW;
          const y = (-labelVec.y * 0.5 + 0.5) * cssH;
          if (x < -20 || x > cssW + 20 || y < -20 || y > cssH + 20) continue;
          if (x - 8 < minX) minX = x - 8;
          if (y - 8 < minY) minY = y - 8;
          if (x + 8 > maxX) maxX = x + 8;
          if (y + 8 > maxY) maxY = y + 8;
        }
        // Visible labels (HTML overlays — NOT part of the WebGL canvas, which is
        // why a plain toDataURL produced label-less exports).
        const labels: { x: number; y: number; el: HTMLDivElement }[] = [];
        for (const el of labelPool) {
          if (el.style.display === "none") continue;
          const x = parseFloat(el.style.left) || 0;
          const y = parseFloat(el.style.top) || 0;
          const w = el.offsetWidth;
          const h = el.offsetHeight;
          labels.push({ x, y, el });
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x + w > maxX) maxX = x + w;
          if (y + h > maxY) maxY = y + h;
        }
        if (!isFinite(minX)) {
          minX = 0;
          minY = 0;
          maxX = cssW;
          maxY = cssH;
        }
        const pad = 36;
        minX = Math.max(0, minX - pad);
        minY = Math.max(0, minY - pad);
        maxX = Math.min(cssW, maxX + pad);
        maxY = Math.min(cssH, maxY + pad);
        const cw = Math.max(1, maxX - minX);
        const ch = Math.max(1, maxY - minY);

        const scale = 2; // export at 2× for crisp text
        const out = document.createElement("canvas");
        out.width = Math.round(cw * scale);
        out.height = Math.round(ch * scale);
        const ctx = out.getContext("2d");
        if (!ctx) return renderer.domElement.toDataURL("image/png");
        ctx.scale(scale, scale);

        ctx.fillStyle = cfg.theme.bg;
        ctx.fillRect(0, 0, cw, ch);

        // Draw the matching cropped region of the WebGL draw buffer.
        const buf = renderer.domElement;
        const bufScale = buf.width / cssW; // device px per css px
        ctx.drawImage(
          buf,
          minX * bufScale,
          minY * bufScale,
          cw * bufScale,
          ch * bufScale,
          0,
          0,
          cw,
          ch,
        );

        // Composite the labels on top.
        ctx.textBaseline = "top";
        for (const { x, y, el } of labels) {
          const fontPx = parseFloat(el.style.fontSize) || 12;
          const weight = el.style.fontWeight || "500";
          ctx.font = `${weight} ${fontPx}px ${labelFont}`;
          ctx.fillStyle = el.style.color || cfg.theme.text;
          ctx.globalAlpha = parseFloat(el.style.opacity || "1") || 1;
          // .hg-label padding is 1px 5px, so the text sits at +5 / +1.
          // Canvas fillText ignores newlines — draw multiline names line by line.
          const lines = (el.textContent || "").split("\n");
          lines.forEach((line, i) => {
            ctx.fillText(line, x - minX + 5, y - minY + 1 + i * fontPx * 1.25);
          });
        }
        ctx.globalAlpha = 1;

        // Subtle "✦ Constella" maker mark, bottom-right, with a bg-coloured halo
        // so it stays legible over any content. Toggleable (default on).
        if (mark) {
          const fs = 12.5;
          ctx.font = `600 ${fs}px ${labelFont}`;
          ctx.textBaseline = "alphabetic";
          const star = "✦";
          const name = " Constella";
          const starW = ctx.measureText(star).width;
          const nameW = ctx.measureText(name).width;
          const mx = cw - 14 - (starW + nameW);
          const my = ch - 13;
          ctx.save();
          ctx.globalAlpha = 0.78;
          ctx.shadowColor = cfg.theme.bg;
          ctx.shadowBlur = 5;
          ctx.fillStyle = cfg.theme.accent;
          ctx.fillText(star, mx, my);
          ctx.fillStyle = cfg.theme.muted;
          ctx.fillText(name, mx + starW, my);
          ctx.restore();
        }

        return out.toDataURL("image/png");
      } catch {
        return null;
      }
    },
    destroy() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      cvs.removeEventListener("pointerdown", onPointerDown);
      cvs.removeEventListener("pointermove", onPointerMove);
      cvs.removeEventListener("pointerup", onPointerUp);
      cvs.removeEventListener("pointercancel", onPointerCancel);
      cvs.removeEventListener("wheel", onWheel);
      renderer.dispose();
      textureCache.forEach((t) => t.dispose());
      pulseTex.dispose();
      container.classList.remove("hg-root");
      sceneEl.remove();
      labelsEl.remove();
      tooltipEl.remove();
      legendEl.remove();
    },
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
