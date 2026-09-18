import { Suspense, lazy, type Dispatch } from "react";
import type { Theme } from "./useTheme";
import type { WizardAction, WizardState } from "./state";
import { InputStep } from "./steps/Input";
import { UnmappableStep } from "./steps/Unmappable";
import { decideImport } from "./importFlow";

// The output step pulls in Three.js — load it only when reached.
const OutputStep = lazy(() =>
  import("./steps/Output").then((m) => ({ default: m.OutputStep })),
);

/* Renders whichever wizard step is active. Pure routing — all state lives in
   the reducer owned by App. */
export function StepRouter({
  state,
  dispatch,
  theme,
}: {
  state: WizardState;
  dispatch: Dispatch<WizardAction>;
  theme: Theme;
}) {
  return (
    <>
      {state.step === "input" && (
        <InputStep
          error={state.error}
          onReady={(raw, detection) => {
            const { mapping, graph, step, coverage, offerPartial } = decideImport(raw, detection);
            dispatch({ type: "import_ready", raw, detection, mapping, graph, step, coverage, offerPartial });
          }}
          onError={(message) => dispatch({ type: "error", message: message || null })}
        />
      )}
      {state.step === "unmappable" && (
        <UnmappableStep state={state} dispatch={dispatch} />
      )}
      {state.step === "output" && (
        <Suspense fallback={<p className="note" style={{ padding: 24 }}>Loading graph…</p>}>
          <OutputStep state={state} dispatch={dispatch} theme={theme} />
        </Suspense>
      )}
    </>
  );
}
