import type { GraphDocument, GraphWarning } from "../types/graph";

export interface ValidationResult {
  warnings: GraphWarning[];
  /** Blocking problems (duplicate ids, dangling links, cycles, empty graph). */
  valid: boolean;
}

export function validateGraph(graph: GraphDocument): ValidationResult {
  const warnings: GraphWarning[] = [];
  let blocking = false;

  const ids = new Set<string>();
  const dupes = new Set<string>();
  for (const n of graph.nodes) {
    if (!n.id) {
      warnings.push({ code: "duplicate_id", message: "A node is missing an id." });
      blocking = true;
    } else if (ids.has(n.id)) {
      if (!dupes.has(n.id)) {
        warnings.push({ code: "duplicate_id", message: `Duplicate node id "${n.id}".` });
        dupes.add(n.id);
      }
      blocking = true;
    } else {
      ids.add(n.id);
    }
    if (!n.name || !n.name.trim()) {
      warnings.push({ code: "empty_label", message: `Node "${n.id}" has an empty name.` });
    }
  }

  if (graph.nodes.length === 0) {
    warnings.push({ code: "empty_label", message: "The graph has no nodes." });
    blocking = true;
  }

  // Link endpoints.
  for (const l of graph.links) {
    if (!ids.has(l.source) || !ids.has(l.target)) {
      warnings.push({
        code: "unresolved_reference",
        message: `Link ${l.source} → ${l.target} points to a missing node.`,
      });
      blocking = true;
    }
  }

  // Parents.
  for (const n of graph.nodes) {
    if (n.parent && !ids.has(n.parent)) {
      warnings.push({
        code: "missing_parent",
        message: `Parent "${n.parent}" of "${n.id}" does not exist.`,
      });
    }
  }

  // Roots.
  const roots = graph.nodes.filter((n) => !n.parent);
  if (roots.length > 1) {
    warnings.push({
      code: "multiple_roots",
      message: `${roots.length} top-level nodes — consider adding a single root.`,
    });
  }

  // Circular contains (DFS over the contains adjacency).
  const adj = new Map<string, string[]>();
  for (const l of graph.links) {
    if (l.kind !== "contains") continue;
    (adj.get(l.source) ?? adj.set(l.source, []).get(l.source)!).push(l.target);
  }
  const WHITE = 0,
    GRAY = 1,
    BLACK = 2;
  const color = new Map<string, number>();
  let cyclic = false;
  const visit = (id: string) => {
    color.set(id, GRAY);
    for (const next of adj.get(id) ?? []) {
      const c = color.get(next) ?? WHITE;
      if (c === GRAY) {
        cyclic = true;
        return;
      }
      if (c === WHITE) {
        visit(next);
        if (cyclic) return;
      }
    }
    color.set(id, BLACK);
  };
  for (const n of graph.nodes) {
    if ((color.get(n.id) ?? WHITE) === WHITE) visit(n.id);
    if (cyclic) break;
  }
  if (cyclic) {
    warnings.push({
      code: "circular_parent",
      message: "A circular containment chain was detected.",
    });
    blocking = true;
  }

  return { warnings, valid: !blocking };
}
