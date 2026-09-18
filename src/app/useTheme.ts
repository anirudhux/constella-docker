import { useCallback, useState } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "constella:theme";

// An explicit user choice for this session, if any. Absent means the app
// default (dark) — the OS colour-scheme preference is deliberately ignored.
function savedChoice(): Theme | null {
  try {
    const v = sessionStorage.getItem(STORAGE_KEY);
    return v === "dark" || v === "light" ? v : null;
  } catch {
    return null;
  }
}

// Apply to the DOM (the `data-theme` token + the matching favicon). This does
// NOT persist — persistence happens only on an explicit toggle, so the device
// preference stays the live default until the user actually chooses.
function applyDom(theme: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
  const fav = document.getElementById("favicon");
  if (fav) fav.setAttribute("href", `/favicon-${theme}.svg`);
}

/**
 * Dark by default. The only way the theme changes is an explicit user toggle,
 * which is stored for the session — the OS/system preference plays no part.
 */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    const initial = savedChoice() ?? "dark";
    applyDom(initial);
    return initial;
  });

  const toggle = useCallback(() => {
    setThemeState((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      applyDom(next);
      try {
        sessionStorage.setItem(STORAGE_KEY, next); // explicit choice — persist
      } catch {
        /* private mode / quota — non-fatal */
      }
      return next;
    });
  }, []);

  return { theme, toggle };
}
