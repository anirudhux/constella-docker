// Hero illustration: a structured outline becoming an interactive hierarchy
// graph. Inlined (not <img>) so it can follow the app's manual theme toggle:
// colors are scoped CSS vars on the svg, with the dark set keyed off the same
// [data-theme="dark"] attribute the app sets on <html>.
const SVG = `<svg class="constella-hero" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 230" role="img" aria-label="A structured outline becomes an interactive hierarchy graph.">
  <defs>
    <style>
      .constella-hero{ --root:#c2510d; --branch:#e07c20; --leaf:#2e8b82; --link:#d3bda3; --surface:#fafafa; }
      :root[data-theme="dark"] .constella-hero{ --root:#ef8a3f; --branch:#f0a25e; --leaf:#48b3a8; --link:#5e5343; --surface:#0a0a0b; }
    </style>
    <marker id="constella-hero-arrow" viewBox="0 0 12 12" refX="9" refY="6" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M2,2 L10,6 L2,10 Z" fill="var(--branch)" stroke="var(--branch)" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>
    </marker>
  </defs>

  <!-- LEFT: outline tree (one parent -> three children) -->
  <g>
    <rect x="38" y="55" width="196" height="14" rx="7" fill="var(--branch)" fill-opacity="0.16"/>
    <circle cx="48" cy="62" r="3" fill="var(--root)"/>
    <g stroke="var(--branch)" stroke-width="1.8" stroke-opacity="0.5" stroke-linecap="round" fill="none">
      <path d="M46 72 V 156"/>
      <path d="M46 92 H 62"/>
      <path d="M46 124 H 62"/>
      <path d="M46 156 H 62"/>
    </g>
    <rect x="64" y="85"  width="178" height="14" rx="7" fill="var(--branch)" fill-opacity="0.16"/>
    <circle cx="74" cy="92" r="3" fill="var(--root)"/>
    <rect x="64" y="117" width="158" height="14" rx="7" fill="var(--branch)" fill-opacity="0.16"/>
    <circle cx="74" cy="124" r="3" fill="var(--root)"/>
    <rect x="64" y="149" width="184" height="14" rx="7" fill="var(--branch)" fill-opacity="0.16"/>
    <circle cx="74" cy="156" r="3" fill="var(--root)"/>
  </g>

  <!-- TRANSFORM arrow, centered in the gap, rounded head -->
  <path d="M318 115 L382 115" fill="none" stroke="var(--branch)" stroke-width="3.4" stroke-linecap="round" marker-end="url(#constella-hero-arrow)"/>

  <!-- RIGHT: hierarchy graph -->
  <g stroke="var(--link)" stroke-width="2.4" fill="none" stroke-linecap="round">
    <line x1="470" y1="115" x2="565" y2="80"/>
    <line x1="470" y1="115" x2="584" y2="115"/>
    <line x1="470" y1="115" x2="563" y2="156"/>
    <line x1="565" y1="80"  x2="665" y2="62"/>
    <line x1="565" y1="80"  x2="680" y2="96"/>
    <line x1="584" y1="115" x2="686" y2="116"/>
    <line x1="563" y1="156" x2="650" y2="150"/>
    <line x1="563" y1="156" x2="678" y2="172"/>
  </g>
  <g stroke="var(--surface)" stroke-width="1.4">
    <circle cx="665" cy="62"  r="6" fill="var(--leaf)"/>
    <circle cx="680" cy="96"  r="6" fill="var(--leaf)"/>
    <circle cx="686" cy="116" r="6" fill="var(--leaf)"/>
    <circle cx="650" cy="150" r="6" fill="var(--leaf)"/>
    <circle cx="678" cy="172" r="6" fill="var(--leaf)"/>
  </g>
  <g>
    <circle cx="565" cy="80"  r="11" fill="var(--branch)"/>
    <circle cx="584" cy="115" r="11" fill="var(--branch)"/>
    <circle cx="563" cy="156" r="11" fill="var(--branch)"/>
    <circle cx="470" cy="115" r="16" fill="var(--root)"/>
  </g>
</svg>`;

export function HeroIllustration() {
  return <div className="hero-illu" dangerouslySetInnerHTML={{ __html: SVG }} />;
}
