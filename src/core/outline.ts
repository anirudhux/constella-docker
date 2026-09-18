import type { DetectedFormat } from "../types/graph";

export interface OutlineItem {
  depth: number; // 0-based hierarchy depth
  name: string;
  metadata: Record<string, string>;
  references: string[];
}

interface RawItem {
  rank: number; // heading level, indent width, or number-segment count
  name: string;
  metadata: Record<string, string>;
  references: string[];
}

const REF_KEYS = new Set(["related", "links", "references", "reference", "depends_on", "see_also"]);

/** A "key: value" line directly beneath a heading. */
function parseKeyValue(line: string): { key: string; value: string } | null {
  const m = line.match(/^([A-Za-z][\w \-]*):\s*(.+)$/);
  if (!m) return null;
  return { key: m[1].trim().toLowerCase(), value: m[2].trim() };
}

function attach(item: RawItem, key: string, value: string) {
  if (REF_KEYS.has(key)) {
    for (const ref of value.split(/[,;]/).map((s) => s.trim()).filter(Boolean)) {
      item.references.push(ref);
    }
  } else {
    item.metadata[key] = value;
  }
}

function parseHeadings(lines: string[]): RawItem[] {
  const items: RawItem[] = [];
  let current: RawItem | null = null;
  for (const line of lines) {
    const h = line.match(/^(#{1,6})\s+(.*\S)\s*$/);
    if (h) {
      current = { rank: h[1].length, name: h[2].trim(), metadata: {}, references: [] };
      items.push(current);
      continue;
    }
    const kv = current ? parseKeyValue(line.trim()) : null;
    if (current && kv) attach(current, kv.key, kv.value);
  }
  return items;
}

function parseBullets(lines: string[]): RawItem[] {
  const items: RawItem[] = [];
  for (const line of lines) {
    const m = line.match(/^(\s*)[-*+]\s+(.*\S)\s*$/);
    if (!m) continue;
    const indent = m[1].replace(/\t/g, "  ").length;
    const item: RawItem = { rank: indent, name: m[2].trim(), metadata: {}, references: [] };
    // Allow "Name -- key: value" style inline metadata after a separator.
    const inline = item.name.match(/^(.*\S)\s+(?:--|·|\|)\s+(.+)$/);
    if (inline) {
      const kv = parseKeyValue(inline[2]);
      if (kv) {
        item.name = inline[1].trim();
        attach(item, kv.key, kv.value);
      }
    }
    items.push(item);
  }
  return items;
}

function parseNumbered(lines: string[]): RawItem[] {
  const items: RawItem[] = [];
  for (const line of lines) {
    const m = line.match(/^\s*(\d+(?:\.\d+)*)\.?\s+(.*\S)\s*$/);
    if (!m) continue;
    const rank = m[1].split(".").length;
    items.push({ rank, name: m[2].trim(), metadata: {}, references: [] });
  }
  return items;
}

/** Convert absolute ranks into contiguous 0-based depths via a stack. */
function ranksToDepths(raw: RawItem[]): OutlineItem[] {
  const stack: number[] = [];
  return raw.map((it) => {
    while (stack.length && it.rank <= stack[stack.length - 1]) stack.pop();
    const depth = stack.length;
    stack.push(it.rank);
    return { depth, name: it.name, metadata: it.metadata, references: it.references };
  });
}

export function parseOutline(text: string, format: DetectedFormat): OutlineItem[] {
  const lines = text.split(/\r?\n/);
  let raw: RawItem[];
  if (format === "numbered_outline") raw = parseNumbered(lines);
  else if (format === "indented_list") raw = parseBullets(lines);
  else raw = parseHeadings(lines);
  return ranksToDepths(raw);
}
