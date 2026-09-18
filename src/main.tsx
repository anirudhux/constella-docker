import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// Bundled fonts (no runtime CDN) — Hanken Grotesk for display, Geist for UI.
import "@fontsource/hanken-grotesk/400.css";
import "@fontsource/hanken-grotesk/600.css";
import "@fontsource/geist-sans/400.css";
import "@fontsource/geist-sans/500.css";
import "@fontsource/geist-sans/600.css";

import "./styles/tokens.css";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
