import { useEffect, useState } from "react";
import { IconXcom, IconLinkedIn, IconShield, IconCheck } from "./icons";

/**
 * Global footer — one version everywhere. Leads with the product (brand +
 * tagline); the maker credit is a quiet secondary, then a divider and privacy.
 */
export function Footer() {
  const [showPrivacy, setShowPrivacy] = useState(false);
  return (
    <>
      <footer className="footer">
        <span className="footer__brand">
          <span className="footer__mark" aria-hidden="true">
            ✦
          </span>
          <span className="footer__name">Constella</span>
          <span className="footer__tag">
            Turn structured data into interactive graphs
          </span>
        </span>

        <div className="footer__end">
          <span className="footer__credit">
            <a
              className="footer__link"
              href="https://x.com/anirudhux"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="@anirudhux on X"
            >
              @anirudhux
              <IconXcom size={12} />
            </a>
            <a
              className="footer__link"
              href="https://www.linkedin.com/in/anirudhux"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="LinkedIn — anirudhux"
            >
              <IconLinkedIn size={12} />
            </a>
          </span>
          <span className="footer__div" aria-hidden="true" />
          <button
            type="button"
            className="footer__privacy"
            onClick={() => setShowPrivacy(true)}
          >
            <IconShield size={14} />
            Privacy
          </button>
        </div>
      </footer>
      {showPrivacy && <PrivacyModal onClose={() => setShowPrivacy(false)} />}
    </>
  );
}

const POINTS: { title: string; body: string }[] = [
  {
    title: "Nothing is uploaded",
    body: "Your spreadsheet, Markdown, or JSON is parsed and rendered on your device. The file never touches a server.",
  },
  {
    title: "Nothing is read or stored by us",
    body: "There is no backend, no database, and no account. We literally cannot see your data — it never leaves your browser.",
  },
  {
    title: "No tracking",
    body: "No analytics, no cookies, no fingerprinting, and no third-party scripts run on this page.",
  },
  {
    title: "It clears itself",
    body: "Your graph lives only in this tab's session storage, so a refresh keeps your place — and it is gone the moment you close the tab.",
  },
  {
    title: "Exports stay local",
    body: "Downloads (HTML, PNG, JSON) and copy actions are generated in your browser, with your graph data baked into the file. Nothing is sent to a server.",
  },
];

export function PrivacyModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Privacy">
      <div className="overlay__scrim" onClick={onClose} />
      <div className="sheet sheet--privacy">
        <div className="sheet__head">
          <h3 className="settings__title">Privacy</h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <p className="privacy-lead">
          Constella runs <strong>entirely in your browser</strong>. Here is
          exactly what that means for your data.
        </p>
        <ul className="privacy-list">
          {POINTS.map((p) => (
            <li className="privacy-item" key={p.title}>
              <span className="privacy-item__mark" aria-hidden="true">
                <IconCheck size={14} />
              </span>
              <span className="privacy-item__text">
                <span className="privacy-item__title">{p.title}</span>
                <span className="privacy-item__body">{p.body}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="note">
          In short: nothing is read, nothing is sent. The graph is yours and
          stays on your machine.
        </p>
      </div>
    </div>
  );
}
