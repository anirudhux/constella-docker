import { useMemo } from "react";
import type { GraphDocument } from "../../types/graph";

/* A cheap, static SVG sketch of a graph's shape — enough for a person to
   recognise "that's how mine is organised" without spinning up the real
   renderer. Layered top-down: roots on top, each tier a row below. */

interface Props {
  graph: GraphDocument;
  width?: number;
  height?: number;
}

const MAX_NODES = 60;

export function GraphPreview({ graph, width = 300, height = 150 }: Props) {
  const layout = useMemo(() => {
    const byId = new Map(graph.nodes.map((n) => [n.id, n]));
    const depthOf = (id: string): number => {
      let d = 0;
      let cur = byId.get(id);
      const seen = new Set<string>();
      while (cur && cur.parent && !seen.has(cur.id)) {
        seen.add(cur.id);
        d++;
        cur = byId.get(cur.parent);
      }
      return d;
    };

    const nodes = graph.nodes.slice(0, MAX_NODES);
    const shown = new Set(nodes.map((n) => n.id));
    const rows = new Map<number, string[]>();
    for (const n of nodes) {
      const d = depthOf(n.id);
      (rows.get(d) ?? rows.set(d, []).get(d)!).push(n.id);
    }
    const maxD = Math.max(0, ...rows.keys());

    const padX = 14;
    const padY = 16;
    const pos = new Map<string, { x: number; y: number }>();
    for (const [d, ids] of rows) {
      const y = maxD === 0 ? height / 2 : padY + (d / maxD) * (height - 2 * padY);
      ids.forEach((id, i) => {
        const x = padX + ((i + 1) / (ids.length + 1)) * (width - 2 * padX);
        pos.set(id, { x, y });
      });
    }

    const edges: { x1: number; y1: number; x2: number; y2: number }[] = [];
    for (const n of nodes) {
      if (!n.parent || !shown.has(n.parent)) continue;
      const a = pos.get(n.id);
      const b = pos.get(n.parent);
      if (a && b) edges.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
    }

    const dots = nodes.map((n) => ({
      ...pos.get(n.id)!,
      root: !n.parent,
    }));
    return { edges, dots };
  }, [graph, width, height]);

  return (
    <svg
      className="gpreview"
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      role="img"
      aria-label="Preview of this reading's graph shape"
    >
      {layout.edges.map((e, i) => (
        <line
          key={i}
          x1={e.x1}
          y1={e.y1}
          x2={e.x2}
          y2={e.y2}
          className="gpreview__edge"
        />
      ))}
      {layout.dots.map((d, i) => (
        <circle
          key={i}
          cx={d.x}
          cy={d.y}
          r={d.root ? 4.5 : 3}
          className={d.root ? "gpreview__node gpreview__node--root" : "gpreview__node"}
        />
      ))}
    </svg>
  );
}
