import * as d3 from "d3";
import type { GraphDocument } from "../types/graph";
import type { HybridGraphHandle } from "./hybridGraph";
import { createBranchLegend } from "./branchLegend";
import { mediaImageOf } from "./core/model";

/* Shared categorical palette (OKLCH-designed) — same groups, same colours as
   the graph view. */
import { DEFAULT_NODE_PALETTE as PALETTE } from "../app/graphTheme";

type NodeDatum = { id: string; parentId: string | null; name: string; group?: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyNode = d3.HierarchyRectangularNode<NodeDatum> & Record<string, any>;

function readToken(prop: string, fallback: string): string {
  return (
    getComputedStyle(document.documentElement).getPropertyValue(prop).trim() ||
    fallback
  );
}

export function mountSunburst(
  container: HTMLElement,
  doc: GraphDocument,
): HybridGraphHandle {
  const groupMap = new Map<string, string>();

  function colorOf(node: AnyNode): string {
    let n: AnyNode = node;
    while (n.depth > 1 && n.parent) n = n.parent as AnyNode;
    const key = n.data.group || n.data.name;
    if (!groupMap.has(key)) groupMap.set(key, PALETTE[groupMap.size % PALETTE.length]);
    return groupMap.get(key)!;
  }

  const stratNodes: NodeDatum[] = doc.nodes.map((n) => ({
    id: n.id,
    parentId: n.parent ?? null,
    name: n.name,
    group: n.group,
  }));
  const refs = doc.links.filter((l) => l.kind === "reference");

  // Sunburst needs a single root — d3.stratify throws on a forest. When the
  // graph legitimately has multiple top-level nodes, wrap them under a virtual
  // centre for THIS view only; the data model keeps its real roots.
  const tops = stratNodes.filter((n) => n.parentId === null);
  if (tops.length > 1) {
    const VROOT = "__sunburst_root__";
    for (const n of tops) n.parentId = VROOT;
    stratNodes.unshift({ id: VROOT, parentId: null, name: "Graph" });
  }

  const root = d3
    .stratify<NodeDatum>()
    .id((d) => d.id)
    .parentId((d) => d.parentId)(stratNodes) as AnyNode;

  let W = container.clientWidth || 960;
  let H = container.clientHeight || 640;
  // Visible arcs span up to 4 ring units (arcVis: y1 <= 4), so the drawn circle
  // reaches 4 × radius from centre. The "crust" — the first-level group labels
  // on a tinted band — sits outside that; reserve room for it too.
  const CRUST_GAP = 4;
  const CRUST_W = 20;
  // Outer margin: keeps the crust off the canvas edge AND leaves room for the
  // ambient dots the crust sprays outward (see dotFrame).
  const radiusFor = (w: number, h: number) =>
    (Math.min(w, h) / 2 - 36 - CRUST_GAP - CRUST_W) / 4;
  let radius = radiusFor(W, H);

  // Width by LEAF count (count), not total-node count (sum(() => 1)). sum adds
  // 1 for the node itself, so a parent's value exceeds the sum of its children
  // and partition fills each wedge only partway — every ring boundary lands a
  // little short, so the radial edges jog instead of running straight. count()
  // makes a parent's value equal its children's sum exactly, so children fill
  // the wedge edge-to-edge and every boundary aligns center-to-crust.
  root.count();
  d3.partition<NodeDatum>().size([2 * Math.PI, root.height + 1])(root);

  // Widen ONLY the gaps between the top-level pies. Inset each depth-1 group's
  // angular span by GROUP_GAP/2 on each side and linearly rescale its whole
  // subtree to fit: a linear remap preserves the leaf-count fill, so every
  // internal boundary stays aligned, while a clean radial channel opens between
  // adjacent groups. Inner section gaps are still just the hairline stroke.
  const GROUP_GAP = 0.05; // radians of separation between adjacent top-level pies
  for (const group of (root.children ?? []) as AnyNode[]) {
    const gx0 = group.x0;
    const span = group.x1 - gx0;
    if (span <= GROUP_GAP) continue;
    const nx0 = gx0 + GROUP_GAP / 2;
    const k = (span - GROUP_GAP) / span;
    group.each((d: AnyNode) => {
      d.x0 = nx0 + (d.x0 - gx0) * k;
      d.x1 = nx0 + (d.x1 - gx0) * k;
    });
  }

  root.each((d: AnyNode) => (d.current = d));

  // Separators come from a uniform background-coloured stroke on each arc (set
  // on the paths below), NOT angular padding. padAngle with a fixed padRadius
  // produced gaps whose angular width shrank as the ring radius grew, so a
  // parent's edge no longer lined up with its children's — the "jagged" steps.
  // A stroke traces each arc's real edges, so every separator is the same width
  // and every parent/child boundary aligns.
  const arc = d3
    .arc<AnyNode>()
    .startAngle((d) => d.x0)
    .endAngle((d) => d.x1)
    .innerRadius((d) => d.y0 * radius)
    .outerRadius((d) => Math.max(d.y0 * radius, d.y1 * radius));

  function arcVis(d: AnyNode) { return d.y1 <= 4 && d.y0 >= 1 && d.x1 > d.x0; }
  function lblVis(d: AnyNode) { return arcVis(d) && (d.y1 - d.y0) * (d.x1 - d.x0) > 0.04; }
  // Radial shade: same group hue, but concentrated (opaque) near the centre and
  // fading darker toward the crust, so depth reads as tint. y0 = the ring's inner
  // radius in ring-units (1 = centre-most visible ring, 4 = rim).
  function arcOpacity(y0: number) {
    // Floor at 0.45 (was 0.3): the old floor left rim arcs so translucent
    // that the white labels sat on near-background — the muddy outer ring.
    return Math.max(0.45, Math.min(0.9, 0.86 - (y0 - 1) * 0.12));
  }
  function lblXform(d: AnyNode) {
    const x = ((d.x0 + d.x1) / 2) * (180 / Math.PI);
    const y = ((d.y0 + d.y1) / 2) * radius;
    return `rotate(${x - 90}) translate(${y},0) rotate(${x < 180 ? 0 : 180})`;
  }

  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const textColor = isDark ? "#f4f4f5" : "#1a1a1a";
  const mutedColor = readToken("--text-muted", "#52525b");
  const refColor = readToken("--accent", "#f97316");
  // Arc separators: a hairline in the canvas background colour so segments read
  // as cleanly cut apart. SVG stroke attributes don't reliably parse oklch, so
  // use a plain hex near --bg.
  const sepColor = isDark ? "#131316" : "#fafafa";

  /* ── Tooltip — the same card as the hybrid graph (shared .hg-tooltip CSS):
     cover art, type eyebrow, name, path, details, url. ── */
  const tipEl = document.createElement("div");
  tipEl.className = "hg-tooltip";
  // NB: do NOT force container to position:relative — .graph-canvas is already
  // position:absolute (a valid containing block for the absolute tooltip/legend),
  // and overriding it to relative collapses the element out of its `inset:56 0
  // 76` fill, shrinking the whole sunburst to its content height. Only set
  // relative as a fallback if the container somehow isn't positioned.
  if (getComputedStyle(container).position === "static") {
    container.style.position = "relative";
  }
  container.appendChild(tipEl);

  /* Same "Branch References" sidebar as the hybrid graph — follows the zoom. */
  const legend = createBranchLegend(container, doc);

  const nodeById = new Map(doc.nodes.map((n) => [n.id, n]));
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  function showTip(ev: MouseEvent, d: AnyNode) {
    const n = nodeById.get(d.data.id);
    if (!n) {
      // The virtual multi-root centre has no real node behind it.
      tipEl.innerHTML = `<div class="hg-tt-name">${esc(d.data.name)}</div>`;
    } else {
      const media = mediaImageOf(n);
      const path = d
        .ancestors()
        .reverse()
        .filter((a: AnyNode) => a.data.id !== "__sunburst_root__")
        .map((a: AnyNode) => a.data.name)
        .join("  ›  ");
      const meta = (n.metadata ?? {}) as Record<string, unknown>;
      const metaRows = Object.entries(meta)
        .filter(([k]) => k !== "image" && k !== "cover")
        .slice(0, 6)
        .map(([k, v]) => `<span><b>${esc(k)}</b> ${esc(String(v))}</span>`)
        .join("");
      // When the node has a url, the cover art is the link and the url line is
      // a real anchor — reachable because the tip is sticky (see below).
      const href = n.url ? esc(n.url) : null;
      const img = media
        ? `<img class="hg-tt-media" src="${esc(media)}" alt="" loading="lazy" onerror="this.remove()" />`
        : "";
      const mediaHtml =
        media && href
          ? `<a class="hg-tt-medialink" href="${href}" target="_blank" rel="noopener noreferrer">${img}</a>`
          : img;
      tipEl.innerHTML =
        mediaHtml +
        `<div class="hg-tt-name">${esc(n.name)}</div>` +
        `<div class="hg-tt-path">${esc(path)}</div>` +
        (metaRows ? `<div class="hg-tt-meta">${metaRows}</div>` : "") +
        (href
          ? `<a class="hg-tt-url" href="${href}" target="_blank" rel="noopener noreferrer">${esc(n.url as string)}</a>`
          : "");
    }
    tipEl.classList.add("is-shown");
    // Anchor once at entry — the tip does not chase the cursor, so it's a
    // stable target you can move onto and click.
    moveTip(ev);
  }
  function moveTip(ev: MouseEvent) {
    const rect = container.getBoundingClientRect();
    let x = ev.clientX - rect.left + 14;
    let y = ev.clientY - rect.top - 32;
    // Keep the card inside the stage now that it can be tall (cover art).
    if (x + tipEl.offsetWidth > rect.width) x -= tipEl.offsetWidth + 28;
    if (y + tipEl.offsetHeight > rect.height) y = rect.height - tipEl.offsetHeight - 8;
    if (y < 8) y = 8;
    tipEl.style.left = `${x}px`;
    tipEl.style.top = `${y}px`;
  }
  function hideTip() { tipEl.classList.remove("is-shown"); }
  // Leaving the chart dismisses the sticky tip — unless the pointer is moving
  // onto the tip itself (that reach must not kill it).
  container.addEventListener("mouseleave", (e) => {
    const rt = (e as MouseEvent).relatedTarget;
    if (rt instanceof Node && tipEl.contains(rt)) return;
    hideTip();
  });

  /* ── SVG scaffold ── */
  const svg = d3
    .select(container)
    .append("svg")
    .attr("width", "100%")
    .attr("height", "100%")
    .attr("viewBox", `0 0 ${W} ${H}`)
    .attr("preserveAspectRatio", "xMidYMid meet")
    .style("display", "block");

  const g = svg.append("g").attr("transform", `translate(${W / 2},${H / 2})`);

  /* Reference overlay */
  const sbMap = new Map(root.descendants().map((d: AnyNode) => [d.data.id, d]));
  const refEndpoints = new Set(refs.flatMap((l) => [l.source, l.target]));
  void refEndpoints; // may be used for dimming in future

  const refG = g.append("g").attr("class", "sb-refs").style("display", "none");
  function drawRefs() {
    const vis = refs.filter((l) => sbMap.has(l.source) && sbMap.has(l.target));
    refG
      .selectAll("path")
      .data(vis, (l: unknown) => (l as typeof refs[0]).source + "_" + (l as typeof refs[0]).target)
      .join("path")
      .attr("fill", "none")
      .attr("stroke", refColor)
      .attr("stroke-width", 1.2)
      .attr("stroke-opacity", 0.55)
      .attr("stroke-dasharray", "4,3")
      .attr("d", (l) => {
        const sNode = sbMap.get(l.source) as AnyNode;
        const tNode = sbMap.get(l.target) as AnyNode;
        const a1 = (sNode.current.x0 + sNode.current.x1) / 2;
        const r1 = Math.min(((sNode.current.y0 + sNode.current.y1) / 2) * radius, 3 * radius);
        const a2 = (tNode.current.x0 + tNode.current.x1) / 2;
        const r2 = Math.min(((tNode.current.y0 + tNode.current.y1) / 2) * radius, 3 * radius);
        const x1 = Math.sin(a1) * r1, y1 = -Math.cos(a1) * r1;
        const x2 = Math.sin(a2) * r2, y2 = -Math.cos(a2) * r2;
        return `M${x1},${y1} Q0,0 ${x2},${y2}`;
      });
  }

  /* Arcs */
  const path = g
    .append("g")
    .selectAll<SVGPathElement, AnyNode>("path")
    .data(root.descendants().slice(1) as AnyNode[])
    .join("path")
    .attr("fill", (d) => colorOf(d))
    .attr("fill-opacity", (d) => (arcVis(d.current) ? arcOpacity(d.current.y0) : 0))
    .attr("stroke", sepColor)
    .attr("stroke-width", 1.5)
    .attr("stroke-linejoin", "round")
    .attr("stroke-opacity", (d) => (arcVis(d.current) ? 1 : 0))
    // Off-screen rings are transparent but still painted — without this they
    // swallow clicks meant for the crust area and teleport across branches.
    .attr("pointer-events", (d) => (arcVis(d.current) ? "auto" : "none"))
    .attr("d", (d) => arc(d.current) ?? "")
    // Sticky tooltip: anchor on enter, don't chase the cursor, and don't hide
    // on arc-leave — so you can move onto the card and click its link. Another
    // arc replaces it; a zoom click or leaving the chart dismisses it.
    .on("mouseover", (ev, d) => showTip(ev, d));

  path.filter((d) => !!d.children).style("cursor", "pointer").on("click", clicked);

  /* Labels — depth-1 groups are named on the crust instead, so their inner
     arcs stay clean. Truncation is MEASURED against the ring band's pixel
     width (labels run along the radius), not a character count — "Infra…"
     only when it genuinely doesn't fit, never because it hit 12 chars. */
  // Label type scale, derived from the ring-band width so text grows with
  // the wheel: leaves ~11% of a band, clamped to stay subordinate to the
  // 12–14px mid ring.
  const leafFont = Math.max(9, Math.min(12, Math.round(radius * 0.11)));
  const midFont = Math.max(12, Math.min(14, Math.round(radius * 0.14)));
  const measureCtx = document.createElement("canvas").getContext("2d");
  const fitCache = new Map<string, string>();
  function fitLabel(name: string, fontPx: number): string {
    const budget = radius - 12; // one ring-unit minus breathing room
    const key = `${name}|${fontPx}|${Math.round(budget)}`;
    const hit = fitCache.get(key);
    if (hit !== undefined) return hit;
    let out = name;
    if (measureCtx) {
      measureCtx.font = `${fontPx}px ${getComputedStyle(container).fontFamily}`;
      if (measureCtx.measureText(name).width > budget) {
        let lo = 1;
        let hi = name.length;
        while (lo < hi) {
          const mid = (lo + hi + 1) >> 1;
          if (measureCtx.measureText(name.slice(0, mid) + "…").width <= budget) lo = mid;
          else hi = mid - 1;
        }
        out = name.slice(0, lo) + "…";
      }
    } else if (name.length > 12) {
      out = name.slice(0, 11) + "…";
    }
    fitCache.set(key, out);
    return out;
  }
  const label = g
    .append("g")
    .attr("pointer-events", "none")
    .attr("text-anchor", "middle")
    .selectAll<SVGTextElement, AnyNode>("text")
    .data((root.descendants() as AnyNode[]).filter((d) => d.depth > 1))
    .join("text")
    .attr("dy", "0.35em")
    // Theme text colour. The casing halo exists only in dark mode, where
    // light text sits on translucent arcs; in light mode dark ink on pastel
    // is already high-contrast and a halo just fuzzes small glyphs.
    .attr("fill", textColor)
    .attr("stroke", isDark ? sepColor : "none")
    .attr("stroke-width", isDark ? 2 : 0)
    .attr("paint-order", "stroke")
    .attr("stroke-linejoin", "round")
    .attr("fill-opacity", (d) => +lblVis(d.current))
    .attr("stroke-opacity", (d) => +lblVis(d.current) * 0.55)
    .attr("transform", (d) => lblXform(d.current))
    // Type scales with the wheel instead of a fixed 9px: at big viewports the
    // rings grow but the old labels didn't, reading as specks. Depth 2 is the
    // innermost LABELLED ring (depth 1 lives on the crust; the old `<= 1`
    // branch here was dead code), so it takes the larger size.
    .attr("font-size", (d) => `${d.depth === 2 ? midFont : leafFont}px`)
    .attr("font-weight", (d) => (d.depth === 2 ? "600" : "500"))
    .text((d) => fitLabel(d.data.name, d.depth === 2 ? midFont : leafFont));

  /* ── Crust: a static, purely informational band outside the pie ──
     Not interactive, not animated. At the root it names the first-level
     groups; drilled in, it becomes a single ring naming the branch you're
     inside, label at the crown. */
  const topNodes = (root.children ?? []) as AnyNode[];
  const crustG = g.append("g").attr("class", "sb-crust").attr("pointer-events", "none");

  interface CrustSeg { name: string; color: string; a0: number; a1: number }
  function crustSegs(p: AnyNode): CrustSeg[] {
    if (p === root)
      return topNodes.map((d) => ({
        name: d.data.name,
        color: colorOf(d),
        a0: d.x0,
        a1: d.x1,
      }));
    const top = (p.ancestors().find((a) => a.depth === 1) ?? p) as AnyNode;
    // Full ring, angles centred on 0 so the label lands at the top.
    return [{ name: top.data.name, color: colorOf(top), a0: -Math.PI, a1: Math.PI }];
  }

  // Label path along the band's centreline; flipped in the bottom half so
  // labels never render upside down. textPath drops glyphs that overflow,
  // so narrow segments self-truncate.
  function crustLabelD(s: CrustSeg): string {
    let { a0, a1 } = s;
    if (a1 - a0 > 2 * Math.PI - 0.002) {
      a0 += 0.001;
      a1 -= 0.001;
    }
    const mid = (a0 + a1) / 2;
    const norm = ((mid % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const flip = norm > Math.PI / 2 && norm < (3 * Math.PI) / 2;
    // Label baseline path at the crust band's radial middle; the text is then
    // vertically centred on it via dominant-baseline (below), so names sit in the
    // middle of the band instead of hugging its edge — flip or not.
    const r = radius * 4 + CRUST_GAP + CRUST_W / 2;
    const pt = (a: number) => `${Math.sin(a) * r},${-Math.cos(a) * r}`;
    const [st, en] = flip ? [a1, a0] : [a0, a1];
    const large = a1 - a0 > Math.PI ? 1 : 0;
    return `M${pt(st)}A${r},${r} 0 ${large} ${flip ? 0 : 1} ${pt(en)}`;
  }

  function drawCrust(p: AnyNode) {
    crustG.selectAll("*").remove();
    crustSegs(p).forEach((s, i) => {
      crustG
        .append("path")
        .attr("fill", s.color)
        .attr("fill-opacity", 0.22)
        .attr(
          "d",
          d3.arc()({
            innerRadius: radius * 4 + CRUST_GAP,
            outerRadius: radius * 4 + CRUST_GAP + CRUST_W,
            startAngle: s.a0,
            endAngle: s.a1,
            padAngle: 0.008,
          }) ?? "",
        );
      crustG
        .append("path")
        .attr("id", `sb-crust-path-${i}`)
        .attr("fill", "none")
        .attr("d", crustLabelD(s));
      crustG
        .append("text")
        .attr("font-size", "12px")
        .attr("font-weight", "600")
        .attr("letter-spacing", "0.02em")
        .attr("dominant-baseline", "central")
        .attr("fill", s.color)
        .append("textPath")
        .attr("href", `#sb-crust-path-${i}`)
        .attr("startOffset", "50%")
        .attr("text-anchor", "middle")
        .text(s.name);
    });
  }
  let crustFocus: AnyNode = root;
  drawCrust(root);

  /* Centre: focus name + explicit nav icons. The old "click the centre to jump
     to the top" behaviour is gone — you navigate with the Back / Home buttons. */
  const centerCircle = g
    .append("circle")
    .attr("r", radius)
    .attr("fill", "none")
    .attr("pointer-events", "none");

  const centerName = g
    .append("text")
    .attr("text-anchor", "middle")
    .attr("dy", "-0.2em")
    .attr("font-size", "13px")
    .attr("font-weight", "700")
    .attr("fill", textColor)
    .attr("pointer-events", "none");

  // Nav icons, rebuilt on every focus change; sit just below the focus name.
  const centerNav = g.append("g").attr("class", "sb-center-nav");
  let centerLines = 1;
  const BACK_D = "M 2.5 -5 L -3 0 L 2.5 5 M -3 0 L 5.5 0";
  const HOME_D = "M -5 0 L 0 -5 L 5 0 M -3.5 -1 L -3.5 5 L 3.5 5 L 3.5 -1";

  function navButton(x: number, iconD: string, onClick: () => void, label: string) {
    const b = centerNav
      .append("g")
      .attr("transform", `translate(${x},0)`)
      .style("cursor", "pointer")
      .attr("pointer-events", "all")
      .on("click", (ev: MouseEvent) => {
        ev.stopPropagation();
        onClick();
      });
    b.append("circle").attr("r", 12).attr("fill", "transparent");
    const icon = b
      .append("path")
      .attr("d", iconD)
      .attr("fill", "none")
      .attr("stroke", mutedColor)
      .attr("stroke-width", 1.6)
      .attr("stroke-linecap", "round")
      .attr("stroke-linejoin", "round");
    b.on("mouseover", () => icon.attr("stroke", refColor)).on("mouseout", () =>
      icon.attr("stroke", mutedColor),
    );
    b.append("title").text(label);
  }

  // Back = focus's parent (one level up); Home = root. No Back at depth 1 — its
  // parent is the root, so Back would just duplicate Home. Nothing at the root.
  function updateCenterNav(p: AnyNode) {
    centerNav.selectAll("*").remove();
    if (p === root) return;
    centerNav.attr("transform", `translate(0,${(centerLines - 1) * 9 + 28})`);
    if (p.depth >= 2) {
      navButton(-15, BACK_D, () => clicked(null, p.parent as AnyNode), "Back");
      navButton(15, HOME_D, () => clicked(null, root), "Home");
    } else {
      navButton(0, HOME_D, () => clicked(null, root), "Home");
    }
  }

  /* Centre name wraps to as many lines as it needs — never truncated. */
  function setCenterName(name: string) {
    const words = name.split(/\s+/);
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      const cand = cur ? `${cur} ${w}` : w;
      if (cand.length > 16 && cur) {
        lines.push(cur);
        cur = w;
      } else {
        cur = cand;
      }
    }
    if (cur) lines.push(cur);
    centerName.text(null);
    lines.forEach((ln, i) =>
      centerName
        .append("tspan")
        .attr("x", 0)
        .attr("dy", i === 0 ? `${-(lines.length - 1) * 0.575}em` : "1.15em")
        .text(ln),
    );
    centerLines = lines.length;
  }

  /* Root centre: a decorative (non-clickable) home glyph in place of the root
     name, plus ambient dots radiating from it toward each group — the same sort
     of motion as the graph. Deeper levels show the focus name + Back/Home nav. */
  const dotsG = g.append("g").attr("class", "sb-center-dots").attr("pointer-events", "none");
  const centerHome = g
    .append("g")
    .attr("class", "sb-center-home")
    .attr("pointer-events", "none")
    .style("display", "none");
  centerHome
    .append("path")
    .attr("d", HOME_D)
    .attr("transform", "scale(2.3)")
    .attr("fill", "none")
    .attr("stroke", textColor)
    .attr("stroke-width", 1.7)
    .attr("vector-effect", "non-scaling-stroke")
    .attr("stroke-linecap", "round")
    .attr("stroke-linejoin", "round");

  interface Dot { a: number; r: number; r0: number; r1: number; color: string; speed: number }
  const dotDirs = ((root.children ?? []) as AnyNode[]).map((gp) => ({
    a0: gp.x0,
    a1: gp.x1,
    color: colorOf(gp),
  }));
  const reducedMotion =
    typeof window !== "undefined" &&
    (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);
  let dots: Dot[] = [];
  let dotRaf = 0;
  let dotLast = 0;
  let dotAcc = 0;
  let atRootView = true; // only the root view shows the radiating dots
  let dotsDestroyed = false;
  function dotFrame(ts: number) {
    if (dotsDestroyed) { dotRaf = 0; return; }
    const dt = dotLast ? Math.min(48, ts - dotLast) : 16;
    dotLast = ts;
    if (!atRootView) {
      // Zoomed in — keep the loop alive but emit nothing.
      if (dots.length) { dots = []; dotsG.selectAll("circle").remove(); }
      dotRaf = requestAnimationFrame(dotFrame);
      return;
    }
    // Inner spray: home glyph → first ring, toward each group's centre.
    // Outer spray: the crust's outer edge → beyond it, across each group's arc.
    // Both carry the group's colour and fade in-then-out along their run.
    const iR0 = radius * 0.42;
    const iR1 = radius * 0.98;
    const cOut = radius * 4 + CRUST_GAP + CRUST_W;
    const spray = Math.min(radius * 0.22, 30);
    dotAcc += dt;
    while (dotAcc > 180 && dotDirs.length) {
      dotAcc -= 180;
      const src = dotDirs[Math.floor(Math.random() * dotDirs.length)];
      const mid = (src.a0 + src.a1) / 2;
      dots.push({
        a: mid + (Math.random() - 0.5) * 0.16,
        r: iR0, r0: iR0, r1: iR1,
        color: src.color,
        speed: (iR1 - iR0) / (1200 + Math.random() * 700),
      });
      dots.push({
        a: src.a0 + Math.random() * (src.a1 - src.a0),
        r: cOut, r0: cOut, r1: cOut + spray,
        color: src.color,
        speed: spray / (900 + Math.random() * 600),
      });
    }
    dots = dots.filter((d) => { d.r += d.speed * dt; return d.r < d.r1; });
    const sel = dotsG.selectAll<SVGCircleElement, Dot>("circle").data(dots);
    sel
      .enter()
      .append("circle")
      .attr("r", 1.7)
      .merge(sel)
      .attr("cx", (d) => Math.sin(d.a) * d.r)
      .attr("cy", (d) => -Math.cos(d.a) * d.r)
      .attr("fill", (d) => d.color)
      .attr("fill-opacity", (d) => {
        const t = Math.max(0, Math.min(1, (d.r - d.r0) / (d.r1 - d.r0)));
        return 0.55 * Math.sin(t * Math.PI);
      });
    sel.exit().remove();
    dotRaf = requestAnimationFrame(dotFrame);
  }
  // Start the loop once and leave it running (gated by atRootView). Doing it via
  // start/stop booleans tied to mount/zoom raced with StrictMode and left the
  // dots intermittently dead.
  if (!reducedMotion) dotRaf = requestAnimationFrame(dotFrame);

  function updateCenter(p: AnyNode) {
    const atRoot = p === root;
    atRootView = atRoot;
    centerHome.style("display", atRoot ? "inline" : "none");
    centerName.style("display", atRoot ? "none" : "inline");
    if (!atRoot) setCenterName(p.data.name);
    updateCenterNav(p);
  }
  updateCenter(root);

  /* Click / zoom */
  function clicked(_ev: MouseEvent | null, p: AnyNode) {
    hideTip(); // a zoom would strand the anchored tip
    updateCenter(p);
    legend.update(p === root ? null : p.data.id);

    root.each((d: AnyNode) => {
      d.target = {
        x0: Math.max(0, Math.min(1, (d.x0 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
        x1: Math.max(0, Math.min(1, (d.x1 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
        y0: Math.max(0, d.y0 - p.depth),
        y1: Math.max(0, d.y1 - p.depth),
      };
    });

    // d3's Transition typings don't unify across element types — widen once.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const t = g.transition().duration(500) as d3.Transition<any, any, any, any>;
    path
      .transition(t)
      .tween("data", (d: AnyNode) => {
        const i = d3.interpolate(d.current, d.target);
        return (tt: number) => (d.current = i(tt));
      })
      .filter(function (this: SVGPathElement, d: AnyNode) {
        return +this.getAttribute("fill-opacity")! > 0 || arcVis(d.target);
      })
      .attr("fill-opacity", (d: AnyNode) =>
        arcVis(d.target) ? arcOpacity(d.target.y0) : 0,
      )
      .attr("stroke-opacity", (d: AnyNode) => (arcVis(d.target) ? 1 : 0))
      .attr("pointer-events", (d: AnyNode) => (arcVis(d.target) ? "auto" : "none"))
      .attrTween("d", (d: AnyNode) => () => arc(d.current) ?? "");

    // The crust is informational only — swap it instantly, no animation.
    crustFocus = p;
    drawCrust(p);

    // Anti-ghost labels: only labels that survive the zoom stay on screen, moving
    // out with their arc. Ones that are leaving are cut instantly instead of
    // fading across the pie, and the incoming set is placed + faded in once we
    // land — so no text smears through the middle mid-zoom.
    label.interrupt();
    label.each(function (this: SVGTextElement, d: AnyNode) {
      const shownNow = +this.getAttribute("fill-opacity")! > 0;
      if (shownNow && lblVis(d.target)) {
        d3.select(this)
          .transition(t)
          .attrTween("transform", () => () => lblXform(d.current));
      } else {
        d3.select(this).attr("fill-opacity", 0).attr("stroke-opacity", 0);
      }
    });
    t.end()
      .then(() => {
        label.attr("transform", (d: AnyNode) => lblXform(d.current));
        label
          .transition()
          .duration(180)
          .attr("fill-opacity", (d: AnyNode) => +lblVis(d.current))
          // The casing stroke fades with the fill or it ghosts on its own.
          .attr("stroke-opacity", (d: AnyNode) => +lblVis(d.current) * 0.55);
        drawRefs();
      })
      .catch(() => {});
  }

  drawRefs();

  /* Re-fit on container resize: the arc/label accessors close over `radius`,
     so updating it + re-applying geometry re-fits without losing zoom state. */
  function resize() {
    const nw = container.clientWidth || W;
    const nh = container.clientHeight || H;
    if (Math.abs(nw - W) < 2 && Math.abs(nh - H) < 2) return;
    W = nw;
    H = nh;
    radius = radiusFor(W, H);
    svg.attr("viewBox", `0 0 ${W} ${H}`);
    g.attr("transform", `translate(${W / 2},${H / 2})`);
    centerCircle.attr("r", radius);
    path.attr("d", (d) => arc(d.current) ?? "");
    label.attr("transform", (d) => lblXform(d.current));
    drawCrust(crustFocus);
    drawRefs();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(container);

  return {
    update: () => {},
    reset: () => clicked(new MouseEvent("click"), root),
    focus: () => {},
    setShapeMode: () => {}, // shape mode is graph-view only
    setRefsMode: () => {}, // refs mode is graph-view only
    snapshotPng: () => null,
    destroy: () => {
      dotsDestroyed = true;
      if (dotRaf) cancelAnimationFrame(dotRaf);
      ro.disconnect();
      legend.destroy();
      tipEl.remove();
      svg.remove();
      container.style.position = "";
    },
  };
}
