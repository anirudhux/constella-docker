import { useRef, type ChangeEvent, type Dispatch } from "react";
import type { GraphDocument } from "../../types/graph";
import type { WizardAction, WizardState } from "../state";
import { ACCEPT_ALL, readAnyFile } from "../ingest";
import { detectStructure } from "../../core/detect";
import { compatibleSubgraph, coverageOf, decideImport } from "../importFlow";
import { GraphPreview } from "./GraphPreview";

interface StepProps {
  state: WizardState;
  dispatch: Dispatch<WizardAction>;
}

// A tiny hand-built hierarchy, only to SHOW what "parent → child" looks like.
const EXAMPLE: GraphDocument = {
  nodes: [
    { id: "r", name: "Company", parent: null },
    { id: "a", name: "Sales", parent: "r" },
    { id: "b", name: "Engineering", parent: "r" },
    { id: "a1", name: "East", parent: "a" },
    { id: "a2", name: "West", parent: "a" },
    { id: "b1", name: "Backend", parent: "b" },
    { id: "b2", name: "Frontend", parent: "b" },
  ],
  links: [],
};

/* Shown when a file can't be read as a hierarchy confidently (below the 80%
   cut-off, or no hierarchy at all). Not an error — the file is fine, it's just
   not structured clearly enough to map. Voice stays product-neutral: no "we".
   The user tweaks their own file and re-uploads it here. */
export function UnmappableStep({ state, dispatch }: StepProps) {
  const name = state.raw?.filename ?? "your file";
  const pct = Math.round(state.coverage * 100);
  const fileRef = useRef<HTMLInputElement>(null);

  function renderPartial() {
    if (!state.graph) return;
    const sub = compatibleSubgraph(state.graph);
    dispatch({
      type: "render_partial",
      graph: sub,
      coverage: coverageOf(state.graph),
    });
  }

  async function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const raw = await readAnyFile(file);
      const detection = detectStructure(raw);
      const { mapping, graph, step, coverage, offerPartial } = decideImport(raw, detection);
      dispatch({ type: "import_ready", raw, detection, mapping, graph, step, coverage, offerPartial });
    } catch {
      // A broken re-upload belongs on the Input error card, not here.
      dispatch({ type: "reset" });
    }
  }

  return (
    <section className="step step--unmappable">
      <div className="unmappable">
        <h2 className="unmappable__title">
          This file isn't structured enough to map
        </h2>

        <ul className="unmappable__points">
          <li>
            Only <strong>{pct ?? 0}%</strong> of <strong>{name}</strong> is laid
            out in a way that reads as a hierarchy — the rest doesn't form a
            clear parent-and-child shape.
          </li>
          <li>
            A Constella map needs that hierarchy: a top item, its groups, and
            their items.
          </li>
          <li>
            Adjust the file so more of it nests that way, then upload it again.
          </li>
        </ul>

        <div className="unmappable__example">
          <div className="unmappable__example-canvas">
            <GraphPreview graph={EXAMPLE} />
          </div>
          <p className="unmappable__example-cap">
            What a hierarchy looks like: one top item branching into groups, and
            those into their items.
          </p>
        </div>

        <div className="actions">
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => fileRef.current?.click()}
          >
            Upload updated file
          </button>
          {state.offerPartial && (
            <button
              type="button"
              className="btn btn--ghost"
              onClick={renderPartial}
            >
              Render the {pct}% that fits
            </button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPT_ALL}
          hidden
          onChange={onFileChange}
        />
      </div>
    </section>
  );
}
