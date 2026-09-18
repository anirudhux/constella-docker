// Shared upload/Review Givens used across the Wave-2 review features.
// Feature-specific steps live in their own *.steps.ts files.
import { Given, Then } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import type { ConstellaWorld } from "../support/world";
import { uploadFixture } from "../support/review-helpers";

Given("I have uploaded a hierarchy CSV", async function (this: ConstellaWorld) {
  await uploadFixture(this);
});

// "...with columns 'Level 1', 'Level 2', ..." — column set is fixed by the fixture.
Given(
  /^I have uploaded a CSV with columns .+$/,
  async function (this: ConstellaWorld) {
    await uploadFixture(this);
  },
);

Given(
  "I have uploaded a CSV that produces 3 top-level nodes",
  async function (this: ConstellaWorld) {
    await uploadFixture(this);
  },
);

Given(
  "I am on the {string} screen",
  async function (this: ConstellaWorld, screen: string) {
    await uploadFixture(this);
    assert.ok(
      (await this.page.locator(".panel__title", { hasText: screen }).count()) >
        0,
      `expected to be on the "${screen}" screen`,
    );
  },
);

Given(
  "I am on the {string} screen for an uploaded CSV",
  async function (this: ConstellaWorld, _screen: string) {
    await uploadFixture(this);
  },
);

Then(
  "the {string} screen is shown",
  async function (this: ConstellaWorld, screen: string) {
    await this.page
      .locator(".panel__title", { hasText: screen })
      .waitFor({ timeout: 10_000 });
  },
);
