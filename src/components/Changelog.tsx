import {
  CHANGELOG,
  CHANGELOG_PREVIEW,
  type ChangeEntry,
} from "../app/changelog";
import { navigateTo } from "../app/routes";

/* Changelog — its own section, peer to the use-cases block: a centred header,
   the recent entries fused into one card, and "View all" linking to the full
   /changelog page. Data lives in app/changelog.ts. */
export function Changelog() {
  const recent = CHANGELOG.slice(0, CHANGELOG_PREVIEW);

  return (
    <section className="uc-changelog" aria-label="What's new">
      <div className="uc-changelog__head">
        <span className="uc-changelog__eyebrow">Changelog</span>
        <h2 className="uc-changelog__title">What&rsquo;s new</h2>
      </div>

      <div className="cl-card">
        <ul className="cl-list">
          {recent.map((e, i) => (
            <ChangeRow entry={e} key={i} />
          ))}
        </ul>
        <a
          className="uc-changelog__viewall"
          href="/changelog"
          onClick={(e) => {
            // Plain left-clicks route in-app; modified clicks (new tab) keep
            // native behaviour since /changelog is a real address.
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            e.preventDefault();
            navigateTo("/changelog");
          }}
        >
          View all &rarr;
        </a>
      </div>
    </section>
  );
}

/* The full changelog as a standalone page (the /changelog route). */
export function ChangelogPage() {
  return (
    <section className="uc-changelog uc-changelog--page" aria-label="Changelog">
      <div className="uc-changelog__head">
        <span className="uc-changelog__eyebrow">Changelog</span>
        <h2 className="uc-changelog__title">What&rsquo;s new</h2>
      </div>
      <div className="cl-card">
        <ul className="cl-list">
          {CHANGELOG.map((e, i) => (
            <ChangeRow entry={e} key={i} />
          ))}
        </ul>
      </div>
    </section>
  );
}

/* Stacked row: title → description → meta line (pill, then timestamp). */
function ChangeRow({ entry }: { entry: ChangeEntry }) {
  return (
    <li className="cl-item">
      <span className="cl-item__title">{entry.title}</span>
      <span className="cl-item__desc">{entry.desc}</span>
      <span className="cl-item__meta">
        <span className={`cl-tag cl-tag--${entry.kind}`}>
          {entry.kind === "new" ? "New" : "Improved"}
        </span>
        <span className="cl-item__date">{entry.date}</span>
      </span>
    </li>
  );
}
