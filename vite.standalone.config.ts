import { defineConfig } from "vite";

// Builds the export runtime (standalone-entry.ts + renderer/core/*) into a
// single self-executing script that export/html.ts inlines into every
// downloaded/embedded graph. Three.js stays EXTERNAL — the export HTML
// provides the global THREE (inlined for downloads, CDN for the iframe embed).
//
// Run via `npm run build:runtime`; the full `npm run build` runs it first so
// the inlined runtime can never go stale. The emitted file is committed so the
// dev server (which only runs `vite`) can resolve the ?raw import.
export default defineConfig({
  // No public assets in this build — it emits only the runtime script.
  // (Default publicDir copying would dump all of public/ into outDir.)
  publicDir: false,
  build: {
    lib: {
      entry: "src/renderer/standalone-entry.ts",
      name: "ConstellaStandalone",
      formats: ["iife"],
      fileName: () => "standalone-runtime.js",
    },
    rollupOptions: {
      external: ["three"],
      output: { globals: { three: "THREE" } },
    },
    outDir: "src/generated",
    emptyOutDir: true,
    // Wider JS floor than the app: exports run on strangers' machines.
    target: ["es2017"],
    minify: true,
  },
});
