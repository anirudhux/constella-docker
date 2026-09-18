import type { GraphTheme } from "../renderer/hybridGraph";

// Resolve any CSS colour to a hex string the Three.js colour parser accepts —
// Three's setStyle understands hex/rgb, not oklch(), and current Chrome keeps
// oklch() even in computed `color`, so we convert deterministically ourselves.
function oklchToHex(L: number, C: number, hDeg: number): string {
  const h = (hDeg * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  const lin = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  const g = (x: number) =>
    x >= 0.0031308 ? 1.055 * Math.pow(x, 1 / 2.4) - 0.055 : 12.92 * x;
  const to = (x: number) =>
    Math.round(Math.max(0, Math.min(1, g(x))) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${to(lin[0])}${to(lin[1])}${to(lin[2])}`;
}
function resolveColor(value: string): string {
  const v = value.trim();
  const m = v.match(/^oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+)/i);
  if (!m) return v; // hex / rgb() pass straight through
  const L = m[1].endsWith("%") ? parseFloat(m[1]) / 100 : parseFloat(m[1]);
  return oklchToHex(L, parseFloat(m[2]), parseFloat(m[3]));
}

function cssVar(name: string): string {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return raw ? resolveColor(raw) : "";
}

export function readGraphTheme(): GraphTheme {
  return {
    bg: cssVar("--bg") || "#fafafa",
    surface: cssVar("--surface") || "#ffffff",
    text: cssVar("--heading") || "#18181b",
    muted: cssVar("--text-subtle") || "#71717a",
    border: cssVar("--border") || "#e4e4e7",
    link: cssVar("--border-muted") || "#d4d4d8",
    accent: cssVar("--accent") || "#f97316",
    // Reference links read as a cool secondary hue, not warm — so they don't
    // compete with the (warm) accent-anchored root and read as "cross-links".
    referenceLink: cssVar("--kg-reference") || "#8b84c7",
  };
}

/**
 * Default node palette — one shared categorical set for every view (graph,
 * sunburst, tree) so a group reads the same colour everywhere. Designed in
 * OKLCH: near-constant lightness (~0.7) and chroma (~0.15) with hues spread
 * around the wheel, so no hue dominates or muddies (the old olive/gold did).
 * The root keeps the brand accent; groups take these in encounter order.
 * Stored as hex so Three.js, D3 and CSS all consume them identically.
 */
export const DEFAULT_NODE_PALETTE = [
  "#4fa3f4", // blue     oklch(0.70 0.145 250)
  "#ee8b3e", // orange   oklch(0.73 0.150 55)
  "#e85854", // red      oklch(0.65 0.180 25)
  "#36baba", // teal     oklch(0.72 0.110 195)
  "#63c776", // green    oklch(0.75 0.150 148)
  "#a17adf", // violet   oklch(0.66 0.150 300)
  "#e1bd53", // gold     oklch(0.81 0.130 90)
  "#dc68b5", // magenta  oklch(0.68 0.170 342)
];

/* --- small color helpers for a restrained, accent-anchored palette --- */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let h = hex.trim().replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  if (Number.isNaN(n)) return { r: 249, g: 115, b: 22 };
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function rgbToHex(r: number, g: number, b: number): string {
  const c = (x: number) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}
function rgbToHsl(r: number, g: number, b: number) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4;
    }
    h /= 6;
  }
  return { h, s, l };
}
function hslToRgb(h: number, s: number, l: number) {
  if (s === 0) return { r: l * 255, g: l * 255, b: l * 255 };
  const hue = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return { r: hue(p, q, h + 1 / 3) * 255, g: hue(p, q, h) * 255, b: hue(p, q, h - 1 / 3) * 255 };
}

/**
 * A restrained palette anchored on the accent hue (no generic rainbow):
 * limited hue spread + gentle lightness variation (design guide §1).
 */
export function derivePalette(accent: string, count = 6): string[] {
  const { r, g, b } = hexToRgb(accent);
  const base = rgbToHsl(r, g, b);
  const offsets = [0, 0.083, -0.083, 0.17, -0.17, 0.5, 0.25, -0.25];
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const off = offsets[i % offsets.length];
    const h = (base.h + off + 1) % 1;
    const s = Math.max(0.34, Math.min(0.74, base.s * 0.82 + 0.12));
    const l = Math.max(0.42, Math.min(0.7, base.l + (i % 2 ? 0.06 : -0.04)));
    const c = hslToRgb(h, s, l);
    out.push(rgbToHex(c.r, c.g, c.b));
  }
  return out;
}
