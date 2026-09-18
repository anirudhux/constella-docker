/* Changelog — the single source of truth for "what's new". Newest first.
   The homepage shows the top few; "View all" opens the full list. Keep entries
   short: a title, a one-line what-changed, a date, and whether it's a brand-new
   capability or an improvement to an existing one. */

export type ChangeKind = "new" | "improved";

export interface ChangeEntry {
  /** Display date, e.g. "Jul 2026". Kept as a string — no runtime date math. */
  date: string;
  kind: ChangeKind;
  title: string;
  desc: string;
}

/** How many entries the homepage strip shows before "View all". */
export const CHANGELOG_PREVIEW = 5;

export const CHANGELOG: ChangeEntry[] = [
  {
    date: "Sep 2026",
    kind: "improved",
    title: "Clicking a parent node frames its branch",
    desc: "Before, clicking any node opened the detail panel, including the root and group nodes with little to show. Now clicking the root or a parent node selects and frames that branch; only a leaf node, the end of a branch, opens the panel.",
  },
  {
    date: "Aug 2026",
    kind: "improved",
    title: "Sunburst fills the frame again",
    desc: "The sunburst could render as a small wheel jammed at the top with empty space below, depending on window size. It now sizes to and centers in the full graph area every time.",
  },
  {
    date: "Aug 2026",
    kind: "improved",
    title: "Links in the hover tooltip are clickable",
    desc: "The hover tooltip used to follow the cursor and vanish the moment you moved toward it, so a link inside was impossible to reach. It now anchors in place and stays put while you move onto it — so you can click the link (or its cover image) to open it. Hovering another node swaps the card; clicking a node still opens the full panel. Same in the sunburst and in exported and embedded graphs.",
  },
  {
    date: "Aug 2026",
    kind: "improved",
    title: "Side panel is a full-height rail",
    desc: "Opening a node in side-panel mode now docks a full-height panel to the right and dims the graph behind it, instead of floating a small card in the corner. Click the dimmed area to close. The hover tooltip stays down while a node is open, so you don't see the same card twice.",
  },
  {
    date: "Aug 2026",
    kind: "improved",
    title: "Tooltip on hover in every mode",
    desc: "The hover tooltip now appears in every mode; before, it was switched off when clicks opened the side panel or dialog. The click setting has two options: side panel (the default) or dialog.",
  },
  {
    date: "Aug 2026",
    kind: "new",
    title: "Images and video in the side panel and dialog",
    desc: "Open a node in the side panel or dialog and its media shows at the top of the card: cover images, and playable video — YouTube and Vimeo links embed a player, direct video files play with native controls.",
  },
  {
    date: "Aug 2026",
    kind: "new",
    title: "Design Demo Nights showcase",
    desc: "47 talks across six editions of Bengaluru's Design Demo Nights, with each speaker's photo in the tooltip. Open /v/ddn to view it. YouTube-linked nodes also get automatic cover art: the thumbnail comes from the video id, no extra data needed.",
  },
  {
    date: "Aug 2026",
    kind: "new",
    title: "Cover images in tooltips",
    desc: "A node that carries an image — an `image` in its details, or a URL that is itself a picture — shows it at the top of the hover tooltip, above the name and details. The sunburst shows the same tooltip (it used to show only the name), and exported and embedded graphs match. Nothing is fetched or guessed; only what the data provides is shown.",
  },
  {
    date: "Aug 2026",
    kind: "improved",
    title: "Settings dialog cleanup",
    desc: "Text size moved out of Settings onto the graph toolbar, so it isn't listed twice. Label background shows a small preview of each option, and the click-behaviour options sit side by side.",
  },
  {
    date: "Aug 2026",
    kind: "improved",
    title: "Removed made-up node types",
    desc: "Tooltips used to label every childless node “Document”, regardless of what it was. Those generated type labels are gone from the graph.",
  },
  {
    date: "Aug 2026",
    kind: "improved",
    title: "The review step is gone",
    desc: "Uploads open as a graph directly; the review-and-confirm screen is retired. When a file isn't clearly a hierarchy, Constella says so, shows how much of it could be read, and — when part of the file maps — offers to render just that part.",
  },
  {
    date: "Aug 2026",
    kind: "improved",
    title: "Controls that fit small screens",
    desc: "On tablets and phones the graph controls now fit without overlapping or clipping: the All-nodes and References toggles stay reachable as icons, and the chart switcher shows the active shape's label while the rest collapse to icons. Settings stays labelled throughout.",
  },
  {
    date: "Aug 2026",
    kind: "improved",
    title: "Multi-root files ask before wrapping",
    desc: "Upload a file with several top-level items and Constella now flags it and lets you wrap them under a root you name — instead of silently inventing one from the filename. Leave it as-is and the graph keeps all your roots.",
  },
  {
    date: "Aug 2026",
    kind: "improved",
    title: "Trying the sample gives you a link to share",
    desc: "“Try sample input” now opens the sample at its own address (/v/atlas) — so the moment you like it, the URL in your bar is one you can send. Starting over from any shared link cleanly returns you home.",
  },
  {
    date: "Aug 2026",
    kind: "improved",
    title: "The graph arrives with a flourish",
    desc: "The circle graph now lands lit and evenly spaced, then settles into place — branches ease out to a width that reflects their size, and labels fade in rather than pop. References mode labels its endpoints instead of leaving bare dots, thinning out only where they'd overlap.",
  },
  {
    date: "Aug 2026",
    kind: "new",
    title: "Links that open straight into a graph",
    desc: "Curated showcase links (like /v/atlas) now load their graph the moment they're opened — no upload, no steps. Share the URL; the URL is the demo.",
  },
  {
    date: "Aug 2026",
    kind: "improved",
    title: "Tidier graph controls",
    desc: "“All nodes” and “References” moved from floating corner chips into one segmented control up top, beside the text-size stepper — the whole cluster sits centred. Same two layers, same stacking, less clutter.",
  },
  {
    date: "Aug 2026",
    kind: "improved",
    title: "A sunburst you can actually read",
    desc: "Labels now scale with the wheel and truncate only when a name truly doesn't fit — no more 12-character chops. Light mode gets proper dark ink, and switching themes repaints the sunburst instantly instead of leaving it in the old palette.",
  },
  {
    date: "Aug 2026",
    kind: "improved",
    title: "Infinity takes a rest",
    desc: "The Infinity shape is off the nav while we rework it — none of its versions read as clearly as Circle and Spiral on real data. It'll return when it earns the button.",
  },
  {
    date: "Aug 2026",
    kind: "new",
    title: "Your graph, in three shapes",
    desc: "The chart nav is now Circle, Spiral, Infinity, and Sunburst. Spiral sweeps your branches into galaxy arms on a bed of star dust; Infinity bends the graph into a two-lobed figure. Exports and embeds keep whichever shape you picked.",
  },
  {
    date: "Aug 2026",
    kind: "improved",
    title: "Branches now take up the space they deserve",
    desc: "Arc width is proportional to branch size — a 120-node branch reads big, a 4-node one reads small — matching how the sunburst has always sized its wedges. The silhouette of your graph now says something true about your data.",
  },
  {
    date: "Aug 2026",
    kind: "new",
    title: "Show references",
    desc: "Cross-reference lines are out of the resting view and behind a dedicated toggle next to “All nodes”. Turn it on to see just the web; hover an endpoint to trace what connects to what, parentage included. The two toggles stack.",
  },
  {
    date: "Aug 2026",
    kind: "improved",
    title: "Tree view retired",
    desc: "The tree wasn't earning its spot next to the graph and sunburst, so it's gone — less to choose from, more that matters.",
  },
  {
    date: "Aug 2026",
    kind: "improved",
    title: "Two ways in, side by side",
    desc: "“Try sample input” now sits next to “Upload a structured file” as a proper button, so it's harder to miss if you'd rather explore a ready-made graph before bringing your own.",
  },
  {
    date: "Aug 2026",
    kind: "improved",
    title: "A snappier sample",
    desc: "“Try sample input” now preloads the demo data and shows a loading state — no more silent seconds on slow connections.",
  },
  {
    date: "Aug 2026",
    kind: "new",
    title: "The changelog and use cases have addresses",
    desc: "This changelog now lives at /changelog and the use-cases gallery at /use-cases — real, shareable links, with “View all” shortcuts from the home page.",
  },
  {
    date: "Aug 2026",
    kind: "new",
    title: "All nodes — see the shape of your data",
    desc: "A toggle on the graph lights up every node and connection at once, no labels — the whole structure in one glance. Click any node to dive back in.",
  },
  {
    date: "Jul 2026",
    kind: "improved",
    title: "Broader browser support",
    desc: "Constella now renders on a wider range of browsers — colours, effects and exported graphs fall back gracefully on older ones instead of breaking.",
  },
  {
    date: "Jul 2026",
    kind: "improved",
    title: "Fixed the badge link on shared graphs",
    desc: "The “Made with Constella” badge on every exported and embedded graph now points to the live site instead of a retired address that had started 404ing.",
  },
  {
    date: "Jul 2026",
    kind: "improved",
    title: "Sharper visualizations, with motion",
    desc: "A polish pass across the graph, sunburst and tree — aligned, shaded sunburst rings, a centred tree, a full-frame graph, and subtle colour-coded dots that trace each branch.",
  },
  {
    date: "Jul 2026",
    kind: "new",
    title: "Mobile-ready graph view",
    desc: "The whole graph page reflows for phones — controls tuck into a top strip, the view switcher scrolls, and Share becomes a floating button.",
  },
  {
    date: "Jul 2026",
    kind: "improved",
    title: "OKLCH colour system",
    desc: "Every view shares one perceptually-even palette, so a group reads the same colour in the graph, sunburst, and tree.",
  },
  {
    date: "Jul 2026",
    kind: "improved",
    title: "Full-screen canvas & dark mode",
    desc: "The graph runs edge-to-edge, dark by default, with controls tucked into the corners for more room to explore.",
  },
  {
    date: "Jul 2026",
    kind: "new",
    title: "Tree view",
    desc: "A collapsible hierarchy view with single- or multi-branch expand, so you can walk deep structures one level at a time.",
  },
  {
    date: "Jul 2026",
    kind: "new",
    title: "Sunburst view",
    desc: "A radial breakdown of your hierarchy with a labelled group ring — the whole shape on one screen.",
  },
  {
    date: "Jul 2026",
    kind: "new",
    title: "Branch references",
    desc: "Drill into a branch and its cross-links surface in a side panel, so dependencies stay visible as you navigate.",
  },
  {
    date: "Jul 2026",
    kind: "improved",
    title: "Share & embed",
    desc: "Download or copy every export — interactive HTML, PNG, and a re-importable JSON manifest — with one-tap feedback.",
  },
  {
    date: "Jun 2026",
    kind: "new",
    title: "In-place re-import",
    desc: "Swap the underlying document without leaving the graph — the view updates in place.",
  },
  {
    date: "Jun 2026",
    kind: "new",
    title: "Import report",
    desc: "A confidence read-out after every import: node, hierarchy, and reference counts, plus any warnings.",
  },
];
