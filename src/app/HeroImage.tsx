import { useEffect, useState } from "react";

const SRC = {
  dark: "/hero-dark.png",
  light: "/hero-light.png",
} as const;

function readTheme(): "dark" | "light" {
  if (typeof document === "undefined") return "light";
  return document.documentElement.getAttribute("data-theme") === "dark"
    ? "dark"
    : "light";
}

/* Static hero illustration, one image per theme. Rendered as a plain <img> so
   it composites through the normal sRGB path — a baked background matches the
   page exactly (no video-pipeline colour shift, so no seam). Watches
   <html data-theme> to swap the image when the theme toggles. */
export function HeroImage() {
  const [theme, setTheme] = useState<"dark" | "light">(readTheme);

  useEffect(() => {
    if (typeof MutationObserver === "undefined") return;
    const obs = new MutationObserver(() => setTheme(readTheme()));
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => obs.disconnect();
  }, []);

  return (
    <div className="hero-img" aria-hidden="true">
      <img className="hero-img__el" src={SRC[theme]} alt="" draggable={false} />
    </div>
  );
}
