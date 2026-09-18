// "All nodes" shape mode: chip toggles the label-free silhouette; a node click
// dissolves it back to the normal view (selecting that node).
import { Then, When } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import type { ConstellaWorld } from "../support/world";

/** Poll until the count of visible .hg-label elements matches `want`. */
async function waitVisibleLabels(
  world: ConstellaWorld,
  want: "none" | "some",
  timeoutMs = 5_000,
): Promise<number> {
  const start = Date.now();
  let count = -1;
  while (Date.now() - start < timeoutMs) {
    count = await world.page.locator(".hg-label:visible").count();
    if (want === "none" ? count === 0 : count > 0) return count;
    await new Promise((r) => setTimeout(r, 100));
  }
  return count;
}

Then("the {string} toggle is on", async function (this: ConstellaWorld, name: string) {
  const btn = this.page.getByRole("button", { name });
  await btn.waitFor();
  assert.equal(await btn.getAttribute("aria-pressed"), "true");
});

Then("the {string} toggle is off", async function (this: ConstellaWorld, name: string) {
  const btn = this.page.getByRole("button", { name });
  await btn.waitFor();
  assert.equal(await btn.getAttribute("aria-pressed"), "false");
});

Then("no graph labels are visible", async function (this: ConstellaWorld) {
  const n = await waitVisibleLabels(this, "none");
  assert.equal(n, 0, `expected zero visible labels, found ${n}`);
});

Then("graph labels are visible again", async function (this: ConstellaWorld) {
  const n = await waitVisibleLabels(this, "some");
  assert.ok(n > 0, "expected labels to return after shape mode dissolved");
});

// The root sits at the canvas centre in the default fitted view — clicking it
// is the deterministic "click a node" for the dissolve test.
When("I click the centre of the graph", async function (this: ConstellaWorld) {
  const canvas = this.page.locator(".hg-scene canvas");
  const box = (await canvas.boundingBox())!;
  await this.page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
});
