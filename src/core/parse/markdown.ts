import type { RawInput } from "../../types/graph";

/**
 * Markdown is kept as raw text here; structure detection + normalization
 * interpret headings / indented bullets / numbered outlines (doc 01 §5.4–5.6).
 */
export function parseMarkdown(text: string, filename?: string): RawInput {
  if (!text.trim()) throw new Error("The outline is empty.");
  return { kind: "markdown", format: "markdown", filename, text };
}
