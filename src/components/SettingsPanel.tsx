import type { ReactNode } from "react";
import type { GraphSettings } from "../app/graphSettings";

interface SettingsPanelProps {
  settings: GraphSettings;
  onChange: (patch: Partial<GraphSettings>) => void;
  onClose: () => void;
}

// "None" is intentionally absent — a labels-off graph isn't a useful state here.
const LABEL_MODES: {
  value: GraphSettings["labelMode"];
  label: string;
  hint: string;
}[] = [
  { value: "smart", label: "Smart", hint: "Show what fits" },
  { value: "parents", label: "Parents only", hint: "Top two levels" },
  { value: "all", label: "All", hint: "Every node" },
];

// Discrete text-size levels (small → large) come from graphSettings so the
// bounds stay the single source of truth.

// The hover tooltip is not listed here — it's a hover behaviour, always on.
// Click decides only what opens.
const CLICK_ACTIONS: {
  value: GraphSettings["clickAction"];
  label: string;
  hint: string;
  icon: ReactNode;
}[] = [
  {
    value: "panel",
    label: "Side panel",
    hint: "Full details slide in from the right",
    icon: <PanelIcon />,
  },
  {
    value: "modal",
    label: "Dialog",
    hint: "Full details open in a centered dialog",
    icon: <DialogIcon />,
  },
];

export function SettingsPanel({ settings, onChange, onClose }: SettingsPanelProps) {
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Graph settings">
      <div className="overlay__scrim" onClick={onClose} />
      <div className="sheet sheet--settings">
        <div className="sheet__head">
          <h3 className="settings__title">Settings</h3>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Close settings"
          >
            ×
          </button>
        </div>

        <section className="set-group">
          <h4 className="set-group__title">Labels</h4>
          <div className="set-field">
            <span className="set-field__label">Mode</span>
            <div className="tiles tiles--3" role="group" aria-label="Label mode">
              {LABEL_MODES.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  className={`tile tile--compact${settings.labelMode === o.value ? " is-active" : ""}`}
                  aria-pressed={settings.labelMode === o.value}
                  onClick={() => onChange({ labelMode: o.value })}
                >
                  <span className="tile__label">{o.label}</span>
                  <span className="tile__hint">{o.hint}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="set-field">
            <span className="set-field__label">Label background</span>
            <div className="tiles tiles--2" role="group" aria-label="Label background">
              {[true, false].map((on) => (
                <button
                  key={String(on)}
                  type="button"
                  className={`tile tile--bg${settings.labelBackground === on ? " is-active" : ""}`}
                  aria-pressed={settings.labelBackground === on}
                  onClick={() => onChange({ labelBackground: on })}
                >
                  <span className="bg-sample" aria-hidden="true">
                    <span className="bg-sample__wire" />
                    <span className="bg-sample__dot bg-sample__dot--a" />
                    <span className="bg-sample__dot bg-sample__dot--b" />
                    <span
                      className={`bg-sample__label${on ? " bg-sample__label--shaded" : ""}`}
                    >
                      Node
                    </span>
                  </span>
                  <span className="tile__label">{on ? "On" : "Off"}</span>
                  <span className="tile__hint">
                    {on ? "Shaded backing for contrast" : "Plain text labels"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="set-group">
          <h4 className="set-group__title">Click behavior</h4>
          <div className="set-field">
            <span className="set-field__label">Clicking a node opens</span>
            <div className="tiles tiles--2" role="group" aria-label="Click behavior">
              {CLICK_ACTIONS.map((o) => {
                const active = settings.clickAction === o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    className={`tile tile--click${active ? " is-active" : ""}`}
                    aria-pressed={active}
                    onClick={() => onChange({ clickAction: o.value })}
                  >
                    <span className="tile__icon" aria-hidden="true">
                      {o.icon}
                    </span>
                    <span className="tile__label">{o.label}</span>
                    <span className="tile__hint">{o.hint}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

/* ---- inline illustrations (currentColor, theme-aware) ------------------- */


function PanelIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4.5" width="18" height="15" rx="2.5" />
      <line x1="14.5" y1="4.5" x2="14.5" y2="19.5" />
      <rect x="14.5" y="4.5" width="6.5" height="15" rx="0" fill="currentColor" stroke="none" opacity="0.16" />
      <line x1="16.6" y1="9" x2="19" y2="9" opacity="0.7" />
      <line x1="16.6" y1="12" x2="19" y2="12" opacity="0.7" />
    </svg>
  );
}

function DialogIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4.5" width="18" height="15" rx="2.5" opacity="0.4" />
      <rect x="6.5" y="8" width="11" height="8" rx="2" fill="currentColor" stroke="none" opacity="0.16" />
      <rect x="6.5" y="8" width="11" height="8" rx="2" />
    </svg>
  );
}

