// Vertical URLs (/v/<slug>): a registered showcase JSON auto-loads and
// renders straight into the workspace; the address stays put so it can be
// copied back out of the URL bar. Canvas presence is asserted via the shared
// "graph view is rendered" step (sample.steps) — the old .gtitle strip lives
// inside the Details sheet now and is NOT part of the resting workspace.
import { Given, Then } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import type { ConstellaWorld } from "../support/world";

Given("I open the path {string}", async function (this: ConstellaWorld, path: string) {
  await this.open(path);
});

Then("the page title is {string}", async function (this: ConstellaWorld, title: string) {
  // The title flips in the same effect that resolves the showcase entry —
  // poll briefly rather than asserting a race.
  await this.page.waitForFunction(
    (t) => document.title === t,
    title,
    { timeout: 5000 },
  );
  assert.equal(await this.page.title(), title);
});

Then("the browser path stays {string}", async function (this: ConstellaWorld, path: string) {
  await this.page.locator("canvas").first().waitFor({ state: "attached" });
  assert.equal(new URL(this.page.url()).pathname, path);
});
