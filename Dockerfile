# Constella — offline / on-prem image.
#
# A two-stage build: node:slim compiles the static SPA, nginx:alpine serves it.
# The build image is discarded, so its size does not matter and glibc avoids the
# native-dependency surprises musl (Alpine) sometimes brings. The serve image is
# tiny and makes no outside call, so it runs in a network that blocks the
# internet. Fonts and Three.js are bundled into the build already; nothing is
# fetched at runtime.
#
#   docker build -t constella .
#   docker run --rm -p 8080:80 constella   # then open http://localhost:8080

# --- build stage ---------------------------------------------------------
FROM node:20-slim AS build
WORKDIR /app

# Install against the committed lockfile first, so this layer caches unless the
# dependencies actually change.
COPY package.json package-lock.json ./
RUN npm ci

# Then the sources, and build. `npm run build` runs the standalone runtime
# build, tsc, vite build, and the shipped-output host guard.
COPY . .
RUN npm run build

# --- serve stage ---------------------------------------------------------
FROM nginx:1.27-alpine AS serve
COPY --from=build /app/dist /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
