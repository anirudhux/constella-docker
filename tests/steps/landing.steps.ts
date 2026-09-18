import { Given, When, Then } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import type { ConstellaWorld } from "../support/world";

Given("I open the Constella home page", async function (this: ConstellaWorld) {
  await this.open("/");
});

Given("I am on the landing page", async function (this: ConstellaWorld) {
  await this.open("/");
});

Then("I see the headline {string}", async function (this: ConstellaWorld, _headline: string) {
  // The hero title splits the phrase across a <span class="flourish">, so we
  // match the accessible name rather than an exact text node.
  await this.page
    .getByRole("heading", { name: /interactive hierarchy graph/i })
    .first()
    .waitFor();
});

Then(
  "I see the subtext explaining I confirm the structure and nothing is inferred",
  async function (this: ConstellaWorld) {
    const sub = this.page.locator(".hero__sub");
    await sub.waitFor();
    const txt = ((await sub.textContent()) ?? "").replace(/\s+/g, " ").trim();
    assert.match(txt, /confirm/i);
    assert.match(txt, /nothing is inferred/i);
  },
);

Then("I see the Constella wordmark in the header", async function (this: ConstellaWorld) {
  await this.page
    .locator(".topbar .brand__name", { hasText: "Constella" })
    .first()
    .waitFor();
});

Then("I see a theme toggle in the top-right corner", async function (this: ConstellaWorld) {
  await this.page
    .locator('.topbar button[aria-label^="Switch to"]')
    .first()
    .waitFor();
});

Then(
  "I see an input type {string} described as {string}",
  async function (this: ConstellaWorld, title: string, desc: string) {
    const card = this.page.locator(".format", { hasText: title }).first();
    await card.waitFor();
    const sub = (await card.locator(".format__sub").textContent()) ?? "";
    assert.ok(
      sub.includes(desc),
      `format "${title}" sub ${JSON.stringify(sub)} should include ${JSON.stringify(desc)}`,
    );
  },
);

Then("I see a primary button {string}", async function (this: ConstellaWorld, label: string) {
  await this.page.getByRole("button", { name: label }).first().waitFor();
});

Then("I see a secondary link {string}", async function (this: ConstellaWorld, label: string) {
  await this.page.getByRole("button", { name: label }).first().waitFor();
});

When(
  "I scroll to the {string} section",
  async function (this: ConstellaWorld, _section: string) {
    await this.page.locator(".home-usecases").scrollIntoViewIfNeeded();
  },
);

// "I see use cases including X, Y, ... and Z" / "additional use cases such as ..."
// Both phrasings just assert each quoted card title is present in the strip.
async function assertUseCasesPresent(world: ConstellaWorld, raw: string): Promise<void> {
  const titles = raw.match(/"([^"]+)"/g)?.map((s) => s.replace(/"/g, "")) ?? [];
  for (const title of titles) {
    await world.page
      .locator(".home-usecases")
      .getByText(title, { exact: false })
      .first()
      .waitFor();
  }
}

Then(
  /^I see use cases including (.+)$/,
  async function (this: ConstellaWorld, raw: string) {
    await assertUseCasesPresent(this, raw);
  },
);

Then(
  /^I see additional use cases such as (.+)$/,
  async function (this: ConstellaWorld, raw: string) {
    await assertUseCasesPresent(this, raw);
  },
);

Then(
  "the footer shows the Constella wordmark with the tagline {string}",
  async function (this: ConstellaWorld, tagline: string) {
    await this.page.locator(".footer__name", { hasText: "Constella" }).first().waitFor();
    await this.page.locator(".footer__tag", { hasText: tagline }).first().waitFor();
  },
);

Then(
  "I see an {string} link pointing to {string}",
  async function (this: ConstellaWorld, label: string, urlFragment: string) {
    const link = this.page.locator(`.footer a[href*="${urlFragment}"]`).first();
    await link.waitFor();
    assert.ok(((await link.textContent()) ?? "").includes(label.replace(/^@/, "@")));
  },
);

Then(
  "I see a LinkedIn link pointing to {string}",
  async function (this: ConstellaWorld, urlFragment: string) {
    await this.page.locator(`.footer a[href*="${urlFragment}"]`).first().waitFor();
  },
);

Then("I see a {string} link", async function (this: ConstellaWorld, label: string) {
  await this.page.locator(".footer").getByText(label, { exact: true }).first().waitFor();
});
