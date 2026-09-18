// Addressable static pages: /changelog and /use-cases (plus the legacy
// #use-cases upgrade). Served by a Vercel SPA rewrite in production and
// Vite's index.html fallback in dev.
import { Given, Then } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { CHANGELOG } from "../../src/app/changelog";
import type { ConstellaWorld } from "../support/world";

Given("I open the {string} page", async function (this: ConstellaWorld, path: string) {
  await this.open(path);
});

Then("I see the page heading {string}", async function (this: ConstellaWorld, text: string) {
  await this.page
    .getByRole("heading", { name: text })
    .first()
    .waitFor({ timeout: 10_000 });
});

Then("the full changelog list is shown", async function (this: ConstellaWorld) {
  const rows = await this.page.locator(".cl-item").count();
  assert.equal(
    rows,
    CHANGELOG.length,
    `expected all ${CHANGELOG.length} changelog entries, found ${rows}`,
  );
});

Then("the address becomes {string}", async function (this: ConstellaWorld, path: string) {
  await this.page.waitForFunction(
    (p) => window.location.pathname === p && !window.location.hash,
    path,
    { timeout: 5_000 },
  );
});
