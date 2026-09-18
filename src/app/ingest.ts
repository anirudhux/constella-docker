import type { InputKind, RawInput } from "../types/graph";
import { parseCsv } from "../core/parse/csv";
import { parseJson } from "../core/parse/json";
import { parseMarkdown } from "../core/parse/markdown";
import { parseXlsx } from "../core/parse/xlsx";

export const ACCEPT: Record<InputKind, string> = {
  spreadsheet: ".csv,.tsv,.xlsx,.xls",
  markdown: ".md,.markdown,.txt",
  json: ".json,.txt",
};

// The importer accepts every supported format at once — the picker no longer
// filters by a chosen tile; the parser is selected from the file's real type.
export const ACCEPT_ALL = ".csv,.tsv,.xlsx,.xls,.md,.markdown,.json,.txt";

function isExcel(name: string): boolean {
  return /\.xlsx?$/i.test(name);
}

// Map a filename to its parser route by extension. Returns null for ambiguous
// types (.txt / unknown) so the caller can sniff the content instead.
function kindFromName(name: string): InputKind | null {
  if (/\.(xlsx?|csv|tsv)$/i.test(name)) return "spreadsheet";
  if (/\.json$/i.test(name)) return "json";
  if (/\.(md|markdown)$/i.test(name)) return "markdown";
  return null;
}

/**
 * Read any supported file, choosing the parser from the file itself (its
 * extension, with a content sniff for ambiguous .txt) rather than from a tile.
 */
export async function readAnyFile(file: File): Promise<RawInput> {
  const name = file.name;
  const known = kindFromName(name);
  if (known === "spreadsheet" && isExcel(name)) {
    return parseXlsx(await file.arrayBuffer(), name);
  }
  const text = await file.text();
  if (known) return readTextAsRaw(known, text, name);
  // Ambiguous (.txt / unknown): JSON-looking content → JSON, else a Markdown outline.
  const head = text.trimStart();
  const kind: InputKind = head.startsWith("{") || head.startsWith("[") ? "json" : "markdown";
  return readTextAsRaw(kind, text, name);
}

/** Read a dropped/browsed File into a RawInput for the chosen route. */
export async function readFileAsRaw(
  kind: InputKind,
  file: File,
): Promise<RawInput> {
  const name = file.name;
  if (kind === "spreadsheet" && isExcel(name)) {
    const buffer = await file.arrayBuffer();
    return parseXlsx(buffer, name);
  }
  const text = await file.text();
  return readTextAsRaw(kind, text, name);
}

/** Read pasted/typed text into a RawInput for the chosen route. */
export function readTextAsRaw(
  kind: InputKind,
  text: string,
  filename?: string,
): RawInput {
  switch (kind) {
    case "spreadsheet":
      return parseCsv(text, filename);
    case "markdown":
      return parseMarkdown(text, filename);
    case "json":
      return parseJson(text, filename);
  }
}
