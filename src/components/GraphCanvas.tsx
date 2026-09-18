import { useEffect, useRef } from "react";
import {
  mountHybridGraph,
  type HybridGraphConfig,
  type HybridGraphHandle,
} from "../renderer/hybridGraph";
import { mountSunburst } from "../renderer/d3Sunburst";
import type { GraphDocument } from "../types/graph";

export type VizType = "graph" | "sunburst";

interface GraphCanvasProps {
  data: GraphDocument;
  config: HybridGraphConfig;
  vizType?: VizType;
  onReady?: (handle: HybridGraphHandle | null) => void;
}

export function GraphCanvas({ data, config, vizType = "graph", onReady }: GraphCanvasProps) {
  const elRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HybridGraphHandle | null>(null);
  const configRef = useRef(config);
  configRef.current = config;
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  // Layout shape is fixed per mount (positions are static by design — no live
  // relayout), so a shape change must remount rather than patch via update().
  const shape = config.shape ?? "circle";
  // The sunburst reads its colours from the DOM once at mount and has no
  // update() path — without this key a live theme toggle leaves it painted in
  // the old palette until the next view switch. The hybrid graph re-reads
  // through update(), so keying on bg is a no-op remount avoided there.
  const themeKey = vizType === "sunburst" ? config.theme.bg : "";

  // Remount whenever data, viz type, layout shape, or (sunburst) theme changes.
  useEffect(() => {
    if (!elRef.current) return;
    let handle: HybridGraphHandle;
    if (vizType === "sunburst") {
      handle = mountSunburst(elRef.current, data);
    } else {
      handle = mountHybridGraph(elRef.current, data, configRef.current);
    }
    handleRef.current = handle;
    if (import.meta.env.DEV) (window as unknown as { __hg?: unknown }).__hg = handle;
    onReadyRef.current?.(handle);
    return () => {
      handle.destroy();
      handleRef.current = null;
      onReadyRef.current?.(null);
    };
  }, [data, vizType, shape, themeKey]);

  // Live config patches apply only to the hybrid graph renderer.
  useEffect(() => {
    if (vizType === "graph") handleRef.current?.update(config);
  }, [config, vizType]);

  return <div ref={elRef} className="graph-canvas" />;
}
