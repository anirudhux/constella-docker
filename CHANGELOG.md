# Constella — Changelog

Constella turns structured data — **CSV, Excel, Markdown, or JSON** — into an
interactive hierarchy graph you can explore, share, and embed. Everything runs
in your browser; nothing is uploaded.

**Live:** https://constella.anirudhux.com
_Deployed from `main` via the Vercel CLI. Last updated: 2026-08-19._

---

## Shipped

### Import
- One uploader, every format — CSV · Excel · Markdown · JSON, parsed by the
  file's actual type (no format-picking up front).
- Structure detection with a confidence score, and a read-only **Import report**
  (node / link counts, warnings, source file).
- Bundled sample for a one-click demo.
- **Re-import in place** — swap files straight from the graph via the OS picker,
  no trip back to the landing page.

### Sharing — vertical URLs
- **/v/&lt;slug&gt; showcase links** — a curated JSON auto-loads and renders on
  open: the link IS the demo, no upload step for whoever holds it. Slug =
  filename in `public/showcase/` (world-readable by design); unknown slugs
  fall through to the home page. First residents: `/v/atlas`, `/v/sarvam`,
  `/v/heavy`.
- **The bench** (`/bench`, dev only) — 15 visible slots: name a slug, drop a
  JSON, changes stage until an explicit **Save bench** commits the files and
  the slot ledger (`showcase.ts`), so the bench restores itself. cbv ships
  the files; the page never ships.

### Charts
- Flat chart nav: **Circle · Spiral · Sunburst**. Circle and Spiral are the
  hybrid Three.js graph in different shapes (spiral = galaxy arms + ring
  scatter + star dust); shape choice persists and rides into every export
  and embed. **Infinity is parked** — three layouts were built (r(θ) squash,
  twin hubs, beads-on-a-wire) and none earned the button; the code stays in
  `core/layout.ts` for revival.
- **Size-weighted arcs** — a branch's wedge is proportional to its subtree,
  matching how the sunburst has always sized wedges. The silhouette encodes
  the data.
- **Sunburst** (D3): leaf-count wedges, labelled group ring, drill-in.
  Legibility pass (2026-08): labels scale with the wheel, measured truncation
  (no more 12-char chops), theme-true ink, instant repaint on theme toggle.
- Tree view retired (2026-08) — wasn't earning its slot.

### Graph interactions
- 3D hierarchy renderer (Three.js), verified from a 350-node sample up to
  ~6,000 nodes.
- Dynamic, anchored labels with importance-ranked culling.
- Click-to-focus, node detail panel / tooltip, and a text **Outline** view.
- Hierarchy links colour-graded from the root out to each node's colour.
- **All nodes** — light the whole structure at once, no labels; and
  **References** — just the cross-reference web, hover an endpoint to trace
  its connections with full parentage. One segmented pill beside the
  text-size stepper (top-centre cluster); the two layers stack.
- Reset view and Settings (label size & mode, click behaviour).

### Testing
- **BDD safety net (Wave 1–2)** — cucumber-js + Playwright harness covering: sample load,
  node / link counts, click→select, Outline view, light / dark mode, zero console errors.
  Tag-gated (`@smoke`, `@regression`; WIP and expected-failures isolated).

### Export & embed
- **PNG** snapshot (with an optional "Constella" mark).
- **Standalone HTML** — fully offline, self-contained, works with no network.
- **Embeddable iframe** (CDN-pinned Three.js) carrying a subtle maker mark.
- Raw **JSON**.
- 100% client-side: no account, no upload, no tracking.

### Landing & design system
- Hero + import card; a "Who is this for?" recognition strip with per-persona
  detail dialogs.
- Continuously looping chip marquee of additional use cases.
- Dot-matrix background and a bounded 1320px app shell so chrome aligns across
  every view.
- Light / dark theming that follows the OS, with a theme-aware favicon.
- Footer: product tagline, maker credit, and a client-side privacy summary.

---

### Pages & infrastructure
- Real routes: **/changelog** and **/use-cases** (pushState mini-router, SPA
  rewrites, sitemap entries); legacy `#use-cases` links upgrade in place.
- One renderer core, two consumers: the in-app graph and the generated export
  runtime share `renderer/core/*`, so app and exports can't drift.
- Browser-support dial (browserslist + postcss + Vite target) with static
  OKLCH→rgb token fallbacks.
- Vendor chunk split (three / d3 / xlsx) — the graph page's app chunk dropped
  591 KB → 69 KB, vendors cache across deploys.
- Agent mode (`?agent=1` / webdriver): suppresses human-only journey guards
  for scripted sessions.

---

## Next up

- **Input funnel generosity** — forgiving upload errors, template files, a
  reassuring Review step. The declared top priority.
- **Return loop** — upload history, live/persistent share links.
- **Wedge decision** — pick the primary use case out of the six equal cards.
- **Analytics** — product understanding + case-study source material.
- **Sunburst export** — PNG / self-contained HTML for the sunburst (graph
  shapes already export faithfully).

---

## Parked / later

- **Walkthrough media** — the video / image slots in each use-case dialog.
- **Editable Review** — the mapping-adjustment step for ambiguous table imports
  (reshaped from a page toward an interstitial modal).
- **Large-graph rendering** (instancing / LOD) — gated on real heavy-graph
  reports; a too-many-nodes gate for "All nodes" sits behind the same trigger.
