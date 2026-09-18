import * as THREE from "three";
import type { GraphDocument, GraphNode } from "../types/graph";
import { buildGraphModel, edgeKey, mediaImageOf, type FocusModel } from "./core/model";
import { baseNodeOpacity, groupColor, nodeRadius } from "./core/style";
import {
  computePolarLayout,
  infinityWire,
  shapeLayoutOpts,
  shapeHasDust,
  type GraphShape,
} from "./core/layout";

/* ===========================================================================
   Standalone runtime for exported Constella artifacts — the render shell.
   Reads window.__GRAPH__ = { data, config } and renders into #app using the
   global THREE (inlined or CDN-loaded above this script).

   This file REPLACES the old hand-maintained ES5 mirror: all graph model,
   style and layout logic now comes from renderer/core/* — the same modules
   the in-app renderer uses — so the export can no longer drift from the app.
   Built by `npm run build:runtime` (vite.standalone.config.ts) into
   src/generated/standalone-runtime.js, which export/html.ts inlines.
   ========================================================================== */

interface StandalonePayload {
  data?: GraphDocument;
  config?: {
    theme?: Record<string, string>;
    palette?: string[];
    labelMode?: string;
    labelSize?: number;
    clickAction?: string;
    shape?: GraphShape;
  };
}

(() => {
  const ROOT = ((window as unknown as { __GRAPH__?: StandalonePayload }).__GRAPH__ ??
    {}) as StandalonePayload;
  const DATA: GraphDocument = ROOT.data ?? ({ nodes: [], links: [] } as unknown as GraphDocument);
  const CFG = ROOT.config ?? {};
  const THEME = CFG.theme ?? {};
  const PALETTE = CFG.palette && CFG.palette.length ? CFG.palette : ["#888"];
  const app = document.getElementById("app")!;
  // The graph fills #stage (below the chart title), not the whole #app.
  const stageEl = document.getElementById("stage") ?? app;
  const sceneEl = document.getElementById("scene")!;
  const labelsEl = document.getElementById("labels")!;
  const tip = document.getElementById("tooltip")!;
  // "Branch References" legend (left side); created here, populated on selection.
  const legendEl = document.createElement("div");
  legendEl.className = "hg-legend";
  legendEl.style.display = "none";
  stageEl.appendChild(legendEl);

  const mm = window.matchMedia;
  const TOUCH =
    (!!mm && mm("(pointer: coarse)").matches) || /[?&]touch=1\b/.test(location.search);
  const REDUCED = !!mm && mm("(prefers-reduced-motion: reduce)").matches;
  const LABEL_SIZE = TOUCH ? Math.max(CFG.labelSize || 12, 14) : CFG.labelSize || 12;

  // ---- shared model / style / layout (renderer/core) ----
  const model = buildGraphModel(DATA);
  const {
    byId,
    childrenOf,
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
  const depthCache = new Map(DATA.nodes.map((n) => [n.id, depthOf(n)]));
  const depth = (n: GraphNode) => depthCache.get(n.id)!;
  const color = (n: GraphNode) =>
    groupColor(groupOf(n), depth(n), groupOrder, PALETTE, THEME.accent || "#f97316");
  const radius = (n: GraphNode) =>
    nodeRadius(
      depth(n),
      (childrenOf.get(n.id) ?? []).length > 0,
      degree.get(n.id) ?? 0,
      !!n.metadata?.placeholder,
    );

  // Layout silhouette; older exports carry no shape and fall back to circle.
  const SHAPE: GraphShape = CFG.shape ?? "circle";
  const XY = computePolarLayout(DATA.nodes, depthOf, childrenOf, shapeLayoutOpts(SHAPE));
  const at = (id: string) => XY.get(id)!;

  let extent = 520;
  for (const n of DATA.nodes) extent = Math.max(extent, Math.hypot(at(n.id).x, at(n.id).y) + 90);
  // On touch, frame the root + first two rings so important nodes are legible.
  function extentForFit() {
    if (!SMALL) return extent;
    let m = 280;
    for (const n of DATA.nodes)
      if (depth(n) <= 2) m = Math.max(m, Math.hypot(at(n.id).x, at(n.id).y) + 70);
    return m;
  }
  function fitZoom() {
    return Math.max(0.18, Math.min(4.5, Math.min(W, H) / (extentForFit() * 2.05)));
  }

  // ---- three setup ----
  let W = stageEl.clientWidth || 800;
  let H = stageEl.clientHeight || 600;
  // Small viewports (embeds, touch) get tighter framing, bigger/visible lines,
  // and a less dominant root label so the graph reads at a glance.
  const SMALL = TOUCH || W < 760;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(W, H);
  sceneEl.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-W / 2, W / 2, H / 2, -H / 2, 0.1, 4000);
  cam.position.set(0, 0, 1000);
  cam.zoom = fitZoom();
  cam.updateProjectionMatrix();
  const grp = new THREE.Group();
  scene.add(grp);

  // Spiral shape ships a static backdrop of faint stars behind the graph.
  // Deterministic LCG, not Math.random, so reloads render the same sky; sits
  // well behind the graph's z so it never occludes or hit-tests.
  if (shapeHasDust(SHAPE)) {
    const N = 200;
    const pos = new Float32Array(N * 3);
    let seed = 42;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < N; i++) {
      const a = rand() * Math.PI * 2;
      const r = Math.sqrt(rand()) * extent * 1.45;
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

  // Infinity wire — mirrors the app: a faint stroke of the lemniscate the
  // branch heads sit on, the guide that makes the figure eight legible.
  if (SHAPE === "infinity") {
    const wpts = infinityWire().map((p) => new THREE.Vector3(p.x, p.y, -1));
    const wireGeo = new THREE.BufferGeometry().setFromPoints(wpts);
    const wire = new THREE.Line(
      wireGeo,
      new THREE.LineBasicMaterial({
        color: new THREE.Color(THEME.muted || "#a1a1aa"),
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
      }),
    );
    wire.raycast = () => {};
    grp.add(wire);
  }

  const texCache: Record<string, THREE.CanvasTexture> = {};
  function tex(c: string) {
    if (texCache[c]) return texCache[c];
    const s = 96;
    const cv = document.createElement("canvas");
    cv.width = cv.height = s;
    const x = cv.getContext("2d")!;
    x.fillStyle = c;
    x.beginPath();
    x.arc(s / 2, s / 2, 32, 0, Math.PI * 2);
    x.fill();
    x.lineWidth = 4;
    x.strokeStyle = THEME.bg || "#fff";
    x.stroke();
    const t = new THREE.CanvasTexture(cv);
    t.needsUpdate = true;
    texCache[c] = t;
    return t;
  }
  const sprites: Record<string, THREE.Sprite> = {};
  for (const n of DATA.nodes) {
    const m = new THREE.SpriteMaterial({
      map: tex(color(n)),
      transparent: true,
      depthWrite: false,
    });
    const sp = new THREE.Sprite(m);
    const sc = radius(n) * 2.2;
    sp.scale.set(sc, sc, 1);
    sp.position.set(at(n.id).x, at(n.id).y, 0);
    sp.userData.id = n.id;
    sprites[n.id] = sp;
    grp.add(sp);
  }
  interface LinkUD {
    s: string;
    t: string;
    ref: boolean;
  }
  const lines: THREE.Line[] = [];
  for (const l of DATA.links) {
    const ref = l.kind === "reference";
    const m = new THREE.LineBasicMaterial({
      color: new THREE.Color(
        ref ? THEME.referenceLink || "#8b84c7" : THEME.link || "#d4d4d8",
      ),
      transparent: true,
      opacity: ref ? 0.5 : 0.6,
      depthWrite: false,
    });
    const g = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(at(l.source).x, at(l.source).y, 0),
      new THREE.Vector3(at(l.target).x, at(l.target).y, 0),
    ]);
    const ln = new THREE.Line(g, m);
    ln.userData = { s: l.source, t: l.target, ref } satisfies LinkUD;
    lines.push(ln);
    grp.add(ln);
  }

  // ---- labels — a fixed pool of reusable elements (NOT one per node) ----
  const MAX_LABELS = SMALL ? 44 : 92;
  const labelPool: HTMLDivElement[] = [];
  for (let i = 0; i < MAX_LABELS; i++) {
    const le = document.createElement("div");
    le.className = "nlabel";
    le.style.display = "none";
    le.style.transform = "none";
    labelsEl.appendChild(le);
    labelPool.push(le);
  }
  // Reflow-free text measurement via an offscreen 2D context, cached by font+text.
  const measureCtx = document.createElement("canvas").getContext("2d");
  const labelFont =
    (typeof window.getComputedStyle === "function"
      ? getComputedStyle(labelsEl).fontFamily
      : "") || "system-ui, sans-serif";
  const textWidthCache: Record<string, number> = {};
  function measureLabel(text: string, fontPx: number, weight: number) {
    const key = fontPx + "|" + weight + "|" + text;
    let w = textWidthCache[key];
    if (w === undefined) {
      if (measureCtx) {
        measureCtx.font = weight + " " + fontPx + "px " + labelFont;
        w = measureCtx.measureText(text).width;
      } else {
        w = text.length * fontPx * 0.56;
      }
      textWidthCache[key] = w;
    }
    return w;
  }
  const v3 = new THREE.Vector3();
  let focusId: string | null = null;
  let hoverId: string | null = null;
  let focusModel: FocusModel | null = null;
  let zoom = cam.zoom;
  let targetZoom = zoom;
  let panX = 0,
    panY = 0,
    tPanX = 0,
    tPanY = 0;

  const currentKeep = () => (focusId ? focusChainSet(focusId) : null);

  function eligible(n: GraphNode, keep: Set<string> | null) {
    if (depth(n) === 0) return false; // root lives in the chart title + glow dot
    const lm = CFG.labelMode || "smart";
    if (lm === "none") return false;
    if (lm === "all") return true;
    if (lm === "parents") return depth(n) <= 1;
    if (depth(n) <= 1) return true;
    if (keep && keep.has(n.id)) return true;
    if (focusModel && focusModel.secondary.has(n.id)) return true;
    if (zoom > 1.6 && depth(n) <= 2) return true;
    if (zoom > 2.2) return true;
    return false;
  }
  // Label box geometry — mirrors .nlabel CSS (padding 1px 5px, line-height 1.25).
  const L_PAD_X = 5,
    L_PAD_Y = 1,
    L_LINE = 1.25,
    L_GAP = 9;
  const L_DIRS = [
    [1, 0],
    [1, 1],
    [0, 1],
    [-1, 1],
    [-1, 0],
    [-1, -1],
    [0, -1],
    [1, -1],
  ];
  const L_SEQ = [0, -1, 1, -2, 2, -3, 3, 4];
  function labelBox(x: number, y: number, dirIdx: number, bw: number, bh: number) {
    const dd = L_DIRS[dirIdx];
    const dl = Math.hypot(dd[0], dd[1]) || 1;
    const ux = dd[0] / dl,
      uy = dd[1] / dl;
    const half = Math.abs(ux) * (bw / 2) + Math.abs(uy) * (bh / 2);
    return [x + ux * (L_GAP + half) - bw / 2, y + uy * (L_GAP + half) - bh / 2];
  }
  // Label hit boxes (canvas-space), filled by updateLabels — clicking/hovering
  // a label counts as its node.
  let labelRects: Record<string, { x: number; y: number; w: number; h: number }> = {};
  function updateLabels() {
    const keep = currentKeep();
    const r = renderer.domElement.getBoundingClientRect();
    labelRects = {}; // rebuilt for visible labels (label-as-node hits)
    // Graph centre on screen (root projection) → labels fan radially outward.
    let cx = r.width / 2,
      cy = r.height / 2;
    if (rootId && sprites[rootId]) {
      sprites[rootId].getWorldPosition(v3);
      v3.project(cam);
      cx = (v3.x * 0.5 + 0.5) * r.width;
      cy = (-v3.y * 0.5 + 0.5) * r.height;
    }
    // 1) gather eligible, on-screen candidates with score (lower = more important)
    interface Cand {
      n: GraphNode;
      d: number;
      x: number;
      y: number;
      score: number;
    }
    const cands: Cand[] = [];
    const margin = 48;
    for (const n of DATA.nodes) {
      if (!eligible(n, keep)) continue;
      sprites[n.id].getWorldPosition(v3);
      v3.project(cam);
      if (v3.z < -1 || v3.z > 1) continue;
      const x = (v3.x * 0.5 + 0.5) * r.width,
        y = (-v3.y * 0.5 + 0.5) * r.height;
      if (x < -margin || x > r.width + margin || y < -margin || y > r.height + margin)
        continue;
      const d = depth(n);
      const must =
        (keep && keep.has(n.id)) ||
        n.id === hoverId ||
        (focusModel && focusModel.refTargets.has(n.id));
      const score = (must ? -1000 : 0) + d * 10 - Math.min(degree.get(n.id) ?? 0, 30) * 0.3;
      cands.push({ n, d, x, y, score });
    }
    cands.sort((a, b) => a.score - b.score);
    // 2) place greedily, anchored radially outward; cap at the pool size
    const placed: { x: number; y: number; w: number; h: number }[] = [];
    const free = (bx: number, by: number, bw: number, bh: number) => {
      for (const p of placed)
        if (bx < p.x + p.w && bx + bw > p.x && by < p.y + p.h && by + bh > p.y)
          return false;
      return true;
    };
    let slot = 0;
    for (let ci = 0; ci < cands.length && slot < labelPool.length; ci++) {
      const c = cands[ci],
        nn = c.n,
        dd2 = c.d,
        px = c.x,
        py = c.y,
        id = nn.id;
      const prominent =
        dd2 <= 1 ||
        (keep && keep.has(id)) ||
        (focusModel && focusModel.refTargets.has(id));
      const depthMult = dd2 === 0 ? (SMALL ? 1.08 : 1.18) : dd2 === 1 ? 1.05 : 1;
      const fontPx = Math.max(8, Math.round(LABEL_SIZE * depthMult * (prominent ? 1 : 0.8)));
      const weight = dd2 === 0 ? 700 : dd2 <= 1 ? 600 : 500;
      const bw = measureLabel(nn.name, fontPx, weight) + 2 * L_PAD_X;
      const bh = fontPx * L_LINE + 2 * L_PAD_Y;
      let primary = Math.round(Math.atan2(py - cy, px - cx) / (Math.PI / 4));
      primary = ((primary % 8) + 8) % 8;
      let boxX = 0,
        boxY = 0,
        found = false;
      for (let s = 0; s < L_SEQ.length; s++) {
        const b = labelBox(px, py, (((primary + L_SEQ[s]) % 8) + 8) % 8, bw, bh);
        if (free(b[0], b[1], bw, bh)) {
          boxX = b[0];
          boxY = b[1];
          found = true;
          break;
        }
      }
      if (!found) {
        if (!prominent) continue;
        const pb = labelBox(px, py, primary, bw, bh);
        boxX = pb[0];
        boxY = pb[1];
      }
      const e = labelPool[slot++];
      if (e.dataset.id !== id) {
        e.textContent = nn.name;
        e.dataset.id = id;
      }
      e.style.display = "block";
      e.style.left = boxX + "px";
      e.style.top = boxY + "px";
      e.style.fontSize = fontPx + "px";
      e.style.fontWeight = "" + weight;
      e.style.color =
        focusModel && focusModel.refTargets.has(id)
          ? THEME.accent || "#f97316"
          : dd2 <= 1 || (keep && keep.has(id))
            ? THEME.text || "#111"
            : THEME.muted || "#777";
      e.style.opacity = keep
        ? keep.has(id)
          ? "1"
          : focusModel && focusModel.refTargets.has(id)
            ? "0.95"
            : focusModel && focusModel.secondary.has(id)
              ? "0.55"
              : "0.22"
        : dd2 <= 1
          ? "1"
          : "0.72";
      placed.push({ x: boxX, y: boxY, w: bw, h: bh });
      labelRects[id] = { x: boxX - 3, y: boxY - 3, w: bw + 6, h: bh + 6 };
    }
    for (let hs = slot; hs < labelPool.length; hs++) {
      const he = labelPool[hs];
      if (he.style.display !== "none") {
        he.style.display = "none";
        he.removeAttribute("data-id");
      }
    }
  }
  function highlight() {
    const keep = currentKeep();
    const edges = focusId ? focusEdgeSet(focusId) : null;
    for (const n of DATA.nodes) {
      const sp = sprites[n.id];
      sp.material.opacity = keep
        ? keep.has(n.id)
          ? 1
          : focusModel && focusModel.refTargets.has(n.id)
            ? 0.85
            : focusModel && focusModel.grand.has(n.id)
              ? 0.5
              : 0.26
        : baseNodeOpacity(depth(n));
      // Path nodes sit ON the trunk as distinct, slightly larger dots.
      const onPath = !!keep && keep.has(n.id);
      const foc = n.id === focusId;
      sp.renderOrder = onPath ? 3 : 0;
      const sc = radius(n) * 2.2 * (foc ? 1.4 : onPath ? 1.26 : 1);
      sp.scale.set(sc, sc, 1);
    }
    for (const ln of lines) {
      const u = ln.userData as LinkUD;
      const hit = edges
        ? edges.has(edgeKey(u.s, u.t))
        : !!focusId && (u.s === focusId || u.t === focusId);
      const trunk = !keep && isTrunk({ s: u.s, t: u.t, ref: u.ref });
      const mat = ln.material as THREE.LineBasicMaterial;
      mat.opacity = hit
        ? 0.9
        : keep
          ? 0.12
          : trunk
            // Infinity: the thick pass owns trunk rendering (the thin fan
            // underneath doubled the wiring).
            ? SHAPE === "infinity"
              ? 0
              : SMALL
                ? 0.7
                : 0.55
            : u.ref
              ? SMALL
                ? 0.4
                : 0.28
              : SMALL
                ? 0.36
                : 0.24;
      mat.color.set(
        hit && focusId
          ? color(byId.get(focusId)!)
          : trunk
            ? THEME.accent || "#f97316"
            : u.ref
              ? THEME.referenceLink || "#8b84c7"
              : // --link (border-muted) is near-invisible on a light bg; at embed
                // sizes use the more contrasty muted text color instead.
                SMALL
                ? THEME.muted || "#a1a1aa"
                : THEME.link || "#d4d4d8",
      );
    }
  }

  // Auto-zoom so the node + its children fill the viewport (touch focus).
  function frameFocus(id: string) {
    const pts = [at(id)];
    for (const c of childrenOf.get(id) ?? []) pts.push(at(c.id));
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const p of pts) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }
    const spanX = Math.max(maxX - minX, 160),
      spanY = Math.max(maxY - minY, 160),
      pad = 1.7;
    tPanX = (minX + maxX) / 2;
    tPanY = (minY + maxY) / 2;
    targetZoom = Math.max(
      0.18,
      Math.min(4.5, Math.min(W / (spanX * pad), H / (spanY * pad))),
    );
  }

  function esc(s: string) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function showTip(n: GraphNode, ev: { clientX: number; clientY: number }) {
    if (TOUCH) return;
    const meta = (n.metadata ?? {}) as Record<string, unknown>;
    let rows = "";
    // image/cover feed the cover art above — don't repeat them as text rows.
    for (const k of Object.keys(meta)
      .filter((k) => k !== "image" && k !== "cover")
      .slice(0, 6))
      rows += "<span><b>" + esc(k) + "</b> " + esc(String(meta[k])) + "</span>";
    const refs = refNeighbors.get(n.id) ?? [];
    let refRows = "";
    if (refs.length) {
      refRows =
        '<div class="tt-refs"><span class="tt-refs-label">References</span>' +
        refs
          .slice(0, 6)
          .map((r) => '<span class="tt-ref">' + esc(r.name) + "</span>")
          .join("") +
        "</div>";
    }
    const media = mediaImageOf(n);
    // When the node has a url, the cover art is the link and the url line is a
    // real anchor — reachable because the tip is sticky (see the hover loop).
    const href = n.url ? esc(n.url) : null;
    const img = media
      ? '<img class="tt-media" src="' + esc(media) + '" alt="" loading="lazy" onerror="this.remove()" />'
      : "";
    const mediaHtml =
      media && href
        ? '<a class="tt-medialink" href="' + href + '" target="_blank" rel="noopener noreferrer">' + img + "</a>"
        : img;
    tip.innerHTML =
      mediaHtml +
      '<div class="tt-name">' +
      esc(n.name) +
      '</div><div class="tt-path">' +
      esc(pathOf(n)) +
      "</div>" +
      (rows ? '<div class="tt-meta">' + rows + "</div>" : "") +
      refRows +
      (href ? '<a class="tt-url" href="' + href + '" target="_blank" rel="noopener noreferrer">' + esc(n.url as string) + "</a>" : "");
    tip.classList.add("show");
    const r = stageEl.getBoundingClientRect();
    let x = ev.clientX - r.left + 14,
      y = ev.clientY - r.top + 14;
    if (x + tip.offsetWidth > r.width) x -= tip.offsetWidth + 28;
    if (y + tip.offsetHeight > r.height) y -= tip.offsetHeight + 28;
    tip.style.left = x + "px";
    tip.style.top = y + "px";
  }
  function hideTip() {
    tip.classList.remove("show");
  }
  function updateLegend() {
    const refs = focusModel && focusModel.refList;
    if (!refs || !refs.length) {
      legendEl.style.display = "none";
      legendEl.innerHTML = "";
      return;
    }
    const nameOf = (nid: string) => byId.get(nid)?.name ?? nid;
    const rows = refs
      .map(
        (r) =>
          '<li class="hg-legend__row"><span class="hg-legend__from">' +
          esc(nameOf(r.from)) +
          '</span><span class="hg-legend__arrow">→</span><span class="hg-legend__to">' +
          esc(nameOf(r.to)) +
          "</span></li>",
      )
      .join("");
    legendEl.innerHTML =
      '<div class="hg-legend__title">Branch References</div><ul class="hg-legend__list">' +
      rows +
      "</ul>";
    legendEl.style.display = "block";
  }

  /* INTERACTION MATRIX (mirror of the app renderer): selection is the only
     state; hover is transient tooltip feedback. setSelection() is the sole
     mutator. Default + click M -> Selected(M). Selected(N) + click M:
     M=N -> Default, else Selected(M). Click empty -> Default. Hover only shows
     a tooltip. Drag pans, pinch/wheel zooms; neither touches the selection.
     "node M" = resolveHit(): disc -> label box -> nearest within radius. */
  function setSelection(id: string | null) {
    focusId = id;
    focusModel = id ? computeFocus(id) : null;
    highlight();
    rebuildFocusPairs();
    updateLegend();
    if (id && TOUCH) frameFocus(id);
  }

  // ---- picking ----
  const ray = new THREE.Raycaster(),
    m2 = new THREE.Vector2(),
    cvs = renderer.domElement;
  function pick(ev: { clientX: number; clientY: number }) {
    const r = cvs.getBoundingClientRect();
    m2.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
    m2.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
    ray.setFromCamera(m2, cam);
    const hit = ray.intersectObjects(
      DATA.nodes.map((n) => sprites[n.id]),
      false,
    );
    return hit.length ? byId.get(hit[0].object.userData.id as string) ?? null : null;
  }
  function nearestNode(ev: { clientX: number; clientY: number }, maxPx = 34) {
    const r = cvs.getBoundingClientRect(),
      px = ev.clientX - r.left,
      py = ev.clientY - r.top;
    let best: GraphNode | null = null,
      bestD = Infinity;
    for (const n of DATA.nodes) {
      sprites[n.id].getWorldPosition(v3);
      v3.project(cam);
      if (v3.z < -1 || v3.z > 1) continue;
      const x = (v3.x * 0.5 + 0.5) * r.width,
        y = (-v3.y * 0.5 + 0.5) * r.height,
        d = Math.hypot(x - px, y - py);
      if (d < bestD) {
        bestD = d;
        best = n;
      }
    }
    return bestD <= maxPx ? best : null;
  }
  function labelHit(ev: { clientX: number; clientY: number }) {
    const r = cvs.getBoundingClientRect(),
      px = ev.clientX - r.left,
      py = ev.clientY - r.top;
    for (const id in labelRects) {
      const b = labelRects[id];
      if (px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h)
        return byId.get(id) ?? null;
    }
    return null;
  }
  // The single hit target: disc -> label box -> nearest within a forgiving radius.
  const resolveHit = (ev: { clientX: number; clientY: number }) =>
    pick(ev) ?? labelHit(ev) ?? nearestNode(ev, TOUCH ? 36 : 22);

  // ---- pointer interaction (pan, pinch-zoom, tap/click focus) ----
  const pointers: Record<number, { x: number; y: number }> = {};
  let pinch: { dist: number; zoom: number } | null = null;
  let down = false,
    drag = false,
    mv = 0,
    sx = 0,
    sy = 0,
    opx = 0,
    opy = 0;
  const pcount = () => Object.keys(pointers).length;
  function pdist() {
    const k = Object.keys(pointers) as unknown as number[],
      a = pointers[k[0]],
      b = pointers[k[1]];
    return Math.hypot(a.x - b.x, a.y - b.y) || 1;
  }
  function beginPan(x: number, y: number) {
    sx = x;
    sy = y;
    opx = tPanX;
    opy = tPanY;
  }
  cvs.addEventListener("pointerdown", (e) => {
    pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    down = true;
    drag = false;
    mv = 0;
    cvs.setPointerCapture(e.pointerId);
    if (pcount() === 1) {
      pinch = null;
      beginPan(e.clientX, e.clientY);
    } else if (pcount() === 2) {
      pinch = { dist: pdist(), zoom: targetZoom };
      drag = true;
    }
  });
  cvs.addEventListener("pointermove", (e) => {
    if (pointers[e.pointerId]) pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    if (pcount() >= 2 && pinch) {
      targetZoom = Math.max(0.18, Math.min(4.5, (pinch.zoom * pdist()) / pinch.dist));
      return;
    }
    if (down && pcount() === 1) {
      const dx = e.clientX - sx,
        dy = e.clientY - sy;
      mv = Math.max(mv, Math.abs(dx) + Math.abs(dy));
      if (mv > 3) {
        drag = true;
        if (!TOUCH) cvs.style.cursor = "grabbing";
        if (hoverId !== null) {
          hoverId = null;
          hideTip();
        } // a pan strands the anchored tip
      }
      tPanX = opx - dx / zoom;
      tPanY = opy + dy / zoom;
    } else if (!down && !TOUCH) {
      const n = resolveHit(e);
      cvs.style.cursor = n ? "pointer" : "default";
      // Sticky tooltip: anchor on a NEW node, don't chase the cursor, and don't
      // hide on empty space — so you can move onto the card and click its link.
      // Another node replaces it; drag / click / zoom / leaving dismiss it.
      if (n && hoverId !== n.id) {
        hoverId = n.id;
        showTip(n, e);
      }
    }
  });
  cvs.addEventListener("pointerup", (e) => {
    const wasPinch = pcount() >= 2;
    delete pointers[e.pointerId];
    if (down && !drag && !wasPinch) {
      const n = resolveHit(e);
      // Any canvas click clears the sticky tip (the link inside is a DOM anchor
      // click, not a canvas event, so it still navigates).
      hoverId = null;
      hideTip();
      if (n && CFG.clickAction === "url" && n.url && !TOUCH) {
        window.open(n.url, "_blank", "noopener");
      } else {
        const id = n ? n.id : null;
        setSelection(id !== null && id === focusId ? null : id); // matrix
      }
    }
    if (pcount() < 2) pinch = null;
    if (pcount() === 1) {
      const k = Object.keys(pointers)[0] as unknown as number;
      beginPan(pointers[k].x, pointers[k].y);
      drag = true;
    } else if (pcount() === 0) {
      down = false;
      if (!TOUCH) cvs.style.cursor = "default";
    }
  });
  cvs.addEventListener("pointercancel", (e) => {
    delete pointers[e.pointerId];
    if (pcount() < 2) pinch = null;
    if (pcount() === 0) down = false;
  });
  cvs.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      if (hoverId !== null) {
        hoverId = null;
        hideTip();
      } // a zoom strands the anchored tip
      targetZoom = Math.max(0.18, Math.min(4.5, targetZoom * Math.exp(-e.deltaY * 0.0012)));
    },
    { passive: false },
  );
  // Leaving the canvas dismisses the sticky tip — unless the pointer is moving
  // onto the tip itself.
  cvs.addEventListener("pointerleave", (e) => {
    const rt = (e as PointerEvent).relatedTarget;
    if (rt instanceof Node && tip.contains(rt)) return;
    if (!TOUCH) {
      hoverId = null;
      hideTip();
    }
  });

  // ---- ambient link pulses (faint glints + focused through-line) ----
  const pulseTex = (() => {
    const s = 64;
    const cv = document.createElement("canvas");
    cv.width = cv.height = s;
    const x = cv.getContext("2d")!;
    const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.35, "rgba(255,255,255,0.55)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, s, s);
    const t = new THREE.CanvasTexture(cv);
    t.needsUpdate = true;
    return t;
  })();
  const glowMat = () =>
    new THREE.SpriteMaterial({
      map: pulseTex,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0,
    });
  // Soft glow behind the selected node.
  const selGlow = new THREE.Sprite(glowMat());
  selGlow.renderOrder = 2;
  selGlow.visible = false;
  grp.add(selGlow);
  function updateSelGlow(now: number) {
    if (focusId && XY.has(focusId)) {
      selGlow.visible = true;
      selGlow.position.set(at(focusId).x, at(focusId).y, 0.4);
      const sz = radius(byId.get(focusId)!) * 2.2 * 3.6;
      selGlow.scale.set(sz, sz, 1);
      selGlow.material.color.set(color(byId.get(focusId)!));
      selGlow.material.opacity = REDUCED ? 0.42 : 0.34 + 0.1 * Math.sin(now * 0.004);
    } else {
      selGlow.visible = false;
    }
  }
  // Persistent gentle glow on the root (its label lives in the chart title).
  const rootGlow = new THREE.Sprite(glowMat());
  rootGlow.renderOrder = 1;
  rootGlow.visible = false;
  grp.add(rootGlow);
  function updateRootGlow(now: number) {
    if (rootId && XY.has(rootId)) {
      rootGlow.visible = true;
      rootGlow.position.set(at(rootId).x, at(rootId).y, 0.3);
      const sz = radius(byId.get(rootId)!) * 2.2 * 3.2;
      rootGlow.scale.set(sz, sz, 1);
      rootGlow.material.color.set(THEME.accent || "#f97316");
      rootGlow.material.opacity = REDUCED ? 0.3 : 0.24 + 0.12 * Math.sin(now * 0.0032);
    } else {
      rootGlow.visible = false;
    }
  }
  // Faint pulsing aura behind each node on the selected path ("connect the dots").
  const auraPool: THREE.Sprite[] = [];
  function getAura(i: number) {
    while (auraPool.length <= i) {
      const a = new THREE.Sprite(glowMat());
      a.renderOrder = 2;
      a.visible = false;
      grp.add(a);
      auraPool.push(a);
    }
    return auraPool[i];
  }
  function updateWaypointAura(now: number) {
    let n = 0;
    const keep = currentKeep();
    if (keep) {
      for (const nd of DATA.nodes) {
        if (!keep.has(nd.id) || nd.id === rootId) continue;
        const a = getAura(n++);
        a.visible = true;
        a.position.set(at(nd.id).x, at(nd.id).y, 0.45);
        const sz = radius(nd) * 2.2 * 3.0;
        a.scale.set(sz, sz, 1);
        a.material.color.set(color(nd));
        a.material.opacity = REDUCED ? 0.22 : 0.16 + 0.1 * Math.sin(now * 0.004 + n * 0.8);
      }
    }
    for (; n < auraPool.length; n++) auraPool[n].visible = false;
  }

  // ---- thick "active" connectors -------------------------------------------
  // WebGL line width is capped at 1px, so the trunk / focused path read as
  // hairlines. Draw the active connections as solid quad meshes (real width,
  // near-full opacity) so they're unmistakably connected.
  const thickPool: THREE.Mesh[] = [];
  const gradA = new THREE.Color(),
    gradB = new THREE.Color();
  function getThick(i: number) {
    while (thickPool.length <= i) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(12), 3));
      geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(12), 3));
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
      grp.add(m);
      thickPool.push(m);
    }
    return thickPool[i];
  }
  function updateThickLines() {
    const keep = currentKeep();
    const edges = focusId ? focusEdgeSet(focusId) : null;
    const hw = (SMALL ? 2.0 : 1.4) / zoom; // half-width in world units (~constant px)
    let n = 0;
    // Infinity trunks whisper — mirrors the app renderer: direct root→bead
    // threads, thin and faint, so many-branch manifests don't knot.
    const whisper = SHAPE === "infinity" && !keep && !edges;
    const jobs: {
      ax: number; ay: number; bx: number; by: number;
      cA: string; cB: string; w: number; op: number;
    }[] = [];
    for (const ln of lines) {
      const u = ln.userData as LinkUD;
      const k = edgeKey(u.s, u.t);
      const trunk = isTrunk({ s: u.s, t: u.t, ref: u.ref });
      const full = edges ? edges.has(k) : !keep && trunk;
      const grand = !full && focusModel && focusModel.grandEdges.has(k);
      if (!full && !grand) continue;
      const a = at(u.s),
        b = at(u.t);
      const soft = whisper && trunk;
      jobs.push({
        ax: a.x, ay: a.y, bx: b.x, by: b.y,
        cA: color(byId.get(u.s)!), cB: color(byId.get(u.t)!),
        w: grand ? hw * 0.6 : soft ? hw * 0.5 : hw,
        op: grand ? 0.5 : soft ? 0.45 : 0.95,
      });
    }
    for (const j of jobs) {
      const dx = j.bx - j.ax,
        dy = j.by - j.ay,
        len = Math.hypot(dx, dy) || 1;
      const px = (-dy / len) * j.w,
        py = (dx / len) * j.w;
      const m = getThick(n++);
      const arr = (m.geometry.attributes.position as THREE.BufferAttribute)
        .array as Float32Array;
      arr[0] = j.ax + px;
      arr[1] = j.ay + py;
      arr[2] = 1;
      arr[3] = j.ax - px;
      arr[4] = j.ay - py;
      arr[5] = 1;
      arr[6] = j.bx - px;
      arr[7] = j.by - py;
      arr[8] = 1;
      arr[9] = j.bx + px;
      arr[10] = j.by + py;
      arr[11] = 1;
      (m.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      // Gradient along the link: source colour (verts 0,1) → target colour (2,3).
      const carr = (m.geometry.attributes.color as THREE.BufferAttribute)
        .array as Float32Array;
      gradA.set(j.cA);
      gradB.set(j.cB);
      carr[0] = carr[3] = gradA.r;
      carr[1] = carr[4] = gradA.g;
      carr[2] = carr[5] = gradA.b;
      carr[6] = carr[9] = gradB.r;
      carr[7] = carr[10] = gradB.g;
      carr[8] = carr[11] = gradB.b;
      (m.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
      m.visible = true;
      (m.material as THREE.MeshBasicMaterial).opacity = j.op;
    }
    for (; n < thickPool.length; n++) thickPool[n].visible = false;
  }
  // hover preview: a light root->node through-line for the hovered node (desktop)
  const hoverPool: THREE.Mesh[] = [];
  function getHoverLine(i: number) {
    while (hoverPool.length <= i) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(12), 3));
      geo.setIndex([0, 1, 2, 0, 2, 3]);
      const mat = new THREE.MeshBasicMaterial({
        transparent: true,
        depthTest: false,
        depthWrite: false,
      });
      const m = new THREE.Mesh(geo, mat);
      m.renderOrder = 1;
      m.frustumCulled = false;
      grp.add(m);
      hoverPool.push(m);
    }
    return hoverPool[i];
  }
  function updateHoverPath() {
    let n = 0;
    if (hoverId && hoverId !== focusId && !TOUCH && byId.has(hoverId)) {
      const ch = parentChain(byId.get(hoverId)!); // node -> ... -> root
      const hw = (SMALL ? 1.0 : 0.75) / zoom;
      const col = color(byId.get(hoverId)!);
      for (let i = 0; i < ch.length - 1; i++) {
        const a = at(ch[i].id),
          b = at(ch[i + 1].id);
        const dx = b.x - a.x,
          dy = b.y - a.y,
          len = Math.hypot(dx, dy) || 1;
        const px = (-dy / len) * hw,
          py = (dx / len) * hw;
        const m = getHoverLine(n++);
        const arr = (m.geometry.attributes.position as THREE.BufferAttribute)
          .array as Float32Array;
        arr[0] = a.x + px;
        arr[1] = a.y + py;
        arr[2] = 0.6;
        arr[3] = a.x - px;
        arr[4] = a.y - py;
        arr[5] = 0.6;
        arr[6] = b.x - px;
        arr[7] = b.y - py;
        arr[8] = 0.6;
        arr[9] = b.x + px;
        arr[10] = b.y + py;
        arr[11] = 0.6;
        (m.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
        m.visible = true;
        (m.material as THREE.MeshBasicMaterial).color.set(col);
        (m.material as THREE.MeshBasicMaterial).opacity = 0.5;
      }
    }
    for (; n < hoverPool.length; n++) hoverPool[n].visible = false;
  }
  const hierLinks = DATA.links.filter((l) => l.kind !== "reference");
  const TRAIL = 3,
    BG_PULSES = TOUCH ? 6 : 12,
    FOCUS_SLOTS = 5;
  let focusPairs: [string, string][] = [];
  function rebuildFocusPairs() {
    focusPairs = [];
    const id = focusId;
    const node = id ? byId.get(id) : null;
    if (!node || !id) return;
    const ch = parentChain(node);
    for (let i = 0; i < ch.length - 1; i++) focusPairs.push([ch[i].id, ch[i + 1].id]);
    for (const c of childrenOf.get(id) ?? []) focusPairs.push([id, c.id]);
  }
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  interface Pulse {
    sprites: THREE.Sprite[];
    s: string;
    t: string;
    start: number;
    dur: number;
    focus: boolean;
    focusSlot: boolean;
    color: THREE.Color;
  }
  const pulses: Pulse[] = [];
  function respawn(p: Pulse, now: number) {
    p.start = now + Math.random() * 280;
    if (p.focusSlot && focusPairs.length) {
      const pr = focusPairs[(Math.random() * focusPairs.length) | 0];
      p.s = pr[0];
      p.t = pr[1];
      p.focus = true;
      p.dur = 900 + Math.random() * 900;
      p.color.set(focusId ? color(byId.get(focusId)!) : THEME.accent || "#f97316");
    } else if (hierLinks.length) {
      const l = hierLinks[(Math.random() * hierLinks.length) | 0];
      p.s = l.source;
      p.t = l.target;
      p.focus = false;
      p.dur = 1600 + Math.random() * 1500;
      p.color.set(THEME.accent || "#f97316");
    }
  }
  function initPulses(now: number) {
    if (!hierLinks.length || !DATA.nodes.length) return;
    for (let i = 0; i < BG_PULSES + FOCUS_SLOTS; i++) {
      const sps: THREE.Sprite[] = [];
      for (let k = 0; k < TRAIL + 1; k++) {
        const sp = new THREE.Sprite(glowMat());
        sp.renderOrder = 3;
        sp.visible = false;
        grp.add(sp);
        sps.push(sp);
      }
      const p: Pulse = {
        sprites: sps,
        s: DATA.nodes[0].id,
        t: DATA.nodes[0].id,
        start: now + Math.random() * 2000,
        dur: 2000,
        focus: false,
        focusSlot: i >= BG_PULSES,
        color: new THREE.Color(THEME.accent || "#f97316"),
      };
      respawn(p, now);
      pulses.push(p);
    }
  }
  let pulsesReady = false;
  function updatePulses(now: number) {
    if (REDUCED) return;
    if (!pulsesReady) {
      initPulses(now);
      pulsesReady = true;
    }
    for (const p of pulses) {
      if (p.focusSlot && p.focus && !focusPairs.length) respawn(p, now);
      const elapsed = now - p.start;
      if (elapsed < 0) {
        for (const sp of p.sprites) sp.visible = false;
        continue;
      }
      if (elapsed > p.dur) {
        respawn(p, now);
        continue;
      }
      const prog = elapsed / p.dur,
        peak = Math.sin(prog * Math.PI),
        baseOp = (p.focus ? 0.5 : 0.15) * peak;
      const sX = at(p.s),
        tX = at(p.t);
      for (let i = 0; i < p.sprites.length; i++) {
        const sp = p.sprites[i],
          tp = prog - i * 0.05;
        if (tp < 0 || tp > 1) {
          sp.visible = false;
          continue;
        }
        sp.visible = true;
        sp.position.set(lerp(sX.x, tX.x, tp), lerp(sX.y, tX.y, tp), 1);
        const sz = (p.focus ? 24 : 16) * (1 - i * 0.2);
        sp.scale.set(sz, sz, 1);
        sp.material.opacity = baseOp * (1 - i / (p.sprites.length + 1));
        sp.material.color.copy(p.color);
      }
    }
  }

  function tick(now: number) {
    panX += (tPanX - panX) * 0.18;
    panY += (tPanY - panY) * 0.18;
    zoom += (targetZoom - zoom) * 0.18;
    cam.position.x = panX;
    cam.position.y = panY;
    cam.zoom = zoom;
    cam.updateProjectionMatrix();
    updatePulses(now || 0);
    updateRootGlow(now || 0);
    updateWaypointAura(now || 0);
    updateSelGlow(now || 0);
    updateThickLines();
    updateHoverPath();
    updateLabels();
    renderer.render(scene, cam);
    requestAnimationFrame(tick);
  }
  highlight(); // apply the default hero state (depth recession + lit trunk)
  requestAnimationFrame(tick);
  window.addEventListener("resize", () => {
    W = stageEl.clientWidth;
    H = stageEl.clientHeight;
    renderer.setSize(W, H);
    cam.left = -W / 2;
    cam.right = W / 2;
    cam.top = H / 2;
    cam.bottom = -H / 2;
    targetZoom = zoom = fitZoom();
    cam.updateProjectionMatrix();
  });
})();
