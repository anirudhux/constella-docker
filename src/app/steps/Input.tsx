import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import type { DetectionResult, RawInput } from "../../types/graph";
import { ACCEPT_ALL, readAnyFile } from "../ingest";
import { detectStructure } from "../../core/detect";
import { HeroImage } from "../HeroImage";
import {
  IconUpload,
  IconTable,
  IconList,
  IconBraces,
} from "../../components/icons";

// Informational blurbs — what counts as "structured". These no longer filter
// the picker (one Upload button accepts everything; the parser is chosen from
// the file's own type). Each is led by a relevant glyph, centre-aligned.
const FORMATS: { key: string; icon: ReactNode; title: string; sub: string }[] = [
  {
    key: "spreadsheet",
    icon: <IconTable size={24} />,
    title: "Spreadsheet",
    sub: "CSV or Excel with hierarchy columns.",
  },
  {
    key: "markdown",
    icon: <IconList size={24} />,
    title: "Markdown outline",
    sub: "Headings, bullets, or a numbered outline.",
  },
  {
    key: "json",
    icon: <IconBraces size={24} />,
    title: "JSON manifest",
    sub: "A prepared nodes-and-links manifest.",
  },
];

interface InputStepProps {
  error: string | null;
  onReady: (raw: RawInput, detection: DetectionResult) => void;
  onError: (message: string) => void;
}

export function InputStep({ error, onReady, onError }: InputStepProps) {
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function finish(raw: RawInput) {
    try {
      onReady(raw, detectStructure(raw));
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not analyze the input.");
    }
  }

  // One importer for everything — the picker accepts all supported formats.
  function pickFile() {
    onError("");
    const input = fileRef.current;
    if (!input) return;
    input.value = ""; // allow re-picking the same file
    input.accept = ACCEPT_ALL;
    input.click();
  }

  async function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      finish(await readAnyFile(file)); // parser chosen from the file's type
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not read the file.");
    } finally {
      setBusy(false);
    }
  }

  // The "try it" path routes to the /v/atlas showcase URL rather than loading
  // in place — so trying the sample lands you on a shareable address (the URL
  // IS the demo), the same path a shared link takes. App.tsx's showcase effect
  // fetches + renders atlas.json.
  function loadSample() {
    window.history.pushState(null, "", "/v/atlas");
    window.dispatchEvent(new PopStateEvent("popstate"));
  }

  return (
    <section className="step step--center">
      <header className="hero">
        <HeroImage />
        <h1 className="hero__title">
          Turn structured data into an{" "}
          <span className="flourish">interactive hierarchy graph</span>.
        </h1>
        <p className="hero__sub">
          Import a spreadsheet, Markdown outline, or JSON manifest. You confirm
          the structure — nothing is inferred from your files.
        </p>
      </header>

      <div className="import-card">
        <div className="formats" aria-label="Supported formats">
          {FORMATS.map((f) => (
            <div className="format" key={f.key}>
              <span className="format__icon" aria-hidden>
                {f.icon}
              </span>
              <span className="format__title">{f.title}</span>
              <span className="format__sub">{f.sub}</span>
            </div>
          ))}
        </div>

        <div className="cta-row">
          <SampleLink busy={busy} onClick={loadSample} />
          <button
            type="button"
            className="upload-btn"
            disabled={busy}
            onClick={pickFile}
          >
            <IconUpload size={20} />
            Upload a structured file
          </button>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        className="visually-hidden"
        tabIndex={-1}
        aria-hidden="true"
        onChange={onFileChange}
      />

      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

function SampleLink({ busy, onClick }: { busy: boolean; onClick: () => void }) {
  // The sample JSON is a lazy chunk (kept out of the initial download), which
  // made this button a silent network fetch — on a slow connection a click
  // looked like a dead control. Warm the chunk as soon as the landing renders
  // so the click is instant, and show an explicit loading state as a fallback.
  useEffect(() => {
    // Warm the showcase file the button now navigates to (/v/atlas) so the
    // fetch is primed by click time.
    fetch("/showcase/atlas.json").catch(() => {
      /* offline warm-up miss — the /v/ path surfaces any real error */
    });
  }, []);
  return (
    <button
      type="button"
      className="sample-btn"
      disabled={busy}
      aria-busy={busy}
      onClick={onClick}
    >
      {busy ? "Loading the sample…" : "Try sample input"}
    </button>
  );
}
