import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type Dispatch,
} from "react";
import type { GraphLink, GraphNode, GraphWarning } from "../../types/graph";
import { summarize, decideImport } from "../importFlow";
import { mediaImageOf, videoOf } from "../../renderer/core/model";
import { ACCEPT_ALL, readAnyFile } from "../ingest";
import { detectStructure } from "../../core/detect";
import type {
  HybridGraphConfig,
  HybridGraphHandle,
} from "../../renderer/hybridGraph";
import { GraphCanvas, type VizType } from "../../components/GraphCanvas";
import { SettingsPanel } from "../../components/SettingsPanel";
import {
  loadGraphSettings,
  saveGraphSettings,
  stepLabelSize,
  LABEL_SIZE_MIN,
  LABEL_SIZE_MAX,
  type GraphSettings,
} from "../graphSettings";
import { readGraphTheme, DEFAULT_NODE_PALETTE } from "../graphTheme";
import {
  copyText,
  copyPngDataUrl,
  downloadDataUrl,
  downloadText,
} from "../../export/download";
import {
  IconReset,
  IconGear,
  IconShareNodes,
  IconSunburst,
  IconInfo,
  IconFile,
  IconCode,
  IconImage,
  IconBraces,
  IconDownload,
  IconCopy,
  IconCheck,
} from "../../components/icons";
import type { WizardAction, WizardState } from "../state";
import type { Theme } from "../useTheme";
import { isSampleFile } from "../samples";

interface StepProps {
  state: WizardState;
  dispatch: Dispatch<WizardAction>;
  theme: Theme;
}

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// Touch devices (phones + tablets) get focus-only taps — no tooltip (not a
// native mobile interaction) and no side panel (breaks on small screens). The
// modal/onNodeClick wiring is kept so a dialog can be switched on later.
const isCoarsePointer = () =>
  typeof window !== "undefined" &&
  ((window.matchMedia?.("(pointer: coarse)").matches ?? false) ||
    new URLSearchParams(window.location.search).has("touch"));

export function OutputStep({ state, dispatch, theme }: StepProps) {
  const graph = state.graph;
  const [settings, setSettings] = useState<GraphSettings>(loadGraphSettings);
  const [showSettings, setShowSettings] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showPartialBanner, setShowPartialBanner] = useState(true);
  // Auto-dismiss the partial-render banner after a few seconds (still closable).
  useEffect(() => {
    if (state.partialCoverage === null || !showPartialBanner) return;
    const t = window.setTimeout(() => setShowPartialBanner(false), 7500);
    return () => window.clearTimeout(t);
  }, [state.partialCoverage, showPartialBanner]);
  // View mode: hybrid graph, one of the D3 viz types, or the text outline.
  const [vizType, setVizType] = useState<VizType | "outline">("graph");
  const [selected, setSelected] = useState<GraphNode | null>(null);
  // "All nodes" shape mode — transient, graph-only, never persisted. The chip
  // state mirrors the renderer's; a node click in the graph dissolves the mode
  // via onShapeExit. Resets on any view switch (renderer remounts).
  const [shapeMode, setShapeMode] = useState(false);
  // "Show references" refs mode — same transient contract as shape mode; the
  // renderer enforces mutual exclusion and reports exits via onRefsExit.
  const [refsMode, setRefsMode] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const handleRef = useRef<HybridGraphHandle | null>(null);
  // Replace-in-place import: open the OS picker directly and swap the graph,
  // instead of routing back to the landing page.
  const importRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const reduced = useMemo(prefersReducedMotion, []);
  const coarse = useMemo(isCoarsePointer, []);

  // Warnings for the read-only import report (counts come straight off the graph).
  const reportWarnings = useMemo<GraphWarning[]>(
    () => (graph ? summarize(graph).warnings : []),
    [graph],
  );

  const config = useMemo<HybridGraphConfig>(() => {
    const gTheme = readGraphTheme();
    return {
      ...settings,
      // Touch: focus-only tap (no tooltip), slightly larger labels for legibility.
      clickAction: coarse ? "none" : settings.clickAction,
      labelSize: coarse ? Math.max(settings.labelSize, 13) : settings.labelSize,
      palette: DEFAULT_NODE_PALETTE,
      theme: gTheme,
      reducedMotion: reduced,
      // Selecting a node opens the detail panel; close Settings so the two
      // right-side panels never stack on top of each other.
      // null = a click that deselects (empty space / same node) — clears the panel.
      onNodeClick: (node) => {
        setSelected(node);
        if (node) setShowSettings(false);
      },
      // Modes dissolved by a node click — flip the matching chip off.
      onShapeExit: () => setShapeMode(false),
      onRefsExit: () => setRefsMode(false),
    };
    // theme drives token re-read; settings drive everything else.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, theme, reduced, coarse]);

  const [exportArtifacts, setExportArtifacts] = useState<{
    html: string;
    json: string;
  } | null>(null);
  // PNG-only: the HTML/embed marks are always on; the image export can opt out.

  useEffect(() => {
    if (!showExport || !graph) {
      setExportArtifacts(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      // Export pulls in the inlined Three.js build — load it on demand only.
      const { buildStandaloneHtml } = await import("../../export/html");
      const gTheme = readGraphTheme();
      const cfg = {
        theme: gTheme,
        palette: DEFAULT_NODE_PALETTE,
        labelMode: settings.labelMode,
        labelSize: settings.labelSize,
        clickAction: settings.clickAction,
        shape: settings.shape,
      };
      // Download HTML: fully self-contained / offline (Three inlined).
      const html = buildStandaloneHtml(graph, cfg, { title: "Constella graph" });
      if (cancelled) return;
      setExportArtifacts({
        html,
        json: JSON.stringify({ nodes: graph.nodes, links: graph.links }, null, 2),
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [showExport, graph, settings.labelMode, settings.labelSize, settings.clickAction, settings.shape, theme]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (showReport) setShowReport(false);
      else if (showExport) setShowExport(false);
      else if (selected) setSelected(null);
      else if (showSettings) setShowSettings(false);
      else handleRef.current?.reset();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showReport, showExport, selected, showSettings]);

  // The header's "Upload your document" button lives in the app shell — it
  // signals via a window event so the picker + swap logic stays in this step.
  useEffect(() => {
    const onPick = () => pickReplaceFile();
    window.addEventListener("constella:pick-upload", onPick);
    return () => window.removeEventListener("constella:pick-upload", onPick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist tuned appearance for the session so a refresh keeps it.
  useEffect(() => {
    saveGraphSettings(settings);
  }, [settings]);

  // Shape mode is a moment, not a preference: leaving the graph view drops it
  // (the renderer remounts anyway) and the chip must not stay stuck on.
  useEffect(() => {
    if (vizType !== "graph") {
      setShapeMode(false);
      setRefsMode(false);
    }
  }, [vizType]);

  if (!graph) return null;

  // Root = the node with no parent (depth 0). Used as the page title.
  const rootName =
    graph.nodes.find((n) => !n.parent)?.name ?? graph.nodes[0]?.name ?? "";
  const hierarchyCount = graph.links.filter((l) => l.kind === "contains").length;
  const referenceCount = graph.links.filter((l) => l.kind === "reference").length;
  // The bundled demo — surfaced with a "Sample" tag + a nudge to upload real data.
  const isSample = isSampleFile(state.raw?.filename);

  function flash(key: string) {
    setCopied(key);
    window.setTimeout(() => setCopied((c) => (c === key ? null : c)), 1400);
  }
  async function copy(key: string, text: string) {
    if (await copyText(text)) flash(key);
  }

  // Open the OS file picker straight away; parse + swap the graph in place.
  function pickReplaceFile() {
    setImportError(null);
    const input = importRef.current;
    if (!input) return;
    input.value = "";
    input.accept = ACCEPT_ALL;
    input.click();
  }
  async function onReplaceFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const raw = await readAnyFile(file);
      const detection = detectStructure(raw);
      const { mapping, graph: next, step, coverage, offerPartial } = decideImport(raw, detection);
      setShowReport(false);
      dispatch({ type: "import_ready", raw, detection, mapping, graph: next, step, coverage, offerPartial });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not read that file.";
      setImportError(msg);
      window.setTimeout(() => setImportError((m) => (m === msg ? null : m)), 5000);
    }
  }

  const showDetail =
    selected && (settings.clickAction === "panel" || settings.clickAction === "modal");

  return (
    <section className="step step--full">
      <div className="stage">
        <div className="chart-body">
          {state.partialCoverage !== null && showPartialBanner && (
            <div className="partial-banner" role="status">
              <span>
                Showing {Math.round(state.partialCoverage * 100)}% of{" "}
                {state.raw?.filename ?? "your file"} — the rest didn't fit a
                hierarchy.
              </span>
              <button
                type="button"
                className="partial-banner__x"
                aria-label="Dismiss"
                onClick={() => setShowPartialBanner(false)}
              >
                ×
              </button>
            </div>
          )}
          {/* Share sits top-right. Desktop/tablet: a labelled button in the top
              control row (Reset · text-size · Share). Mobile: a compact FAB,
              bottom-right (see the ≤480px block) — just the icon. */}
          <div className="canvas-strip">
            <button
              type="button"
              className="btn btn--primary btn--icon canvas-strip__share"
              onClick={() => setShowExport(true)}
            >
              <IconShareNodes size={18} />
              <span className="canvas-strip__share-txt"> Export</span>
            </button>
          </div>

          {vizType === "outline" ? (
            <TextOutline nodes={graph.nodes} />
          ) : (
            <GraphCanvas
              data={graph}
              config={config}
              vizType={vizType}
              onReady={(h) => (handleRef.current = h)}
            />
          )}

          {vizType !== "outline" && showDetail && selected && (
            <NodeDetail
              node={selected}
              nodes={graph.nodes}
              links={graph.links}
              asModal={settings.clickAction === "modal"}
              onClose={() => setSelected(null)}
            />
          )}

          {/* Top-centre control cluster — the text-size stepper and the layers
              pill center TOGETHER as one set (centering only the stepper left
              the row lopsided once the pill joined it). */}
          {vizType === "graph" && (
          <div className="canvas-center-controls">
            {/* Quick text-size stepper (−/+ codified as A/A): each click walks
                one step; full control also lives in Settings. Only the hybrid
                graph renders label-size config. */}
            <div className="a-stepper text-sizer" role="group" aria-label="Text size">
              <button
                type="button"
                className="a-stepper__opt a-stepper__opt--sm"
                title="Smaller text"
                aria-label="Smaller text"
                disabled={settings.labelSize <= LABEL_SIZE_MIN}
                onClick={() =>
                  setSettings((s) => ({ ...s, labelSize: stepLabelSize(s.labelSize, -1) }))
                }
              >
                A
              </button>
              <button
                type="button"
                className="a-stepper__opt a-stepper__opt--lg"
                title="Larger text"
                aria-label="Larger text"
                disabled={settings.labelSize >= LABEL_SIZE_MAX}
                onClick={() =>
                  setSettings((s) => ({ ...s, labelSize: stepLabelSize(s.labelSize, 1) }))
                }
              >
                A
              </button>
            </div>

            {/* Layers pill — ✦ All nodes | ⇢ References. Independent toggles
                (the layers compose: structure, web, or both), same transient
                contract — a node click in the graph dissolves whichever are
                on. The All-nodes segment is also the seam for a future
                too-many-nodes gate. */}
            <div className="layers-pill" role="group" aria-label="Overview layers">
              <button
                type="button"
                className={`layers-pill__opt${shapeMode ? " is-active" : ""}`}
                aria-label="All nodes"
                aria-pressed={shapeMode}
                title="Reveal the shape of the data"
                onClick={() => {
                  const next = !shapeMode;
                  setShapeMode(next);
                  if (next) {
                    setSelected(null);
                    setShowSettings(false);
                  }
                  handleRef.current?.setShapeMode(next);
                }}
              >
                <span aria-hidden>✦</span>
                <span className="ctl-label"> All nodes</span>
              </button>
              <button
                type="button"
                className={`layers-pill__opt${refsMode ? " is-active" : ""}`}
                aria-label="References"
                aria-pressed={refsMode}
                title="Reveal only the cross-references"
                onClick={() => {
                  const next = !refsMode;
                  setRefsMode(next);
                  if (next) {
                    setSelected(null);
                    setShowSettings(false);
                  }
                  handleRef.current?.setRefsMode(next);
                }}
              >
                <span aria-hidden>⇢</span>
                <span className="ctl-label"> References</span>
              </button>
            </div>
          </div>
          )}

          {/* Top control row: Reset (left) · centre cluster · Share (right).
              Reset is the top-left frosted pill. */}
          {vizType !== "outline" && (
            <button
              type="button"
              className="canvas-reset"
              title="Reset view"
              aria-label="Reset view"
              onClick={() => handleRef.current?.reset()}
            >
              <IconReset size={16} />
              <span className="ctl-label"> Reset</span>
            </button>
          )}

          {/* Document details — bottom-left pill. Collapses the old top-strip
              title/Sample/info into one CTA that opens the report. Desktop +
              tablet only (hidden at ≤480px, where the title strip was already
              dropped). */}
          {vizType !== "outline" && (
            <button
              type="button"
              className="canvas-doc"
              onClick={() => setShowReport(true)}
            >
              <IconInfo size={15} />
              <span className="ctl-label"> Details</span>
            </button>
          )}

          {/* Floating control set — lifted onto the canvas (elevated, shadowed)
              to reclaim the space the control row took below the stage. */}
          <div className="graph-controls">
            {/* One flat nav, four labelled charts — no "Graph" mother node.
                Circle/Spiral/Infinity are the hybrid graph in different
                shapes (vizType "graph" + settings.shape; a shape change
                remounts the canvas — layout is static per mount); Sunburst
                is the D3 view. Active = sunburst if that view is on, else
                the current shape. */}
            <div className="viewtoggle" role="group" aria-label="Chart type">
              {(
                [
                  { key: "circle",   label: "Circle",   glyph: "◯" },
                  { key: "spiral",   label: "Spiral",   glyph: "✦" },
                  // PARKED (2026-08): Infinity is off the nav pending a
                  // version that earns it. Three layouts were built and kept
                  // in core/layout.ts (beads-on-a-wire is the survivor); to
                  // revive, restore this entry and the graphSettings coercion.
                  // { key: "infinity", label: "Infinity", glyph: "∞" },
                ] as const
              ).map(({ key, label, glyph }) => (
                <button
                  key={key}
                  type="button"
                  className={`viewtoggle__opt${
                    vizType === "graph" && settings.shape === key ? " is-active" : ""
                  }`}
                  aria-pressed={vizType === "graph" && settings.shape === key}
                  onClick={() => {
                    setVizType("graph");
                    setSettings((s) => ({ ...s, shape: key }));
                  }}
                >
                  <span className="viewtoggle__glyph" aria-hidden>{glyph}</span>
                  <span className="ctl-label">{label}</span>
                </button>
              ))}
              <button
                type="button"
                className={`viewtoggle__opt${vizType === "sunburst" ? " is-active" : ""}`}
                aria-pressed={vizType === "sunburst"}
                onClick={() => setVizType("sunburst")}
              >
                <IconSunburst size={15} />
                <span className="ctl-label">Sunburst</span>
              </button>
            </div>
            <span className="graph-controls__sep" aria-hidden="true" />
            <button
              type="button"
              className="gctl-btn"
              aria-pressed={showSettings}
              onClick={() => {
                setSelected(null); // one right-side panel at a time
                setShowSettings((s) => !s);
              }}
            >
              <IconGear size={16} />
              <span className="ctl-label"> Settings</span>
            </button>
          </div>

          {/* Mobile-only: Settings as a standalone gear at the top-right; the
              in-pill Settings above is hidden at ≤480px. */}
          {vizType !== "outline" && (
            <button
              type="button"
              className="canvas-settings"
              aria-pressed={showSettings}
              aria-label="Settings"
              title="Settings"
              onClick={() => {
                setSelected(null);
                setShowSettings((s) => !s);
              }}
            >
              <IconGear size={18} />
            </button>
          )}
        </div>
      </div>

      {showSettings && (
        <SettingsPanel
          settings={settings}
          onChange={(patch) => setSettings((s) => ({ ...s, ...patch }))}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showReport && (
        <div
          className="overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Document details"
        >
          <div className="overlay__scrim" onClick={() => setShowReport(false)} />
          <div className="sheet sheet--report">
            <div className="sheet__head">
              <h3 className="settings__title">Document details</h3>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setShowReport(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="report__name">
              <h4 className="gtitle">{rootName || "Graph"}</h4>
              {isSample ? <span className="gtag">Sample</span> : null}
            </div>
            <p className="report__sub">
              {state.detection
                ? `Detected with ${Math.round(state.detection.confidence * 100)}% confidence.`
                : "Imported."}{" "}
              Nothing is inferred — this is exactly what we parsed from your
              file.
            </p>
            <div className="stats">
              <Stat label="Nodes" value={graph.nodes.length} />
              <Stat label="Hierarchy links" value={hierarchyCount} />
              <Stat label="Reference links" value={referenceCount} />
              <Stat label="Warnings" value={reportWarnings.length} muted />
            </div>
            {reportWarnings.length > 0 && (
              <ul className="warnings">
                {reportWarnings.map((w, i) => (
                  <li key={`${w.code}-${i}`} className="warnings__item">
                    <span className="warnings__code">{w.code}</span>
                    <span>
                      {w.message}
                      {w.row ? ` (row ${w.row})` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="report__foot">
              {state.raw?.filename ? (
                <span className="report__file" title={state.raw.filename}>
                  <IconFile size={14} />
                  <span>{state.raw.filename}</span>
                </span>
              ) : (
                <span />
              )}
              <div className="report__actions">
                <span className="tip tip--up">
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={pickReplaceFile}
                  >
                    Import another
                  </button>
                  <span className="tip__pop" role="tooltip">
                    <strong>Structured</strong> files only · CSV, Excel,
                    Markdown, JSON
                  </span>
                </span>
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => setShowReport(false)}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showExport && (
        <div className="overlay" role="dialog" aria-modal="true" aria-label="Export">
          <div className="overlay__scrim" onClick={() => setShowExport(false)} />
          <div className="sheet sheet--share">
            <div className="sheet__head">
              <h3 className="settings__title">Export</h3>
              <button type="button" className="icon-btn" onClick={() => setShowExport(false)} aria-label="Close">
                ×
              </button>
            </div>
            {!exportArtifacts ? (
              <p className="note">Preparing export…</p>
            ) : (
              <>
                <section className="set-group">
                  <h4 className="set-group__title">Export</h4>
                  <div className="exp-list">
                    <div className="exp-row">
                      <span className="exp-row__icon"><IconCode size={20} /></span>
                      <span className="exp-row__text">
                        <span className="exp-row__label">Interactive HTML</span>
                        <span className="exp-row__hint">Standalone file, works offline</span>
                      </span>
                      <span className="exp-row__actions">
                        <button
                          type="button"
                          className="btn btn--ghost btn--sm btn--icon"
                          onClick={() => {
                            downloadText("constella-graph.html", exportArtifacts.html, "text/html");
                            flash("html-dl");
                          }}
                        >
                          {copied === "html-dl" ? <IconCheck size={15} /> : <IconDownload size={15} />}
                          {copied === "html-dl" ? "Saved" : "Download"}
                        </button>
                        <button
                          type="button"
                          className="btn btn--ghost btn--sm btn--icon"
                          onClick={() => copy("html", exportArtifacts.html)}
                        >
                          {copied === "html" ? <IconCheck size={15} /> : <IconCopy size={15} />}
                          {copied === "html" ? "Copied" : "Copy"}
                        </button>
                      </span>
                    </div>

                    <div className="exp-row">
                      <span className="exp-row__icon"><IconImage size={20} /></span>
                      <span className="exp-row__text">
                        <span className="exp-row__label">Image (PNG)</span>
                        <span className="exp-row__hint">Snapshot of the current view</span>
                      </span>
                      <span className="exp-row__actions">
                        <button
                          type="button"
                          className="btn btn--ghost btn--sm btn--icon"
                          onClick={() => {
                            const png = handleRef.current?.snapshotPng({ mark: true });
                            if (png) {
                              downloadDataUrl("constella-graph.png", png);
                              flash("png-dl");
                            }
                          }}
                        >
                          {copied === "png-dl" ? <IconCheck size={15} /> : <IconDownload size={15} />}
                          {copied === "png-dl" ? "Saved" : "Download"}
                        </button>
                        <button
                          type="button"
                          className="btn btn--ghost btn--sm btn--icon"
                          onClick={async () => {
                            const png = handleRef.current?.snapshotPng({ mark: true });
                            if (png && (await copyPngDataUrl(png))) flash("png");
                          }}
                        >
                          {copied === "png" ? <IconCheck size={15} /> : <IconCopy size={15} />}
                          {copied === "png" ? "Copied" : "Copy"}
                        </button>
                      </span>
                    </div>

                    <div className="exp-row">
                      <span className="exp-row__icon"><IconBraces size={20} /></span>
                      <span className="exp-row__text">
                        <span className="exp-row__label">JSON manifest</span>
                        <span className="exp-row__hint">Portable, re-importable</span>
                      </span>
                      <span className="exp-row__actions">
                        <button
                          type="button"
                          className="btn btn--ghost btn--sm btn--icon"
                          onClick={() => {
                            downloadText("constella-graph.json", exportArtifacts.json, "application/json");
                            flash("json-dl");
                          }}
                        >
                          {copied === "json-dl" ? <IconCheck size={15} /> : <IconDownload size={15} />}
                          {copied === "json-dl" ? "Saved" : "Download"}
                        </button>
                        <button
                          type="button"
                          className="btn btn--ghost btn--sm btn--icon"
                          onClick={() => copy("json", exportArtifacts.json)}
                        >
                          {copied === "json" ? <IconCheck size={15} /> : <IconCopy size={15} />}
                          {copied === "json" ? "Copied" : "Copy"}
                        </button>
                      </span>
                    </div>
                  </div>
                </section>

                <p className="note">Everything runs in your browser — no account, no upload.</p>
              </>
            )}
          </div>
        </div>
      )}

      <input
        ref={importRef}
        type="file"
        className="visually-hidden"
        tabIndex={-1}
        aria-hidden="true"
        onChange={onReplaceFile}
      />
      {importError && (
        <div className="import-toast" role="alert">
          {importError}
        </div>
      )}
    </section>
  );
}

function Stat({
  label,
  value,
  muted,
}: {
  label: string;
  value: number;
  muted?: boolean;
}) {
  return (
    <div className={`stat${muted ? " stat--muted" : ""}`}>
      <span className="stat__value">{value}</span>
      <span className="stat__label">{label}</span>
    </div>
  );
}

function TextOutline({ nodes }: { nodes: GraphNode[] }) {
  return (
    <div className="outline">
      <ul className="outline__list">
        {nodes.map((n) => {
          const d = depthOf(n, nodes);
          return (
            <li
              key={n.id}
              className={`outline__item outline__item--d${Math.min(d, 5)}`}
              style={{ paddingLeft: 12 + d * 18 }}
            >
              <span className="outline__name">{n.name}</span>
              {n.type ? <span className="outline__type">{n.type}</span> : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function depthOf(node: GraphNode, nodes: GraphNode[]): number {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  let d = 0;
  let cur: GraphNode | undefined = node;
  const guard = new Set<string>();
  while (cur?.parent && byId.has(cur.parent) && !guard.has(cur.id)) {
    guard.add(cur.id);
    cur = byId.get(cur.parent);
    d++;
  }
  return d;
}

function NodeDetail({
  node,
  nodes,
  links,
  asModal,
  onClose,
}: {
  node: GraphNode;
  nodes: GraphNode[];
  links: GraphLink[];
  asModal: boolean;
  onClose: () => void;
}) {
  const meta = node.metadata ?? {};
  // Media: a playable video when the url is one (panel/dialog accept input,
  // unlike the hover tooltip), else the node's cover image. The image/cover
  // keys feed the media block — they don't repeat as text rows.
  const video = videoOf(node);
  const image = video ? null : mediaImageOf(node);
  // Short key/value fields go in the grid; a long prose "Summary" reads far
  // better as its own full-width block than crammed into the narrow value column.
  const metaRows = Object.entries(meta).filter(
    ([k]) => !["summary", "image", "cover"].includes(k.toLowerCase()),
  );
  const summary = Object.entries(meta).find(
    ([k]) => k.toLowerCase() === "summary",
  );
  const byId = new Map(nodes.map((n) => [n.id, n]));
  // Breadcrumb: root → … → node (its place in the tree).
  const trail: string[] = [];
  {
    let cur: GraphNode | undefined = node;
    const guard = new Set<string>();
    while (cur && !guard.has(cur.id)) {
      guard.add(cur.id);
      trail.push(cur.name);
      cur = cur.parent ? byId.get(cur.parent) : undefined;
    }
    trail.reverse();
  }
  // Cross-reference connections (the "related" nodes).
  const refs: string[] = [];
  {
    const seen = new Set<string>();
    for (const l of links) {
      if (l.kind !== "reference") continue;
      const other =
        l.source === node.id ? l.target : l.target === node.id ? l.source : null;
      if (!other || seen.has(other)) continue;
      seen.add(other);
      const o = byId.get(other);
      if (o) refs.push(o.name);
    }
  }
  // The card uses the same layout as the hover tooltip — full-bleed media,
  // name, breadcrumb, bold-key detail rows — at panel scale.
  const body = (
    <>
      <button
        type="button"
        className="icon-btn detail-close"
        onClick={onClose}
        aria-label="Close"
      >
        ×
      </button>
      {video ? (
        video.kind === "embed" ? (
          <iframe
            className="detail-media detail-media--video"
            src={video.src}
            title={node.name}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <video
            className="detail-media detail-media--video"
            src={video.src}
            controls
            playsInline
          />
        )
      ) : image ? (
        <img className="detail-media" src={image} alt="" loading="lazy" />
      ) : null}
      <h3 className="detail-name">{node.name}</h3>
      {trail.length > 1 ? (
        <p className="detail-path">
          {trail.map((t) => t.replace(/\n/g, " ")).join("  ›  ")}
        </p>
      ) : null}
      {metaRows.length > 0 && (
        <div className="detail-meta">
          {metaRows.map(([k, v]) => (
            <span key={k}>
              <b>{k}</b> {String(v)}
            </span>
          ))}
        </div>
      )}
      {summary && (
        <div className="detail-summary">
          <span className="detail-summary__label">{summary[0]}</span>
          <p className="detail-summary__text">{String(summary[1])}</p>
        </div>
      )}
      {refs.length > 0 && (
        <div className="detail-refs">
          <span className="detail-refs__label">References</span>
          {refs.map((r) => (
            <span key={r} className="detail-refs__chip">
              {r}
            </span>
          ))}
        </div>
      )}
      {node.url ? (
        <a className="detail-open" href={node.url} target="_blank" rel="noopener noreferrer">
          Open ↗
        </a>
      ) : null}
    </>
  );

  if (asModal) {
    return (
      <div className="overlay" role="dialog" aria-modal="true" aria-label={node.name}>
        <div className="overlay__scrim" onClick={onClose} />
        <div className="sheet">{body}</div>
      </div>
    );
  }
  // The scrim dims + freezes the graph behind the docked rail (click to close),
  // and covers any lingering hover tooltip.
  return (
    <>
      <div className="detail-scrim" onClick={onClose} />
      <aside className="detail-panel" role="dialog" aria-label={node.name}>
        {body}
      </aside>
    </>
  );
}
