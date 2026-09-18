import { useEffect, useState } from "react";

/* Tiny path router — the app's only routing. /changelog and /use-cases are
   real, shareable addresses: Vercel rewrites them to the SPA shell (see
   vercel.json) and Vite's dev server falls back to index.html by default.
   Deliberately no router library for two static pages — pushState in,
   popstate out. Add new paths to AppPath, the vercel.json rewrites, and
   public/sitemap.xml together.
   /v/<slug> vertical URLs are handled separately (config/showcase.ts): they
   have their own vercel rewrite, are deliberately NOT in the sitemap (shared
   links, not indexed pages), and never appear in navigateTo. */
export type AppPath = "/" | "/use-cases" | "/changelog";

export function navigateTo(path: AppPath) {
  if (window.location.pathname !== path) {
    window.history.pushState(null, "", path);
  }
  window.scrollTo(0, 0);
  // One event drives every usePath() subscriber — real popstates included.
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function usePath(): string {
  const [path, setPath] = useState(() =>
    typeof window !== "undefined" ? window.location.pathname : "/",
  );
  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  return path;
}
