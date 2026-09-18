import { useEffect, useState, type ReactNode } from "react";
import { IconUpload } from "../components/icons";
import { Changelog } from "../components/Changelog";
import { navigateTo } from "./routes";

/* -------------------------------------------------------------------------- */
/* Use-cases page (UC2). Hero → 3-up case grid → "…and plenty more trees" →    */
/* per-case detail dialog. Standalone for now; the body lifts into the         */
/* homepage once the copy/layout settle. (App supplies its own nav + footer.)  */
/* -------------------------------------------------------------------------- */

interface UseCase {
  key: string;
  /** Render fn (not a shared element) so each slot — grid, dialog, spectrum —
      gets its own instance. */
  icon: () => ReactNode;
  /** Audience tag, shown uppercase top-right of the card. */
  who: string;
  title: string;
  /** Card-front one-liner. */
  desc: string;
  /** Detail eyebrow: ROLE · action · outcome. */
  sub: string;
  /** Detail body — two paragraphs. */
  body: [string, string];
  /** Optional media asset (image/video). The block is hidden when absent. */
  media?: string;
  /** Caption / alt text for the media when present. */
  mediaLabel: string;
}

/* Page glyphs (24×24, stroke = currentColor) — built from path lists, mirroring
   the UC2 source. Kept local rather than in the shared chrome icon set. */
function Glyph({ paths }: { paths: string[] }) {
  return (
    <svg
      width={22}
      height={22}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

function OrgGlyph() {
  return (
    <svg
      width={22}
      height={22}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx={12} cy={5} r={2} />
      <circle cx={5} cy={19} r={2} />
      <circle cx={19} cy={19} r={2} />
      <path d="M12 7v4M11 12.5 6.5 16.5M13 12.5l4.5 4" />
    </svg>
  );
}

const USE_CASES: UseCase[] = [
  {
    key: "knowledge",
    icon: () => <Glyph paths={["M4 5a2 2 0 0 1 2-2h13v17H6a2 2 0 0 0-2 2z", "M19 17H6a2 2 0 0 0-2 2"]} />,
    who: "Docs · Ops · Support",
    title: "Knowledge bases",
    desc: "Turn a wiki or docs export into a navigable map of domains, articles, and the references between them.",
    sub: "Docs lead · uploads a wiki export · the team finds the right page in seconds",
    body: [
      "Your wiki has grown into hundreds of pages across half a dozen teams. The search box helps if you already know the title — but nobody can see how it all fits together, or which docs quietly depend on each other.",
      "Export it to a CSV or Markdown outline, confirm the columns, and Constella draws the whole base: domains as branches, articles as leaves, and the dashed reference edges that reveal cross-team dependencies. Drop the embed into your intranet so onboarding starts with the map, not a search bar.",
    ],
    mediaLabel: "video / image — knowledge base walkthrough",
  },
  {
    key: "org",
    icon: () => <OrgGlyph />,
    who: "People Ops · Founders",
    title: "Org charts",
    desc: "Drop in a roster, confirm the columns, and turn reporting and dotted-line links into a graph new hires can read.",
    sub: "People Ops lead · drops in a team roster · new hires read the org at a glance",
    body: [
      "You've doubled headcount in a year, and the org chart is a slide that was already wrong the day it was made. Reporting lines are the easy part — it's the dotted-line, cross-team work nobody can see, so new hires can't tell who actually owns what.",
      "Export your roster to a CSV with columns for person, team, and manager, confirm the columns, and Constella lays out reporting lines as branches with dashed reference edges for the cross-functional links. Share the PNG in the onboarding deck, or embed the live map in the handbook so it's there the day someone starts.",
    ],
    mediaLabel: "video / image — org graph walkthrough",
  },
  {
    key: "taxonomy",
    icon: () => <Glyph paths={["M3 6h7v6H3z", "M14 6h7v4h-7z", "M14 14h7v4h-7z", "M10 9h4"]} />,
    who: "PMs · Content · Retail",
    title: "Taxonomies",
    desc: "Map categories to subcategories to items, then spot the gaps, orphans, and overlaps at a glance.",
    sub: "Product manager · imports the category sheet · gaps and orphans surface on sight",
    body: [
      "Your taxonomy lives across a few spreadsheets and three people's memories. Somewhere in there a category is duplicated, another is mis-parented, and a handful are empty — but in a grid of rows you'd never catch it until a customer does.",
      "Import the CSV or Excel sheet, confirm which columns are parent and child, and Constella draws categories to subcategories to items. Orphans float free with nothing above them, and anything filed in two places shows up as an item with two parents. Export the PNG for the review, or the JSON to hand straight back to engineering.",
    ],
    mediaLabel: "video / image — taxonomy walkthrough",
  },
  {
    key: "service",
    icon: () => <Glyph paths={["m8 8-4 4 4 4", "M16 8l4 4-4 4", "M14 5l-4 14"]} />,
    who: "Engineers · SREs",
    title: "Dependency maps",
    desc: "Visualize services, modules, and their cross-references to reason about blast radius before you ship.",
    sub: "Staff engineer · imports a service manifest · blast radius is obvious before you ship",
    body: [
      "Your services lean on each other in ways no single person fully holds in their head. The architecture diagram is hand-drawn, six months stale, and missing exactly the dependency that turns a small change into an incident.",
      "Feed Constella a JSON manifest of your services and their dependencies, confirm the mapping, and it renders the system — services grouped by ownership, with dashed reference edges for the calls between them. Trace what breaks downstream, then paste the self-contained HTML into the ADR or the postmortem; it works offline, no login, no stale link.",
    ],
    mediaLabel: "video / image — dependency map walkthrough",
  },
  {
    key: "research",
    icon: () => <Glyph paths={["M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 0-2 2z", "M8 7h8M8 11h6"]} />,
    who: "Researchers · Analysts",
    title: "Citation maps",
    desc: "Turn topics, sources, and citations into a graph where every reference is a navigable link.",
    sub: "Research analyst · imports a sources outline · every citation becomes a navigable link",
    body: [
      "Your reading list is a flat bibliography. The real structure — which themes connect, which source underpins which claim, who cites whom — lives only in your head, and tracing an argument means scrolling a document.",
      "Import a Markdown outline or CSV of topics, sources, and citations, confirm the structure, and Constella turns citations into first-class edges you can follow node by node. Themes branch, sources sit beneath them, and a reference edge links each source to every claim it supports. Export the map straight into the literature review.",
    ],
    mediaLabel: "video / image — citation map walkthrough",
  },
  {
    key: "ia",
    icon: () => <Glyph paths={["M9 4h6v4H9z", "M4 16h6v4H4z", "M14 16h6v4h-6z", "M12 8v4M7 16v-2h10v2"]} />,
    who: "UX · IA · Content",
    title: "Information architecture",
    desc: "Turn a sitemap into a clean navigation tree, then export a shareable, embeddable diagram — no Figma wrangling.",
    sub: "UX designer · imports a sitemap · a clean IA diagram, no Figma wrangling",
    body: [
      "The sitemap lives in a spreadsheet, and turning it into something you can present means an afternoon of nudging boxes in Figma — a diagram that's out of date the moment the structure changes.",
      "Import the sitemap as a CSV or Markdown outline, confirm the nesting, and Constella draws the navigation tree: sections as branches, pages as leaves, and dashed edges for the cross-links that break a strict hierarchy. Export a PNG for the deck or an embeddable diagram for the doc — and regenerate it in seconds when the IA shifts.",
    ],
    mediaLabel: "video / image — information architecture walkthrough",
  },
];

const MORE_TREES = [
  "Project & work breakdowns",
  "Course & curriculum outlines",
  "Repo & file-system structure",
  "Process & decision trees",
  "Budget & account hierarchies",
  "Compliance & policy maps",
];

// Per-glyph ramp toward the accent for the spectrum row — pre-baked
// resolutions of `color-mix(in srgb, var(--accent-deep) N%, #fff)` for
// N = 30…100, so no runtime color-mix (dropped by older browsers).
const SPECTRUM = [
  "rgb(249, 205, 182)",
  "rgb(246, 182, 148)",
  "rgb(243, 158, 114)",
  "rgb(240, 135, 80)",
  "rgb(237, 111, 46)",
  "rgb(234, 88, 12)",
];

/** Standalone use-cases page (the parked `#use-cases` route): hero + grid. */
export function UseCasesPage({ onUpload }: { onUpload?: () => void }) {
  return (
    <div className="uc">
      {/* Hero */}
      <section className="uc-hero">
        <div className="uc-hero__glow" aria-hidden />
        <div className="uc-hero__inner">
          <span className="uc-hero__eyebrow">Use cases</span>
          <h1 className="uc-hero__title">
            Who is <span className="flourish">this for</span>?
          </h1>
          <p className="uc-hero__sub">
            If your information has a shape — parents, children, and the
            occasional cross-link — Constella can draw it. Bring the structure
            you already keep in a sheet, a doc, or a JSON file, and get a graph
            you can explore, share, and embed.
          </p>
          <div className="uc-hero__pills">
            <span className="uc-fmt">CSV · XLSX</span>
            <span className="uc-fmt">Markdown</span>
            <span className="uc-fmt">JSON</span>
          </div>
        </div>
      </section>

      <UseCasesGrid onUpload={onUpload} />
    </div>
  );
}

/**
 * Reusable body — the case grid, the "…and plenty more trees" tail, and the
 * detail dialog. Standalone page wraps it under a hero; the homepage drops it
 * in under the import card with its own compact header.
 */
export function UseCasesGrid({
  onUpload,
  variant = "full",
  showChangelog = false,
}: {
  onUpload?: () => void;
  /** "full" = standalone-page cards; "compact" = homepage recognition strip. */
  variant?: "full" | "compact";
  /** Homepage-only: render the changelog section before the glyph spectrum. */
  showChangelog?: boolean;
}) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const active = USE_CASES.find((u) => u.key === openKey) ?? null;
  const compact = variant === "compact";

  // Escape closes the detail dialog.
  useEffect(() => {
    if (!active) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenKey(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);

  return (
    <>
      {/* Case grid */}
      <section className="uc-grid-wrap">
        <div className="uc-grid">
          {USE_CASES.map((u) =>
            compact ? (
              <button
                type="button"
                className="uc-mini"
                key={u.key}
                onClick={() => setOpenKey(u.key)}
                aria-label={`${u.title} — view details`}
              >
                <span className="uc-tile uc-tile--sm" aria-hidden>
                  {u.icon()}
                </span>
                <span className="uc-mini__text">
                  <span className="uc-mini__title">{u.title}</span>
                  <span className="uc-mini__who">{u.who}</span>
                </span>
              </button>
            ) : (
              <article
                className="uc-card"
                key={u.key}
                role="button"
                tabIndex={0}
                aria-label={u.title}
                onClick={() => setOpenKey(u.key)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setOpenKey(u.key);
                  }
                }}
              >
                <div className="uc-card__top">
                  <span className="uc-tile" aria-hidden>
                    {u.icon()}
                  </span>
                  <span className="uc-who">{u.who}</span>
                </div>
                <h3 className="uc-card__title">{u.title}</h3>
                <p className="uc-card__desc">{u.desc}</p>
                <div className="uc-card__foot">
                  <span className="uc-card__link">View details →</span>
                </div>
              </article>
            ),
          )}
        </div>
      </section>

      {/* Chip marquee — the "…and plenty more trees" tail of the use cases. */}
      <section className="uc-more">
        <div className="uc-marquee">
          {[
            { items: MORE_TREES, dur: "38s", hidden: false },
            { items: [...MORE_TREES].reverse(), dur: "52s", hidden: true },
          ].map((row, r) => (
            <div
              className="uc-marquee__track"
              key={r}
              style={{ animationDuration: row.dur }}
            >
              {/* Duplicated once so the loop is seamless. */}
              {[...row.items, ...row.items].map((m, i) => (
                <span
                  className="uc-pill"
                  key={i}
                  aria-hidden={row.hidden || i >= row.items.length || undefined}
                >
                  {m}
                </span>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* Homepage-only CTA to the full use-cases page — sits under the chip
          marquee with clear air before the changelog section begins. */}
      {compact && (
        <div className="uc-viewall-wrap">
          <a
            className="uc-viewall"
            href="/use-cases"
            onClick={(e) => {
              // Plain left-clicks route in-app; modified clicks keep native
              // behaviour since /use-cases is a real address.
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
              e.preventDefault();
              navigateTo("/use-cases");
            }}
          >
            View all use cases &rarr;
          </a>
        </div>
      )}

      {/* Recent updates — homepage only, peer to the use cases. */}
      {showChangelog && <Changelog />}

      {/* Looping glyph spectrum — closes the page after the changelog. */}
      <section className="uc-spectrum-wrap" aria-hidden>
        <div className="uc-spectrum">
          {USE_CASES.map((u, i) => (
            <span
              className="uc-spectrum__icon"
              key={u.key}
              style={{
                color: SPECTRUM[i],
                animationDelay: `${i * 0.12}s`,
              }}
            >
              {u.icon()}
            </span>
          ))}
        </div>
      </section>

      {active ? (
        <UseCaseDialog
          uc={active}
          onClose={() => setOpenKey(null)}
          onUpload={onUpload}
        />
      ) : null}
    </>
  );
}

function UseCaseDialog({
  uc,
  onClose,
  onUpload,
}: {
  uc: UseCase;
  onClose: () => void;
  onUpload?: () => void;
}) {
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={uc.title}>
      <div className="overlay__scrim" onClick={onClose} />
      <div className="sheet sheet--usecase">
        <button
          type="button"
          className="uc-dialog__close"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
        <span className="uc-tile uc-tile--lg" aria-hidden>
          {uc.icon()}
        </span>
        <h3 className="uc-dialog__title">{uc.title}</h3>
        <p className="uc-dialog__sub">{uc.sub}</p>

        <div className="uc-dialog__body">
          {uc.body.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>

        {uc.media ? (
          <div className="uc-media">
            <img
              className="uc-media__img"
              src={uc.media}
              alt={uc.mediaLabel}
            />
          </div>
        ) : null}

        <div className="uc-dialog__actions">
          <button
            type="button"
            className="upload-btn uc-dialog__cta"
            onClick={() => {
              onClose();
              onUpload?.();
            }}
          >
            <IconUpload size={20} />
            Upload a structured file
          </button>
        </div>
      </div>
    </div>
  );
}
