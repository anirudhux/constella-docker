import { useEffect, useRef, useState } from "react";
import type { Theme } from "../app/useTheme";
import { PrivacyModal } from "./Footer";
import { IconLinkedIn, IconShield, IconUpload, IconXcom } from "./icons";

/* The app header. Two variants:
   - the use-cases page: brand (→ home) + theme toggle
   - the wizard: brand (start over / leave-guard), and on the graph page the
     tagline, Upload CTA and hamburger menu instead of the bare theme toggle. */
export function TopBar({
  variant,
  theme,
  onToggleTheme,
  onBrandClick,
}: {
  /** "use-cases" = standalone page header; "wizard" = input/review/output. */
  variant: "use-cases" | "wizard-output" | "wizard";
  theme: Theme;
  onToggleTheme: () => void;
  onBrandClick: () => void;
}) {
  const onOutput = variant === "wizard-output";

  if (variant === "use-cases") {
    return (
      <header className="topbar">
        <button
          type="button"
          className="brand"
          onClick={onBrandClick}
          aria-label="Constella — home"
        >
          <span className="brand__mark" aria-hidden>
            ✦
          </span>
          <span className="brand__name">Constella</span>
        </button>

        <button
          type="button"
          className="icon-btn"
          onClick={onToggleTheme}
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        >
          {theme === "dark" ? "☀" : "☾"}
        </button>
      </header>
    );
  }

  return (
    <header className="topbar">
      <div className="topbar__lead">
        <button
          type="button"
          className="brand"
          onClick={onBrandClick}
          aria-label="Constella — start over"
        >
          <span className="brand__mark" aria-hidden>
            ✦
          </span>
          <span className="brand__name">Constella</span>
        </button>
        {/* On the graph page the footer is gone — the tagline lives here. */}
        {onOutput && (
          <span className="topbar__tag">
            Turn structured data into interactive graphs
          </span>
        )}
      </div>

      {onOutput ? (
        <div className="topbar__end">
          <span className="tip">
            <button
              type="button"
              className="btn btn--accent btn--icon"
              onClick={() =>
                window.dispatchEvent(new CustomEvent("constella:pick-upload"))
              }
            >
              <IconUpload size={16} /> Upload
              <span className="ctl-label"> New File</span>
            </button>
            <span className="tip__pop" role="tooltip">
              <strong>Structured</strong> files only · CSV, Excel, Markdown,
              JSON
            </span>
          </span>
          <TopMenu theme={theme} onToggleTheme={onToggleTheme} />
        </div>
      ) : (
        <button
          type="button"
          className="icon-btn"
          onClick={onToggleTheme}
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        >
          {theme === "dark" ? "☀" : "☾"}
        </button>
      )}
    </header>
  );
}

/* Warn before discarding an on-screen graph via the logo / start-over. */
export function LeaveConfirm({
  onStay,
  onLeave,
}: {
  onStay: () => void;
  onLeave: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onStay();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onStay]);

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Leave without sharing?">
      <div className="overlay__scrim" onClick={onStay} />
      <div className="sheet sheet--confirm">
        <h3 className="settings__title">Leave without sharing?</h3>
        <p className="privacy-lead">
          Are you sure you don't want to share or embed what you've created?
          Your graph lives only in this tab — leaving discards it.
        </p>
        <div className="confirm-actions">
          <button type="button" className="btn btn--ghost" onClick={onStay}>
            Keep working
          </button>
          <button type="button" className="btn btn--primary" onClick={onLeave}>
            Leave
          </button>
        </div>
      </div>
    </div>
  );
}

/* Hamburger menu on the graph page — holds what the footer carries elsewhere
   (maker links, privacy) plus the theme switch. */
function TopMenu({
  theme,
  onToggleTheme,
}: {
  theme: Theme;
  onToggleTheme: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="topmenu" ref={ref}>
      <button
        type="button"
        className="icon-btn"
        aria-label="Menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        ☰
      </button>
      {open && (
        <div className="topmenu__panel" role="menu">
          <button
            type="button"
            className="topmenu__item"
            role="menuitem"
            onClick={onToggleTheme}
          >
            <span className="topmenu__glyph" aria-hidden>
              {theme === "dark" ? "☀" : "☾"}
            </span>
            Switch to {theme === "dark" ? "light" : "dark"} mode
          </button>
          <span className="topmenu__sep" aria-hidden="true" />
          <a
            className="topmenu__item"
            role="menuitem"
            href="https://x.com/anirudhux"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="topmenu__glyph" aria-hidden>
              <IconXcom size={13} />
            </span>
            @anirudhux
          </a>
          <a
            className="topmenu__item"
            role="menuitem"
            href="https://www.linkedin.com/in/anirudhux"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="topmenu__glyph" aria-hidden>
              <IconLinkedIn size={13} />
            </span>
            LinkedIn
          </a>
          <span className="topmenu__sep" aria-hidden="true" />
          <button
            type="button"
            className="topmenu__item"
            role="menuitem"
            onClick={() => {
              setShowPrivacy(true);
              setOpen(false);
            }}
          >
            <span className="topmenu__glyph" aria-hidden>
              <IconShield size={14} />
            </span>
            Privacy
          </button>
        </div>
      )}
      {showPrivacy && <PrivacyModal onClose={() => setShowPrivacy(false)} />}
    </div>
  );
}
