# Constella (offline / Docker build)

Constella turns a structured file (a spreadsheet, a Markdown outline, or a JSON
manifest) into an interactive hierarchy graph you can explore and export. It
runs entirely in the browser: the file is parsed and rendered on the device, and
nothing is uploaded.

This build is the self-contained, offline fork. It has no showcase, no changelog,
and no sharing backend; the shell is upload, render, and export. The running app
makes no outside network request, so it works on a network that blocks the
internet. It uses the same renderer as the main product, in a smaller shell.

## Run with Docker

```
docker build -t constella .
docker run --rm -p 8080:80 constella
```

Then open http://localhost:8080.

The image has two stages: `node:slim` compiles the static site, and
`nginx:alpine` serves it. The nginx config returns `index.html` for client-side
routes. Fonts and the WebGL library are bundled into the build, so the container
needs the internet only to install dependencies at build time, and none at all
at runtime.

## Develop

```
npm install
npm run dev        # Vite dev server on port 5199
npm run build      # type-check, build the static output into dist/
```

## What it does

- Import CSV, Excel, Markdown, or a JSON manifest and confirm the structure.
- Render the hierarchy as a circle graph, a spiral, or a sunburst.
- Export the result as a standalone interactive HTML file, a PNG, or a JSON
  manifest that re-imports.

## Layout

- `src/renderer/core` is the framework-free graph model, layout, and style. The
  in-app renderer and the export runtime both build on it.
- `src/renderer/hybridGraph.ts` is the WebGL renderer; `src/renderer/d3Sunburst.ts`
  is the sunburst.
- `src/core` parses and validates input into a graph document.
- `src/app` holds the upload, render, and export shell.
- `Dockerfile` and `docker/nginx.conf` build and serve the offline image.

## Privacy

Everything runs in the browser. No account, no upload, no tracking, and no
third-party scripts. Exports are generated locally, with the graph data baked
into the file.
