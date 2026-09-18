import type {
  DetectionResult,
  GraphDocument,
  Mapping,
  RawInput,
} from "../types/graph";

// No review gate: an import either renders (output) or, when we're not
// confident enough to read it (below the 80% cut-off, or no hierarchy), lands
// on the "we can't map this" screen (unmappable).
export type WizardStep = "input" | "unmappable" | "output";

export const STEP_ORDER: WizardStep[] = ["input", "unmappable", "output"];

export const STEP_LABELS: Record<WizardStep, string> = {
  input: "Import",
  unmappable: "Import",
  output: "Graph",
};

export interface WizardState {
  step: WizardStep;
  raw: RawInput | null;
  detection: DetectionResult | null;
  mapping: Mapping | null;
  graph: GraphDocument | null;
  /** 0..1 share of rows that nest — shown on the unmappable step. */
  coverage: number;
  /** Whether a partial "render what fits" render is worth offering. */
  offerPartial: boolean;
  /** Set when the user chose a partial render → drives the Output banner. */
  partialCoverage: number | null;
  /** Top-level error shown on the current step (e.g. parse failure). */
  error: string | null;
}

export const initialState: WizardState = {
  step: "input",
  raw: null,
  detection: null,
  mapping: null,
  graph: null,
  coverage: 1,
  offerPartial: false,
  partialCoverage: null,
  error: null,
};

export type WizardAction =
  | { type: "goto"; step: WizardStep }
  | { type: "error"; message: string | null }
  | {
      type: "import_ready";
      raw: RawInput;
      detection: DetectionResult;
      mapping: Mapping;
      graph: GraphDocument | null;
      step: WizardStep;
      coverage: number;
      offerPartial: boolean;
    }
  | { type: "set_mapping"; mapping: Mapping }
  | { type: "graph_ready"; graph: GraphDocument }
  | { type: "render_partial"; graph: GraphDocument; coverage: number }
  | { type: "reset" };

/* --------------------------------------------------------------------------
   Session persistence — so a page reload (or a dev HMR full-reload) restores
   the user's place + loaded graph instead of dumping them back on Import.
   The whole wizard state is plain JSON (no File/Blob/function), so it
   round-trips cleanly. sessionStorage: survives refresh, clears on tab close.
   -------------------------------------------------------------------------- */
// Bump the version when the bundled sample/data shape changes so stale persisted
// snapshots are dropped and users pick up the new sample on next load.
const STORAGE_KEY = "constella:wizard:v2";

export function loadState(): WizardState {
  if (typeof sessionStorage === "undefined") return initialState;
  try {
    const json = sessionStorage.getItem(STORAGE_KEY);
    if (!json) return initialState;
    const saved = JSON.parse(json) as Partial<WizardState> | null;
    if (!saved || !STEP_ORDER.includes(saved.step as WizardStep))
      return initialState;
    // A data step with nothing loaded is incoherent — fall back to Import.
    if (
      saved.step !== "input" &&
      !saved.graph &&
      !saved.raw
    )
      return initialState;
    // Drop any stale transient error from the previous session.
    return { ...initialState, ...saved, error: null };
  } catch {
    return initialState;
  }
}

export function saveState(state: WizardState): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota / private-mode — persistence is best-effort, never fatal */
  }
}

export function wizardReducer(
  state: WizardState,
  action: WizardAction,
): WizardState {
  switch (action.type) {
    case "goto":
      return { ...state, step: action.step, error: null };
    case "error":
      return { ...state, error: action.message };
    case "import_ready":
      return {
        ...state,
        raw: action.raw,
        detection: action.detection,
        mapping: action.mapping,
        graph: action.graph,
        coverage: action.coverage,
        offerPartial: action.offerPartial,
        partialCoverage: null,
        error: null,
        step: action.step,
      };
    case "set_mapping":
      return { ...state, mapping: action.mapping };
    case "graph_ready":
      return { ...state, graph: action.graph, error: null, step: "output" };
    case "render_partial":
      return {
        ...state,
        graph: action.graph,
        partialCoverage: action.coverage,
        error: null,
        step: "output",
      };
    case "reset":
      return initialState;
    default:
      return state;
  }
}
