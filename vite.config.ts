import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // JS transpile floor, paired with the CSS dial in .browserslistrc.
    // Widening browser support = edit both, rebuild.
    target: ["es2020", "chrome87", "edge88", "firefox78"],
    rollupOptions: {
      output: {
        // Split heavy third-party libs into dedicated, cacheable vendor chunks
        // so they aren't inlined into the (lazy) graph page bundle. `three`
        // and `d3` together were ~half of the Output chunk; isolating them
        // keeps the app shell small and lets the browser cache the vendors
        // independent of app code changes. `xlsx` is already dynamically
        // imported, but pinning it here keeps its chunk name stable.
        manualChunks: {
          three: ["three"],
          d3: ["d3"],
          xlsx: ["xlsx"],
        },
      },
    },
  },
  server: {
    // Dedicated, fixed port for this project. strictPort makes Vite fail loudly
    // if it's taken, instead of silently wandering to another port.
    port: 5199,
    strictPort: true,
    // Worktree checkouts symlink node_modules to the main checkout; without
    // widening fs.allow past the worktree root, Vite 403s the @fontsource
    // font files resolved through that symlink (fonts silently fall back).
    fs: { allow: [".."] },
  },
});
