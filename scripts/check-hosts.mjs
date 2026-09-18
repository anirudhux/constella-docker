#!/usr/bin/env node
// Build guard: fail if a stale host reaches shipped output.
//
// Everything user-facing derives its domain from src/config/site.ts, but static
// assets and third-party strings can still smuggle an old host in. This walks
// the built `dist/` and rejects any `*.vercel.app` host or the retired
// `constella-viz` brand — so the canonical tags, OG image, and the "Made with
// Constella" export badge can never silently point at a dead URL again.
//
// Runs as the last step of `npm run build`. Scans built output only; the
// intentional legacy-host references in middleware.ts / vercel.json (which
// redirect those hosts away) live outside dist and are not shipped.

import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const DIST = "dist";
// Text assets worth scanning; skip images, fonts, sourcemaps.
const TEXT_EXT = /\.(html?|js|mjs|cjs|css|json|txt|xml|webmanifest|svg)$/i;
// Content datasets shipped under dist/ may legitimately reference third-party
// hosts (e.g. a speaker's demo hosted on vercel.app). The guard exists for
// Constella's OWN chrome — canonical tags, OG, the export badge — so dataset
// folders/files are excluded by name rather than the ban weakened.
const SKIP_DIRS = new Set(["design-demo-nights"]);
const SKIP_FILES = new Set(["ddn.json"]);
const BANNED = [
  { re: /\bconstella-viz\b/i, label: "retired 'constella-viz' brand" },
  { re: /[a-z0-9-]+\.vercel\.app/i, label: "*.vercel.app host" },
];

if (!existsSync(DIST)) {
  console.error(`check-hosts: '${DIST}/' not found — run the build first.`);
  process.exit(1);
}

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (TEXT_EXT.test(name) && !SKIP_FILES.has(name)) out.push(p);
  }
  return out;
}

const hits = [];
for (const file of walk(DIST)) {
  const text = readFileSync(file, "utf8");
  for (const { re, label } of BANNED) {
    const m = text.match(re);
    if (m) hits.push({ file, label, match: m[0] });
  }
}

if (hits.length) {
  console.error("check-hosts: stale host(s) found in shipped output:\n");
  for (const h of hits) {
    console.error(`  ${h.file}\n    → ${h.match}  (${h.label})`);
  }
  console.error("\nFix the source and update src/config/site.ts if the domain changed.");
  process.exit(1);
}

console.log("check-hosts: dist/ clean — no stale hosts.");
