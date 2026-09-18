import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { writeFileSync, readFileSync, unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";
import { SITE_URL } from "./src/config/site";

// Dev-only write endpoint for the /bench curation page: PUT/DELETE
// /__bench/<slug> saves or removes public/showcase/<slug>.json so publishing
// a vertical URL is "drop the file on the bench, cbv". configureServer only —
// this middleware never exists in a build, and the slug charset is enforced
// server-side too so nothing traversal-shaped reaches the filesystem.
function benchWriter(): Plugin {
  return {
    name: "constella-bench-writer",
    apply: "serve",
    configureServer(server) {
      // PUT /__bench-ledger with a JSON array of slugs rewrites the SLOTS
      // line in src/config/showcase.ts — the bench's "Save bench" commits its
      // layout here so the page restores itself on the next visit.
      server.middlewares.use("/__bench-ledger", (req, res) => {
        if (req.method !== "PUT") {
          res.statusCode = 405;
          res.end();
          return;
        }
        const chunks: Buffer[] = [];
        req.on("data", (c) => chunks.push(c));
        req.on("end", () => {
          try {
            const slugs = JSON.parse(Buffer.concat(chunks).toString("utf8"));
            if (
              !Array.isArray(slugs) ||
              !slugs.every(
                (s) => typeof s === "string" && (s === "" || /^[a-z0-9][a-z0-9-]{0,63}$/.test(s)),
              )
            )
              throw new Error("bad ledger");
            const ledgerFile = join(__dirname, "src", "config", "showcase.ts");
            const src = readFileSync(ledgerFile, "utf8");
            const line = `export const SLOTS: string[] = ${JSON.stringify(
              slugs.filter(Boolean),
            )};`;
            const next = src.replace(/^export const SLOTS: string\[\] = \[.*\];$/m, line);
            if (next === src && !src.includes(line)) throw new Error("SLOTS line not found");
            writeFileSync(ledgerFile, next);
            res.statusCode = 200;
            res.end("ok");
          } catch {
            res.statusCode = 422;
            res.end("bad ledger");
          }
        });
      });
      server.middlewares.use("/__bench", (req, res) => {
        const slug = (req.url ?? "").replace(/^\//, "").split("?")[0];
        if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(slug)) {
          res.statusCode = 400;
          res.end("bad slug");
          return;
        }
        const file = join(__dirname, "public", "showcase", `${slug}.json`);
        if (req.method === "PUT") {
          const chunks: Buffer[] = [];
          req.on("data", (c) => chunks.push(c));
          req.on("end", () => {
            const body = Buffer.concat(chunks).toString("utf8");
            try {
              JSON.parse(body); // syntactic gate; the app validates structure
              writeFileSync(file, body);
              res.statusCode = 200;
              res.end("ok");
            } catch {
              res.statusCode = 422;
              res.end("not json");
            }
          });
          return;
        }
        if (req.method === "DELETE") {
          if (existsSync(file)) unlinkSync(file);
          res.statusCode = 200;
          res.end("ok");
          return;
        }
        res.statusCode = 405;
        res.end();
      });
    },
  };
}

// Replace %SITE_URL% tokens in index.html with the canonical origin from
// src/config/site.ts, so the canonical/OG tags share one source of truth with
// the rest of the app (export badge, middleware). Runs in dev and build.
function siteUrlHtml() {
  return {
    name: "constella-site-url",
    // `pre` so the token is gone before Vite's build-html step decodeURI-parses
    // href/content attributes (a raw `%S…` reads as a malformed percent-escape).
    transformIndexHtml: {
      order: "pre" as const,
      handler(html: string) {
        return html.replaceAll("%SITE_URL%", SITE_URL);
      },
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), siteUrlHtml(), benchWriter()],
  build: {
    // JS transpile floor, paired with the CSS dial in .browserslistrc.
    // Widening browser support = edit both, rebuild.
    target: ["es2020", "chrome87", "edge88", "firefox78", "safari14"],
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
