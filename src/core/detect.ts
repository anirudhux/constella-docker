import {
  emptyMapping,
  type DetectedFormat,
  type DetectionResult,
  type Mapping,
  type RawInput,
  type TableData,
} from "../types/graph";

const REFERENCE_HINTS = [
  "related",
  "links",
  "references",
  "reference",
  "link_to",
  "linkto",
  "depends_on",
  "dependson",
  "see_also",
  "seealso",
];

const METADATA_HINTS = [
  "owner",
  "url",
  "link",
  "updated",
  "date",
  "modified",
  "author",
  "tag",
  "tags",
  "type",
  "group",
  "summary",
  "description",
  "status",
  "note",
  "notes",
];

const LABEL_HINTS = ["page", "name", "title", "label", "document", "item"];

const LEVEL_RE = /^(level|lvl|l|tier|depth)[\s_-]*(\d+)$/i;
const PATH_SEPARATORS = ["/", ">", "|", "»", "›", "\\"];

const lc = (s: string) => s.trim().toLowerCase();
const isRef = (h: string) => REFERENCE_HINTS.includes(lc(h));
const isMeta = (h: string) => METADATA_HINTS.includes(lc(h));

/** Pick the most likely separator used inside a path column. */
function detectPathColumn(
  table: TableData,
): { field: string; separator: string } | null {
  const sample = table.rows.slice(0, 25);
  for (const header of table.headers) {
    for (const sep of PATH_SEPARATORS) {
      const withSep = sample.filter((r) =>
        (r[header] ?? "").includes(sep),
      ).length;
      if (sample.length > 0 && withSep / sample.length >= 0.6) {
        return { field: header, separator: sep };
      }
    }
  }
  return null;
}

function chooseLabel(candidates: string[]): string | null {
  for (const hint of LABEL_HINTS) {
    const hit = candidates.find((h) => lc(h) === hint);
    if (hit) return hit;
  }
  return candidates[candidates.length - 1] ?? null;
}

function detectTable(table: TableData): DetectionResult {
  const headers = table.headers;
  const lowered = headers.map(lc);
  const mapping = emptyMapping();
  const questions: string[] = [];

  const refFields = headers.filter(isRef);
  const metaFields = headers.filter(isMeta);

  // 2. Parent column: id + parent (build plan §5 priority 2).
  if (lowered.includes("id") && lowered.includes("parent")) {
    mapping.idField = headers[lowered.indexOf("id")];
    mapping.parentField = headers[lowered.indexOf("parent")];
    const nameIdx = lowered.indexOf("name") >= 0 ? lowered.indexOf("name") : lowered.indexOf("label");
    mapping.labelField = nameIdx >= 0 ? headers[nameIdx] : mapping.idField;
    mapping.referenceFields = refFields;
    mapping.metadataFields = metaFields.filter(
      (h) => h !== mapping.labelField && h !== mapping.parentField && h !== mapping.idField,
    );
    return result("parent_column", 0.92, mapping, questions);
  }

  // 3. Level columns: explicit Level N / Tier N headers.
  const levelCols = headers
    .map((h) => ({ h, m: h.match(LEVEL_RE) }))
    .filter((x) => x.m)
    .sort((a, b) => Number(a.m![2]) - Number(b.m![2]))
    .map((x) => x.h);
  if (levelCols.length >= 2) {
    mapping.hierarchyFields = levelCols;
    const leftover = headers.filter(
      (h) => !levelCols.includes(h) && !isRef(h) && !isMeta(h),
    );
    mapping.labelField = chooseLabel(leftover) ?? levelCols[levelCols.length - 1];
    if (mapping.labelField && !levelCols.includes(mapping.labelField)) {
      mapping.hierarchyFields = [...levelCols, mapping.labelField];
    }
    mapping.referenceFields = refFields;
    mapping.metadataFields = metaFields;
    return result("level_columns", 0.88, mapping, questions);
  }

  // 4. Path column: one column with consistent separators.
  const path = detectPathColumn(table);
  if (path) {
    mapping.pathField = path.field;
    mapping.pathSeparator = path.separator;
    mapping.referenceFields = refFields;
    mapping.metadataFields = headers.filter(
      (h) => h !== path.field && !isRef(h),
    );
    return result("path_column", 0.85, mapping, questions);
  }

  // Fallback: treat leading non-ref/non-meta columns as hierarchy. Lower
  // confidence → ask the user to confirm on the mapping screen.
  const hierarchy = headers.filter((h) => !isRef(h) && !isMeta(h));
  if (hierarchy.length >= 1) {
    mapping.hierarchyFields = hierarchy;
    mapping.labelField = hierarchy[hierarchy.length - 1];
    mapping.referenceFields = refFields;
    mapping.metadataFields = metaFields;
    questions.push("Which columns should define the hierarchy?");
    questions.push("Which column should be used as the node label?");
    return result("level_columns", 0.55, mapping, questions);
  }

  questions.push("Could not detect a hierarchy. Map the columns manually.");
  return result("unknown", 0.2, mapping, questions);
}

function detectMarkdown(text: string): DetectionResult {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const headingCount = lines.filter((l) => /^#{1,6}\s+\S/.test(l)).length;
  const numberedCount = lines.filter((l) => /^\s*\d+(\.\d+)*\.?\s+\S/.test(l)).length;
  const bulletCount = lines.filter((l) => /^\s*[-*+]\s+\S/.test(l)).length;

  const mapping = emptyMapping();
  if (headingCount >= 1) return result("markdown_headings", 0.9, mapping, []);
  if (numberedCount >= 2) return result("numbered_outline", 0.85, mapping, []);
  if (bulletCount >= 2) return result("indented_list", 0.85, mapping, []);
  return result("unknown", 0.3, mapping, [
    "No headings, bullets, or numbered outline found. Check the outline format.",
  ]);
}

function isTreeNode(v: unknown): boolean {
  return (
    v !== null &&
    typeof v === "object" &&
    !Array.isArray(v) &&
    typeof (v as { name?: unknown }).name === "string"
  );
}

function detectJson(json: unknown): DetectionResult {
  const mapping = emptyMapping();

  // Manifest format: { nodes: [...] }
  if (json && typeof json === "object" && Array.isArray((json as { nodes?: unknown }).nodes)) {
    return result("json_graph", 0.95, mapping, []);
  }

  // Children-tree format: { name, children } or [{ name, children }, ...]
  const firstItem = Array.isArray(json) ? json[0] : json;
  if (isTreeNode(firstItem) && "children" in (firstItem as object)) {
    return result("json_tree", 0.9, mapping, []);
  }
  if (isTreeNode(firstItem)) {
    return result("json_tree", 0.75, mapping, []);
  }

  return result("unknown", 0.25, mapping, [
    'Expected { nodes } manifest or a { name, children } tree.',
  ]);
}

function result(
  detectedFormat: DetectedFormat,
  confidence: number,
  suggestedMapping: Mapping,
  questions: string[],
): DetectionResult {
  return { detectedFormat, confidence, suggestedMapping, questions, warnings: [] };
}

export function detectStructure(raw: RawInput): DetectionResult {
  if (raw.kind === "json") return detectJson(raw.json);
  if (raw.kind === "markdown") return detectMarkdown(raw.text ?? "");
  if (raw.table) return detectTable(raw.table);
  return result("unknown", 0, emptyMapping(), ["No input to analyze."]);
}
