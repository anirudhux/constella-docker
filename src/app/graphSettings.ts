import type {
  ClickAction,
  LabelMode,
  MotionMode,
  NodeStyle,
} from "../renderer/hybridGraph";
import type { GraphShape } from "../renderer/core/layout";

export interface GraphSettings {
  // Layout shape variant for the graph view (circle | spiral | infinity).
  shape: GraphShape;
  motion: MotionMode;
  motionSpeed: number;
  flattenOnInteraction: boolean;
  labelMode: LabelMode;
  labelSize: number;
  labelBackground: boolean;
  nodeStyle: NodeStyle;
  clickAction: ClickAction;
}

// Label text-size steps (px), small → large. The ceiling is deliberately
// modest: past ~16px the deepest/reference labels grow large enough to overlap
// and spill across the graph. These are the single source of truth — the
// A/A steppers walk one step per click, and persisted values are clamped
// to [first, last] on load.
export const LABEL_SIZE_STEPS = [10, 12, 14, 16] as const;
export const LABEL_SIZE_MIN = LABEL_SIZE_STEPS[0];
export const LABEL_SIZE_MAX = LABEL_SIZE_STEPS[LABEL_SIZE_STEPS.length - 1];

// One step up (+1) or down (-1) from the current size; snaps to the nearest
// step first so persisted off-step values behave predictably.
export function stepLabelSize(current: number, dir: 1 | -1): number {
  let idx = 0;
  let best = Infinity;
  LABEL_SIZE_STEPS.forEach((px, i) => {
    const d = Math.abs(px - current);
    if (d < best) {
      best = d;
      idx = i;
    }
  });
  return LABEL_SIZE_STEPS[
    Math.min(LABEL_SIZE_STEPS.length - 1, Math.max(0, idx + dir))
  ];
}

export const defaultGraphSettings: GraphSettings = {
  shape: "circle",
  // Auto-motion is retired (the graph is 2D-static); kept off for back-compat
  // with the config shape and the standalone export runtime.
  motion: "off",
  motionSpeed: 3,
  flattenOnInteraction: true,
  labelMode: "smart",
  labelSize: 12,
  labelBackground: false,
  nodeStyle: "flat",
  // The hover tooltip is always on (it's a hover behaviour, not a click one);
  // clicking opens the side panel by default, or the dialog.
  clickAction: "panel",
};

// Persist tuned settings for the session so a refresh keeps the user's
// appearance choices instead of snapping back to defaults.
const SETTINGS_KEY = "constella:settings:v1";

export function loadGraphSettings(): GraphSettings {
  if (typeof sessionStorage === "undefined") return defaultGraphSettings;
  try {
    const json = sessionStorage.getItem(SETTINGS_KEY);
    if (!json) return defaultGraphSettings;
    const saved = JSON.parse(json) as Partial<GraphSettings>;
    // Merge over defaults so a new setting added later still has a value.
    const merged = { ...defaultGraphSettings, ...saved };
    // "None" was removed as a label mode — coerce stale snapshots back to Smart.
    if ((merged.labelMode as string) === "none") merged.labelMode = "smart";
    // Node style is no longer user-selectable — always flat discs.
    merged.nodeStyle = "flat";
    // Click is panel or modal only now: the tooltip became an always-on hover
    // behaviour, and "url" / "none" were retired earlier. Coerce any stale
    // saved choice to the default. ("none" still exists internally for the
    // touch tap-to-focus path, but it's never persisted as a user selection.)
    if (!["panel", "modal"].includes(merged.clickAction as string)) {
      merged.clickAction = "panel";
    }
    // Shape landed after the store shipped — existing snapshots have no key,
    // and a stale/garbled value must never reach the layout. Whitelist-coerce.
    // "infinity" is PARKED (off the nav) — stored picks coerce back to circle
    // so nobody is stranded on a shape without a button.
    if (!["circle", "spiral"].includes(merged.shape as string)) {
      merged.shape = "circle";
    }
    // Clamp to the current bounds so a snapshot saved under an old (larger)
    // ceiling can't reintroduce chart-breaking label sizes.
    merged.labelSize = Math.min(
      LABEL_SIZE_MAX,
      Math.max(LABEL_SIZE_MIN, merged.labelSize),
    );
    return merged;
  } catch {
    return defaultGraphSettings;
  }
}

export function saveGraphSettings(settings: GraphSettings): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* non-fatal */
  }
}
