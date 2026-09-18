import { When, Then } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import type { ConstellaWorld } from "../support/world";

const partialButton = (world: ConstellaWorld) =>
  world.page.locator(".step--unmappable .actions button", { hasText: /fits/i });

// Shared destination assertions for the no-review-gate import flow: an upload
// either renders the graph, or lands on the "we can't map this" screen when
// we're below the 80% confidence cut-off (or there's no hierarchy).
// ("I upload the {string} fixture" is defined in upload-detection.)

Then(
  "the graph workspace opens",
  async function (this: ConstellaWorld) {
    await this.page.locator(".viewtoggle").waitFor({ timeout: 15_000 });
  },
);

Then(
  "I see the can't-map message",
  async function (this: ConstellaWorld) {
    await this.page.locator(".step--unmappable").waitFor({ timeout: 15_000 });
  },
);

Then(
  "it is not shown as an error",
  async function (this: ConstellaWorld) {
    // The screen must not carry an error/alert — the user did nothing wrong.
    const alerts = await this.page
      .locator('.step--unmappable [role="alert"], .step--unmappable .error')
      .count();
    assert.equal(alerts, 0, "the can't-map screen must not read as an error");
  },
);

Then(
  "the partial-render option is offered",
  async function (this: ConstellaWorld) {
    await this.page.locator(".step--unmappable").waitFor();
    assert.equal(
      await partialButton(this).count(),
      1,
      "expected a 'render what fits' button",
    );
  },
);

Then(
  "no partial-render option is offered",
  async function (this: ConstellaWorld) {
    await this.page.locator(".step--unmappable").waitFor();
    assert.equal(
      await partialButton(this).count(),
      0,
      "expected no partial-render button below the floor",
    );
  },
);

When(
  "I render the compatible part",
  async function (this: ConstellaWorld) {
    await partialButton(this).click();
  },
);

Then(
  "a note says part of the file was left out",
  async function (this: ConstellaWorld) {
    await this.page.locator(".partial-banner").waitFor({ timeout: 15_000 });
  },
);
