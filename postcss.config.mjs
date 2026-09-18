import postcssPresetEnv from "postcss-preset-env";

// Vite picks this up automatically for every CSS file (dev + build).
// preset-env autoprefixes and back-compiles modern CSS (notably the oklch()
// design tokens → rgb fallbacks) per the .browserslistrc support dial.
export default {
  plugins: [
    postcssPresetEnv({
      // Keep the modern value as the second declaration so capable browsers
      // still use oklch; older ones fall back to the generated rgb.
      preserve: true,
    }),
  ],
};
