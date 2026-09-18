# Constella — offline Docker build

Constella turns a structured file — a spreadsheet, a Markdown outline, or a
JSON manifest — into an interactive hierarchy graph you can explore and export.

This build runs entirely on your own machine, inside a Docker container. Nothing
you open is uploaded anywhere, and once the image is built the app needs no
internet at all — so it's fine to run on a locked-down or air-gapped network.

New to Docker? No problem — this guide assumes you've never used it. Start to
finish is about five minutes.

## What you need

**Docker Desktop**, installed and running.
[Download it here](https://www.docker.com/products/docker-desktop/) for Mac,
Windows, or Linux, then open it once and wait until it reports that it's running.

**A copy of this project.** With git:

```
git clone https://github.com/anirudhux/constella-docker.git
cd constella-docker
```

No git? On the GitHub page, use the green **Code → Download ZIP** button, unzip
it, and open a terminal in the unzipped folder.

## Build and run

From inside the `constella-docker` folder, run these two commands:

```
docker build -t constella .
docker run --rm -p 8080:80 constella
```

- **`docker build`** assembles the app into an image. The first run downloads
  what it needs and takes a couple of minutes; after that it's cached and quick.
- **`docker run`** starts the app and serves it at **http://localhost:8080**.

Open **http://localhost:8080** in your browser and you're in.

Press **Ctrl + C** in the terminal to stop it. To start it again later, just
rerun the `docker run` command — no rebuild needed unless the code changes.

## Using it

1. Click **Try sample input** for a ready-made 350-node example, or **Upload a
   structured file** to bring your own — CSV, Excel, Markdown, or JSON.
2. Confirm the structure Constella detected. Nothing is guessed on your behalf.
3. Explore the graph: switch between **Circle**, **Spiral**, and **Sunburst**
   layouts, adjust the labels, and click any node for its detail.
4. **Export** your result — a standalone interactive HTML file (opens in any
   browser, fully offline), a PNG image, or a JSON manifest you can re-import.

## Privacy

Everything happens in your browser. No account, no upload, no tracking, no
third-party scripts. Exported files carry their graph data inside them, so they
open anywhere without a server.

## Troubleshooting

- **`port is already allocated`** — something else is using port 8080. Pick
  another one, e.g. `docker run --rm -p 9090:80 constella`, then open
  http://localhost:9090.
- **The build can't download anything** — the build step needs internet to fetch
  dependencies. The finished app does not; only the one-time build does.

---

### Developing (optional)

Prefer to run the app with Node instead of Docker:

```
npm install
npm run dev     # dev server on http://localhost:5199
npm run build   # type-check and build the static site into dist/
```
