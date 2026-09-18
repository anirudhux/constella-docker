import { useEffect, useReducer, useState } from "react";
import { loadState, saveState, wizardReducer } from "./app/state";
import { useTheme } from "./app/useTheme";
import { StepRouter } from "./app/StepRouter";
import { Footer } from "./components/Footer";
import { LeaveConfirm, TopBar } from "./components/TopBar";
import { isAgentSession } from "./app/agentMode";
import { navigateTo } from "./app/routes";
import "./styles/app.css";

/* Thin composition root: owns the wizard state and the leave-guard. All chrome
   lives in TopBar/Footer; step content in StepRouter. This is the Docker/offline
   fork — the shell is upload → graph → export only. */
export default function App() {
  // Lazy-init from sessionStorage so a refresh restores the user's place.
  const [state, dispatch] = useReducer(wizardReducer, undefined, loadState);
  useEffect(() => {
    saveState(state);
  }, [state]);
  const { theme, toggle } = useTheme();

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

  // Start over resets the wizard and clears the address bar.
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
