// Flat chart nav (Circle ◯ / Spiral ✦ / Sunburst) — one labelled row, no
// Graph parent. Infinity is parked off the nav (see Output.tsx).
// Active-state assertions reuse the shared aria-pressed toggle steps.
import { Then } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import type { ConstellaWorld } from "../support/world";

Then("the chart nav buttons are visible", async function (this: ConstellaWorld) {
  for (const name of ["Circle", "Spiral", "Sunburst"]) {
    const btn = this.page.getByRole("button", { name, exact: true });
    await btn.waitFor();
    assert.ok(await btn.isVisible(), `expected "${name}" button to be visible`);
  }
});
