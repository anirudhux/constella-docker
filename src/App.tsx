import { useEffect, useReducer, useState } from "react";
import { loadState, saveState, wizardReducer } from "./app/state";
import { useTheme } from "./app/useTheme";
import { StepRouter } from "./app/StepRouter";
import { Footer } from "./components/Footer";
import { LeaveConfirm, TopBar } from "./components/TopBar";
import { isAgentSession } from "./app/agentMode";
import { navigateTo, usePath } from "./app/routes";
import {
  showcaseFileFor,
  showcaseSlugFromPath,
  showcaseTitleFor,
} from "./config/showcase";
import { readTextAsRaw } from "./app/ingest";
import { detectStructure } from "./core/detect";
import { decideImport } from "./app/importFlow";
import "./styles/app.css";

/* Thin composition root: owns the wizard state, path routing, and the
   leave-guard. All chrome lives in TopBar/Footer; step content in StepRouter.
   This is the Docker/offline fork: the marketing pages (use-cases, changelog,
   bench) are gone — the shell is upload → graph → export only. */
export default function App() {
  // Lazy-init from sessionStorage so a refresh restores the user's place.
  const [state, dispatch] = useReducer(wizardReducer, undefined, loadState);
  useEffect(() => {
    saveState(state);
  }, [state]);
  const { theme, toggle } = useTheme();

  const path = usePath();

  // Vertical URLs (/v/<slug>): the slug IS the filename — showcase/<slug>.json
  // auto-loads and renders, so a curated file can live at a clean address.
  // Missing files fall through to the home page.
  const showcaseSlug = showcaseSlugFromPath(path);
  const [showcaseTitle, setShowcaseTitle] = useState<string | null>(null);
  useEffect(() => {
    if (!showcaseSlug) {
      setShowcaseTitle(null);
      return;
    }
    let cancelled = false;
    const bail = () => {
      window.history.replaceState(null, "", "/");
      window.dispatchEvent(new PopStateEvent("popstate"));
    };
    void (async () => {
      try {
        const res = await fetch(showcaseFileFor(showcaseSlug));
        const type = res.headers.get("content-type") ?? "";
        if (!res.ok || type.includes("text/html")) throw new Error("not found");
        const text = await res.text();
        if (cancelled) return;
        // Same pipeline as an uploaded JSON — curated files earn no bypass
        // of parsing/validation, only of the upload step itself.
        const raw = readTextAsRaw("json", text, `${showcaseSlug}.json`);
        const detection = detectStructure(raw);
        const { mapping, graph, step, coverage, offerPartial } = decideImport(raw, detection);
        dispatch({ type: "import_ready", raw, detection, mapping, graph, step, coverage, offerPartial });
        const rootName = graph?.nodes.find((n) => !n.parent)?.name;
        setShowcaseTitle(showcaseTitleFor(showcaseSlug, rootName));
      } catch {
        if (!cancelled) bail();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showcaseSlug]);

  // Page title: a loaded showcase names itself; the wizard keeps the default.
  useEffect(() => {
    document.title = showcaseTitle
      ? showcaseTitle
      : "Constella — Hybrid Hierarchy Graph";
  }, [showcaseTitle]);

  const onInput = state.step === "input";
  const onOutput = state.step === "output";

  // Leave-guard: once a graph is on screen, warn before discarding it — whether
  // by clicking the logo (in-app "start over") or closing/reloading the tab.
  // Skipped for agent-driven sessions and in dev (HMR full-reloads would fire
  // the native confirm on every source edit; nothing is lost on an HMR reload).
  const [confirmLeave, setConfirmLeave] = useState(false);
  useEffect(() => {
    if (!onOutput || isAgentSession() || import.meta.env.DEV) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [onOutput]);

  // Start over must also clear the address: on a /v/ showcase URL a bare state
  // reset left the URL stale. navigateTo("/") no-ops when already home.
  const startOver = () => {
    navigateTo("/");
    dispatch({ type: "reset" });
  };
  const onBrandClick = () => {
    if (onOutput) setConfirmLeave(true);
    else startOver();
  };

  return (
    <div className="app">
      {onInput && <div className="dot-field" aria-hidden />}
      <div className="glow" aria-hidden />

      <TopBar
        variant={onOutput ? "wizard-output" : "wizard"}
        theme={theme}
        onToggleTheme={toggle}
        onBrandClick={onBrandClick}
      />

      <main
        className={`content${onInput ? " content--home" : ""}${
          onOutput ? " content--wide content--canvas" : ""
        }`}
      >
        <StepRouter state={state} dispatch={dispatch} theme={theme} />
      </main>

      {/* The graph page gives all its vertical space to the canvas — its
          footer contents live in the header menu instead. */}
      {!onOutput && <Footer />}

      {confirmLeave && (
        <LeaveConfirm
          onStay={() => setConfirmLeave(false)}
          onLeave={() => {
            setConfirmLeave(false);
            startOver();
          }}
        />
      )}
    </div>
  );
}
