import {
  type DetectedFormat,
  type GraphDocument,
  type GraphNode,
  type GraphWarning,
  type Mapping,
  type NodeType,
  type RawInput,
  type SourceFormat,
  type TableData,
} from "../types/graph";
import { createIdFactory } from "./util";
import { parseOutline } from "./outline";

interface PendingRef {
  sourceId: string;
  rawTarget: string;
  row?: number;
  field?: string;
}

interface Ctx {
  nodes: GraphNode[];
  byId: Map<string, GraphNode>;
  links: GraphDocument["links"];
  warnings: GraphWarning[];
  containsSeen: Set<string>;
  refs: PendingRef[];
  newId: (raw: string) => string;
}

function createCtx(): Ctx {
  return {
    nodes: [],
    byId: new Map(),
    links: [],
    warnings: [],
    containsSeen: new Set(),
    refs: [],
    newId: createIdFactory(),
  };
}

function addContains(ctx: Ctx, source: string, target: string) {
  if (source === target) return;
  const key = `${source}\u0000${target}`;
  if (ctx.containsSeen.has(key)) return;
  ctx.containsSeen.add(key);
  ctx.links.push({ source, target, kind: "contains" });
}

const isUrlField = (f: string) => /^(url|link)$/i.test(f);

function applyTableMeta(node: GraphNode, row: Record<string, string>, fields: string[]) {
  const meta: Record<string, unknown> = { ...(node.metadata ?? {}) };
  for (const f of fields) {
    const v = (row[f] ?? "").trim();
    if (!v) continue;
    if (isUrlField(f)) node.url = v;
    else meta[f.toLowerCase()] = v;
  }
  if (Object.keys(meta).length) node.metadata = meta;
}

function collectRefs(
  ctx: Ctx,
  sourceId: string,
  row: Record<string, string>,
  fields: string[],
  rowIndex: number,
) {
  for (const f of fields) {
    const raw = (row[f] ?? "").trim();
    if (!raw) continue;
    for (const t of raw.split(/[,;]/).map((s) => s.trim()).filter(Boolean)) {
      ctx.refs.push({ sourceId, rawTarget: t, row: rowIndex, field: f });
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Path-based builders (level columns + path column)                          */
/* -------------------------------------------------------------------------- */

function segmentsFor(
  row: Record<string, string>,
  mapping: Mapping,
  format: DetectedFormat,
): string[] {
  if (format === "path_column" && mapping.pathField) {
    const sep = mapping.pathSeparator || "/";
    return (row[mapping.pathField] ?? "")
      .split(sep)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  // level columns — empty cells in the middle become placeholder markers so the
  // hierarchy shape is preserved; trailing empties are stripped (they just mean
  // "this row is the leaf at that column").
  const segs: string[] = [];
  for (const f of mapping.hierarchyFields) {
    const v = (row[f] ?? "").trim();
    if (v) segs.push(v);
    else if (segs.length > 0) segs.push("");
  }
  while (segs.length > 0 && segs[segs.length - 1] === "") segs.pop();
  return segs;
}

function buildFromPaths(
  ctx: Ctx,
  table: TableData,
  mapping: Mapping,
  format: DetectedFormat,
) {
  const pathToId = new Map<string, string>();
  const rootName = mapping.rootName?.trim();
  const metaFields = mapping.metadataFields.filter(
    (f) => !mapping.hierarchyFields.includes(f) && f !== mapping.pathField,
  );

  table.rows.forEach((row, idx) => {
    const segs = segmentsFor(row, mapping, format);
    if (segs.length === 0) return;
    const full = rootName ? [rootName, ...segs] : segs;
    const group = segs[0];

    let parentId: string | null = null;
    let pathKey = "";
    full.forEach((seg, segIdx) => {
      const isPlaceholder = seg === "";
      // Placeholder key is column-index-scoped so rows missing the same level
      // under the same parent always resolve to the same phantom node.
      const segKey = isPlaceholder ? "\x00" + segIdx : seg;
      pathKey = pathKey ? `${pathKey}/${segKey}` : segKey;
      let id = pathToId.get(pathKey);
      if (!id) {
        id = ctx.newId(pathKey);
        pathToId.set(pathKey, id);
        const node: GraphNode = {
          id,
          name: isPlaceholder ? "—" : seg,
          parent: parentId,
          group,
          ...(isPlaceholder && { metadata: { placeholder: true } }),
        };
        ctx.nodes.push(node);
        ctx.byId.set(id, node);
      }
      if (parentId) addContains(ctx, parentId, id);
      parentId = id;
    });

    const leaf = ctx.byId.get(parentId!)!;
    applyTableMeta(leaf, row, metaFields);
    collectRefs(ctx, leaf.id, row, mapping.referenceFields, idx);
  });
}

/* -------------------------------------------------------------------------- */
/* Parent-column builder                                                       */
/* -------------------------------------------------------------------------- */

function buildFromParent(ctx: Ctx, table: TableData, mapping: Mapping) {
  const idField = mapping.idField!;
  const parentField = mapping.parentField;
  const labelField = mapping.labelField;
  const metaFields = mapping.metadataFields.filter(
    (f) => f !== idField && f !== parentField && f !== labelField,
  );
  const parentOf = new Map<string, string>();

  table.rows.forEach((row, idx) => {
    const id = (row[idField] ?? "").trim();
    if (!id) {
      ctx.warnings.push({
        code: "empty_label",
        message: `Row ${idx + 1} has no id — skipped.`,
        row: idx + 1,
        field: idField,
      });
      return;
    }
    if (ctx.byId.has(id)) {
      ctx.warnings.push({
        code: "duplicate_id",
        message: `Duplicate id "${id}" — later row ignored.`,
        row: idx + 1,
        field: idField,
      });
      return;
    }
    const name = (labelField && (row[labelField] ?? "").trim()) || id;
    const node: GraphNode = { id, name, parent: null };
    applyTableMeta(node, row, metaFields);
    ctx.nodes.push(node);
    ctx.byId.set(id, node);
    const parentRaw = parentField ? (row[parentField] ?? "").trim() : "";
    if (parentRaw) parentOf.set(id, parentRaw);
    collectRefs(ctx, id, row, mapping.referenceFields, idx);
  });

  // Resolve parents now that all nodes exist.
  for (const node of ctx.nodes) {
    const parentRaw = parentOf.get(node.id);
    if (!parentRaw) continue;
    if (ctx.byId.has(parentRaw)) {
      node.parent = parentRaw;
      node.group = ctx.byId.get(parentRaw)?.group ?? node.group;
      addContains(ctx, parentRaw, node.id);
    } else {
      ctx.warnings.push({
        code: "missing_parent",
        message: `Parent "${parentRaw}" of "${node.id}" was not found.`,
      });
    }
  }
}

/* -------------------------------------------------------------------------- */
/* JSON manifest builder                                                       */
/* -------------------------------------------------------------------------- */

interface JsonNode {
  id?: unknown;
  name?: unknown;
  type?: unknown;
  parent?: unknown;
  group?: unknown;
  url?: unknown;
  metadata?: unknown;
}

function buildFromJson(ctx: Ctx, json: unknown) {
  const src = json as { nodes?: JsonNode[]; links?: Record<string, unknown>[] };
  const nodes = Array.isArray(src.nodes) ? src.nodes : [];

  nodes.forEach((n, idx) => {
    const id = String(n.id ?? "").trim() || ctx.newId(String(n.name ?? "node"));
    if (ctx.byId.has(id)) {
      ctx.warnings.push({
        code: "duplicate_id",
        message: `Duplicate id "${id}" — later node ignored.`,
        row: idx + 1,
      });
      return;
    }
    const node: GraphNode = {
      id,
      name: String(n.name ?? id),
      parent: n.parent != null ? String(n.parent) : null,
    };
    if (typeof n.type === "string") node.type = n.type as NodeType;
    if (typeof n.group === "string") node.group = n.group;
    if (typeof n.url === "string") node.url = n.url;
    if (n.metadata && typeof n.metadata === "object") {
      node.metadata = n.metadata as Record<string, unknown>;
    }
    ctx.nodes.push(node);
    ctx.byId.set(id, node);
  });

  // Explicit links.
  const links = Array.isArray(src.links) ? src.links : [];
  for (const l of links) {
    const s = String(l.source ?? "");
    const t = String(l.target ?? "");
    const kind = l.kind === "reference" ? "reference" : "contains";
    if (!ctx.byId.has(s) || !ctx.byId.has(t)) {
      ctx.warnings.push({
        code: "unresolved_reference",
        message: `Link ${s} → ${t} references a missing node.`,
      });
      continue;
    }
    if (kind === "contains") addContains(ctx, s, t);
    else
      ctx.links.push({
        source: s,
        target: t,
        kind: "reference",
        label: typeof l.label === "string" ? l.label : undefined,
      });
  }

  // Synthesize contains from parent, validate parents.
  for (const node of ctx.nodes) {
    if (!node.parent) continue;
    if (ctx.byId.has(node.parent)) addContains(ctx, node.parent, node.id);
    else {
      ctx.warnings.push({
        code: "missing_parent",
        message: `Parent "${node.parent}" of "${node.id}" was not found.`,
      });
      node.parent = null;
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Outline builder (markdown headings / bullets / numbered)                    */
/* -------------------------------------------------------------------------- */

function buildFromOutline(
  ctx: Ctx,
  text: string,
  format: DetectedFormat,
  mapping: Mapping,
) {
  const items = parseOutline(text, format);
  const rootName = mapping.rootName?.trim();
  const ancestors: string[] = [];
  const ancestorNames: string[] = [];

  if (rootName) {
    const id = ctx.newId(rootName);
    const node: GraphNode = { id, name: rootName, parent: null };
    ctx.nodes.push(node);
    ctx.byId.set(id, node);
    ancestors[0] = id;
    ancestorNames[0] = rootName;
  }
  const offset = rootName ? 1 : 0;

  items.forEach((it, idx) => {
    const depth = it.depth + offset;
    const parentId = depth > 0 ? ancestors[depth - 1] ?? null : null;
    const pathKey = [...ancestorNames.slice(0, depth), it.name].join("/");
    const id = ctx.newId(pathKey);
    const group = ancestorNames[offset] ?? it.name;
    const node: GraphNode = { id, name: it.name, parent: parentId, group };

    const meta: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(it.metadata)) {
      if (isUrlField(k)) node.url = v;
      else meta[k] = v;
    }
    if (Object.keys(meta).length) node.metadata = meta;

    ctx.nodes.push(node);
    ctx.byId.set(id, node);
    if (parentId) addContains(ctx, parentId, id);

    ancestors[depth] = id;
    ancestorNames[depth] = it.name;
    ancestors.length = depth + 1;
    ancestorNames.length = depth + 1;

    for (const ref of it.references) {
      ctx.refs.push({ sourceId: id, rawTarget: ref, row: idx + 1 });
    }
  });
}

/* -------------------------------------------------------------------------- */
/* Children-tree builder ({ name, children } dendrogram)                       */
/* -------------------------------------------------------------------------- */

function buildFromJsonTree(ctx: Ctx, json: unknown, mapping: Mapping) {
  const rootName = mapping.rootName?.trim();
  let topParentId: string | null = null;

  if (rootName) {
    const id = ctx.newId(rootName);
    const node: GraphNode = { id, name: rootName, parent: null };
    ctx.nodes.push(node);
    ctx.byId.set(id, node);
    topParentId = id;
  }

  const processNode = (raw: unknown, parentId: string | null, group: string | null) => {
    const obj = raw as Record<string, unknown>;
    const name = String(obj.name ?? "").trim() || "unnamed";
    const id = ctx.newId(name);
    const node: GraphNode = { id, name, parent: parentId };
    if (group) node.group = group;
    if (typeof obj.url === "string") node.url = obj.url;

    const skip = new Set(["name", "children", "url"]);
    const meta: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (!skip.has(k) && v !== null && v !== undefined && !Array.isArray(v))
        meta[k] = v;
    }
    if (Object.keys(meta).length) node.metadata = meta;

    ctx.nodes.push(node);
    ctx.byId.set(id, node);
    if (parentId) addContains(ctx, parentId, id);

    const children = Array.isArray(obj.children) ? obj.children : [];
    // Depth-1 children of the effective root each become their own colour group.
    const childGroup =
      parentId === null || parentId === topParentId ? name : (group ?? name);
    for (const child of children) {
      if (child && typeof child === "object" && !Array.isArray(child))
        processNode(child, id, childGroup);
    }
  };

  if (Array.isArray(json)) {
    for (const item of json)
      if (item && typeof item === "object") processNode(item, topParentId, null);
  } else if (json && typeof json === "object") {
    processNode(json, topParentId, null);
  }
}

/* -------------------------------------------------------------------------- */
/* Reference resolution + structural typing                                    */
/* -------------------------------------------------------------------------- */

function resolveReferences(ctx: Ctx) {
  const byName = new Map<string, string[]>();
  for (const n of ctx.nodes) {
    const key = n.name.trim().toLowerCase();
    (byName.get(key) ?? byName.set(key, []).get(key)!).push(n.id);
  }
  const refSeen = new Set<string>();

  for (const ref of ctx.refs) {
    let targetId: string | null = null;
    if (ctx.byId.has(ref.rawTarget)) {
      targetId = ref.rawTarget;
    } else {
      const cands = byName.get(ref.rawTarget.toLowerCase()) ?? [];
      if (cands.length === 1) targetId = cands[0];
      else if (cands.length > 1) {
        ctx.warnings.push({
          code: "ambiguous_reference",
          message: `Reference "${ref.rawTarget}" matches multiple nodes — not linked.`,
          row: ref.row,
          field: ref.field,
        });
        continue;
      }
    }
    if (!targetId) {
      ctx.warnings.push({
        code: "unresolved_reference",
        message: `Reference target "${ref.rawTarget}" was not found and was not linked.`,
        row: ref.row,
        field: ref.field,
      });
      continue;
    }
    const key = `${ref.sourceId}\u0000${targetId}`;
    if (ref.sourceId === targetId || refSeen.has(key)) continue;
    refSeen.add(key);
    ctx.links.push({ source: ref.sourceId, target: targetId, kind: "reference" });
  }
}

// Note: we no longer fabricate a node "type" from tree position (leaf →
// "document", etc). That labelled every childless node "Document" regardless of
// what it actually was — a photo, a person, a task — asserting an identity we
// can't know from structure. A node's type now comes only from the data: an
// explicit type set on a JSON manifest node, or (in the renderer) inferred from
// its url. No signal → no type.

/* -------------------------------------------------------------------------- */
/* Entry point                                                                 */
/* -------------------------------------------------------------------------- */

export function normalizeGraph(
  raw: RawInput,
  mapping: Mapping,
  format: DetectedFormat,
): GraphDocument {
  const ctx = createCtx();

  if (raw.kind === "json") {
    if (format === "json_tree") buildFromJsonTree(ctx, raw.json, mapping);
    else buildFromJson(ctx, raw.json);
  } else if (raw.kind === "markdown") {
    buildFromOutline(ctx, raw.text ?? "", format, mapping);
  } else if (raw.table) {
    if (format === "parent_column") buildFromParent(ctx, raw.table, mapping);
    else buildFromPaths(ctx, raw.table, mapping, format);
  }

  // Multiple roots are kept as-is — the data model tells the truth, so the
  // Review step can surface a multiple_roots warning and let the user wrap them
  // under a root of their choosing. Anchoring a forest is a *render* concern:
  // computePolarLayout lays the roots out in sectors, and d3Sunburst wraps them
  // under a virtual centre for stratify. (A synthetic root used to be injected
  // here — a4e8d1d — which silently suppressed the warning and pre-empted the
  // user's choice.)

  resolveReferences(ctx);

  const sourceFormat: SourceFormat =
    raw.format === "xlsx" ? "xlsx" : (raw.format as SourceFormat);

  return {
    nodes: ctx.nodes,
    links: ctx.links,
    warnings: ctx.warnings,
    source: { format: sourceFormat },
  };
}
