import { readTextAsRaw } from "./ingest";
import type { RawInput } from "../types/graph";

/* The bundled demo — a 350-node "Atlas Knowledge Base". It loads in place from
   this bundled JSON, which Vite keeps as a lazy chunk (out of the initial
   download) and serves from the app's own origin — so "Try sample input" makes
   no outside request and works fully offline. */
export const SAMPLE_FILENAME = "atlas-knowledge-base.json";

/** Read the bundled sample into a RawInput, ready for the normal import flow. */
export async function loadSampleRaw(): Promise<RawInput> {
  const { default: text } = await import("./sample-atlas-350.json?raw");
  return readTextAsRaw("json", text, SAMPLE_FILENAME);
}

/** Prime the lazy sample chunk so the button click is instant. */
export function warmSample(): void {
  void import("./sample-atlas-350.json?raw").catch(() => {
    /* warm-up miss — the click surfaces any real error */
  });
}

/** Is this the bundled sample? The "Sample" badge keys off this. */
export function isSampleFile(filename?: string): boolean {
  return filename === SAMPLE_FILENAME;
}
