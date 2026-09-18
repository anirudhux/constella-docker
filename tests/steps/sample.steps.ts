import { Given, When, Then } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import type { ConstellaWorld } from "../support/world";

async function loadSample(world: ConstellaWorld): Promise<void> {
  await world.open("/");
  await world.page
    .getByRole("button", { name: "Try sample input" })
    .click();
  await world.page.locator(".viewtoggle").waitFor();
}

When("I click {string}", async function (this: ConstellaWorld, label: string) {
  await this.page.getByRole("button", { name: label }).click();
});

Given('the "Atlas Knowledge Base" sample is loaded', async function (this: ConstellaWorld) {
  await loadSample(this);
});

Given("the sample graph is open", async function (this: ConstellaWorld) {
  await loadSample(this);
});

Then(
  "the workspace opens with the title {string}",
  async function (this: ConstellaWorld, title: string) {
    // Graph has rendered when the view toggle appears
    await this.page.locator(".viewtoggle").waitFor();
    // Open the Document details report dialog to check the title
    await this.page.getByRole("button", { name: "Details" }).click();
    await this.page.locator(".sheet--report").waitFor();
    // Title is now in the report dialog
    const el = this.page.locator(".sheet--report .gtitle");
    await el.waitFor();
    assert.equal(((await el.textContent()) ?? "").trim(), title);
  },
);

Then(
  "a {string} badge is shown next to the title",
  async function (this: ConstellaWorld, badge: string) {
    // Badge is in the Document details report dialog (opened by previous step)
    const tag = this.page.locator(".sheet--report .gtag");
    await tag.waitFor();
    assert.equal(((await tag.textContent()) ?? "").trim(), badge);
  },
);

Then(
  "the header reports {string}, {string}, and {string}",
  async function (this: ConstellaWorld, a: string, b: string, c: string) {
    // Counts are now in the Document details report (opened by earlier step)
    const stats = this.page.locator(".sheet--report .stats");
    await stats.waitFor();
    const txt = ((await stats.textContent()) ?? "").replace(/\s+/g, " ").trim().toLowerCase();
    for (const phrase of [a, b, c]) {
      for (const token of phrase.split(" ")) {
        assert.ok(
          txt.includes(token.toLowerCase()),
          `stats text ${JSON.stringify(txt)} should include ${JSON.stringify(token)}`,
        );
      }
    }
  },
);

Then("the graph view is rendered by default", async function (this: ConstellaWorld) {
  await this.page.locator("canvas").first().waitFor({ state: "attached" });
});

// Reads the three counts from the report stats: [nodes, hierarchy, references].
async function headerCounts(world: ConstellaWorld): Promise<number[]> {
  // Open the report dialog if not already open to access the stats
  const reportOpen = (await world.page.locator(".sheet--report").count()) > 0;
  if (!reportOpen) {
    await world.page.getByRole("button", { name: "Details" }).click();
    await world.page.locator(".sheet--report").waitFor();
  }
  // Read [nodes, hierarchy, references] from the report stats
  const nodes = await statValueByLabel(world, "Nodes");
  const hierarchy = await statValueByLabel(world, "Hierarchy links");
  const references = await statValueByLabel(world, "Reference links");
  return [nodes, hierarchy, references];
}

// Helper to read a stat value by label from the report
async function statValueByLabel(world: ConstellaWorld, label: string): Promise<number> {
  const stat = world.page.locator(".stats .stat", { hasText: label }).first();
  await stat.waitFor();
  return Number(((await stat.locator(".stat__value").textContent()) ?? "").trim());
}

Then(
  "the hierarchy link count is exactly one less than the node count",
  async function (this: ConstellaWorld) {
    const [nodes, hierarchy] = await headerCounts(this);
    assert.equal(hierarchy, nodes - 1, `hierarchy ${hierarchy} should equal nodes ${nodes} - 1`);
  },
);

Then(
  "the reference link count is a non-negative number",
  async function (this: ConstellaWorld) {
    const [, , references] = await headerCounts(this);
    assert.ok(Number.isFinite(references) && references >= 0, `references=${references}`);
  },
);

// Generic: "I see header actions "A", "B", and "C"" / "I see view controls "A", ...".
// Extracts every quoted label and asserts each is a visible button/control.
async function assertControlsPresent(world: ConstellaWorld, raw: string): Promise<void> {
  const labels = raw.match(/"([^"]+)"/g)?.map((s) => s.replace(/"/g, "")) ?? [];
  for (const label of labels) {
    await world.page.getByRole("button", { name: label, exact: false }).first().waitFor();
  }
}

Then(/^I see header actions (.+)$/, async function (this: ConstellaWorld, raw: string) {
  await assertControlsPresent(this, raw);
});

Then(/^I see view controls (.+)$/, async function (this: ConstellaWorld, raw: string) {
  await assertControlsPresent(this, raw);
});

Then(
  "I see a back control to return to the landing page",
  async function (this: ConstellaWorld) {
    // The arrow was removed; the brand wordmark is the home / start-over control.
    await this.page.locator('button[aria-label^="Constella"]').first().waitFor();
  },
);
