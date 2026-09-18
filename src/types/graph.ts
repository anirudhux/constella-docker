/* ===========================================================================
   Canonical graph schema + pipeline types.
   This is the single contract shared across parse → detect → normalize →
   validate → render → export. Mirrors the schema in the product docs
   (doc 01 §4 / doc 02 §9).
   ========================================================================== */

export type NodeType = "root" | "domain" | "folder" | "document" | "item";
export type LinkKind = "contains" | "reference";

export interface GraphNode {
  id: string;
  name: string;
  type?: NodeType;
  parent?: string | null;
  group?: string;
  url?: string;
  metadata?: Record<string, unknown>;
}

export interface GraphLink {
  source: string;
  target: string;
  kind: LinkKind;
  label?: string;
  metadata?: Record<string, unknown>;
}

export interface GraphWarning {
  /** Stable code, e.g. "unresolved_reference" (doc 01 §10). */
  code: string;
  message: string;
  row?: number;
  field?: string;
}

export type SourceFormat = "csv" | "xlsx" | "markdown" | "json" | "manual";

export interface GraphSource {
  format: SourceFormat;
  mapping?: Record<string, unknown>;
}

export interface GraphDocument {
  nodes: GraphNode[];
  links: GraphLink[];
  warnings?: GraphWarning[];
  source?: GraphSource;
}

/* --------------------------------------------------------------------------
   Input intermediate — what a parser produces before detection/mapping.
   -------------------------------------------------------------------------- */

/** The three user-facing input routes (doc 02 §6). */
export type InputKind = "spreadsheet" | "markdown" | "json";

export interface TableData {
  headers: string[];
  rows: Record<string, string>[];
}

export interface RawInput {
  kind: InputKind;
  format: SourceFormat;
  filename?: string;
  /** Present for csv / xlsx. */
  table?: TableData;
  /** Present for markdown. */
  text?: string;
  /** Present for json. */
  json?: unknown;
}

/* --------------------------------------------------------------------------
   Detection + mapping (doc 01 §6 / build plan §5–6).
   -------------------------------------------------------------------------- */

export type DetectedFormat =
  | "level_columns"
  | "parent_column"
  | "path_column"
  | "markdown_headings"
  | "indented_list"
  | "numbered_outline"
  | "json_graph"
  | "json_tree"
  | "unknown";

export interface Mapping {
  /** Ordered hierarchy fields for level-column inputs. */
  hierarchyFields: string[];
  idField: string | null;
  labelField: string | null;
  parentField: string | null;
  pathField: string | null;
  pathSeparator: string | null;
  referenceFields: string[];
  metadataFields: string[];
  /** Optional synthetic root for forests / multiple roots. */
  rootName?: string | null;
}

export interface DetectionResult {
  detectedFormat: DetectedFormat;
  confidence: number;
  suggestedMapping: Mapping;
  questions: string[];
  warnings: GraphWarning[];
}

export function emptyMapping(): Mapping {
  return {
    hierarchyFields: [],
    idField: null,
    labelField: null,
    parentField: null,
    pathField: null,
    pathSeparator: null,
    referenceFields: [],
    metadataFields: [],
    rootName: null,
  };
}
