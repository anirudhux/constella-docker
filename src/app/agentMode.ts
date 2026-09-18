/* Human vs. agent session detection.

   Some flows exist purely to protect a *human's* journey — e.g. the
   `beforeunload` "Reload site?" prompt that guards an on-screen graph. When an
   automated agent is driving (Playwright/webdriver, or an explicit `?agent=1`
   on the URL), those prompts protect nothing and only block scripted runs, so
   they're suppressed. Human sessions are never affected.

   This is deliberately the single seam for the broader human-vs-agent gate:
   future flows that should differ for agents can branch on isAgentSession()
   rather than scattering ad-hoc checks. */
export function isAgentSession(): boolean {
  if (typeof navigator !== "undefined" && navigator.webdriver) return true;
  return hasAgentFlag();
}

/* The explicit `?agent=1` flag alone — an agent pipeline signalling intent,
   distinct from incidental automation (webdriver). Flows that change data
   handling (skipping disambiguation, rendering straight through) key on THIS,
   not on webdriver, so ordinary automated sessions — the test suite included —
   still walk the human path. Suppressing a nag is safe for any automation;
   changing the flow is not. */
export function hasAgentFlag(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return new URLSearchParams(window.location.search).has("agent");
  } catch {
    return false;
  }
}
