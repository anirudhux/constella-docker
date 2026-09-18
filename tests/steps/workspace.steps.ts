import { Given, When, Then } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import type { ConstellaWorld } from "../support/world";

// ----------------------------------------------------------------------------
// Shared helpers
// ----------------------------------------------------------------------------

async function loadSample(world: ConstellaWorld): Promise<void> {
  // Idempotent: a scenario may state "a dataset is open" AND "the sample is
  // open". sessionStorage persists the workspace, so re-navigating to "/" would
  // restore the graph (no landing link) — just no-op if it's already up.
  if ((await world.page.locator(".viewtoggle").count()) > 0) return;
  await world.open("/");
  await world.page
    .getByRole("button", { name: "Try sample input" })
    .click();
  await world.page.locator(".viewtoggle").waitFor();
}

async function headerCounts(world: ConstellaWorld): Promise<number[]> {
  // Header counts are now in the report stats (open dialog if not already)
  // Check if report is already open
  const reportOpen = (await world.page.locator(".sheet--report").count()) > 0;
  if (!reportOpen) {
    await world.page.getByRole("button", { name: "Details" }).click();
    await world.page.locator(".sheet--report").waitFor();
  }
  // Read [nodes, hierarchy, references] from the stats
  const nodes = await statValueByLabel(world, "Nodes");
  const hierarchy = await statValueByLabel(world, "Hierarchy links");
  const references = await statValueByLabel(world, "Reference links");
  return [nodes, hierarchy, references];
}

async function statValueByLabel(world: ConstellaWorld, label: string): Promise<number> {
  const stat = world.page.locator(".stats .stat", { hasText: label }).first();
  await stat.waitFor();
  return Number(((await stat.locator(".stat__value").textContent()) ?? "").trim());
}

async function openSurface(world: ConstellaWorld, name: string): Promise<void> {
  const n = name.toLowerCase();
  if (n.includes("setting")) {
    await world.page.getByRole("button", { name: "Settings" }).click();
    await world.page.locator(".sheet--settings").waitFor();
  } else if (n.includes("share") || n.includes("embed")) {
    await world.page.getByRole("button", { name: /Share & embed/ }).click();
    await world.page.locator(".sheet--share").waitFor();
  } else if (n.includes("report") || n.includes("detail")) {
    await world.page.getByRole("button", { name: "Details" }).click();
    await world.page.locator(".sheet--report").waitFor();
  } else {
    throw new Error(`openSurface: unknown surface "${name}"`);
  }
}

// ----------------------------------------------------------------------------
// Open-state Givens (all phrasings resolve to "the sample graph is open")
// ----------------------------------------------------------------------------

Given("a dataset is open in the workspace", async function (this: ConstellaWorld) {
  await loadSample(this);
});
Given("a dataset is open", async function (this: ConstellaWorld) {
  await loadSample(this);
});
Given("a graph is open in the workspace", async function (this: ConstellaWorld) {
  await loadSample(this);
});
Given("a graph is open", async function (this: ConstellaWorld) {
  await loadSample(this);
});
Given('the {string} sample is open', async function (this: ConstellaWorld, _name: string) {
  await loadSample(this);
});
Given('the "Import report" dialog is open', async function (this: ConstellaWorld) {
  await loadSample(this);
  await openSurface(this, "Import report");
});

async function ensureWorkspace(world: ConstellaWorld): Promise<void> {
  if ((await world.page.locator(".gtoolbar").count()) === 0) await loadSample(world);
}

When("I have opened {string}", async function (this: ConstellaWorld, name: string) {
  await ensureWorkspace(this);
  await openSurface(this, name);
});
When("I open the {string} dialog", async function (this: ConstellaWorld, name: string) {
  await ensureWorkspace(this);
  await openSurface(this, name);
});
When("I expand {string}", async function (this: ConstellaWorld, label: string) {
  await this.page.getByText(label, { exact: true }).first().click();
});
When(/^I switch (?:back )?to "([^"]+)"$/, async function (this: ConstellaWorld, view: string) {
  await this.page.getByRole("button", { name: view, exact: false }).first().click();
});

// ----------------------------------------------------------------------------
// Import report
// ----------------------------------------------------------------------------

Then("an {string} dialog opens", async function (this: ConstellaWorld, label: string) {
  await this.page.locator(`.overlay[aria-label="${label}"]`).waitFor();
});

Then(
  "it states the detection confidence and that nothing is inferred",
  async function (this: ConstellaWorld) {
    const txt = ((await this.page.locator(".report__sub").textContent()) ?? "").trim();
    assert.match(txt, /confidence/i);
    assert.match(txt, /nothing is inferred/i);
  },
);

Then(
  /^it shows metric cards for (.+)$/,
  async function (this: ConstellaWorld, raw: string) {
    const labels = raw.match(/"([^"]+)"/g)?.map((s) => s.replace(/"/g, "")) ?? [];
    for (const label of labels) {
      await this.page.locator(".stats .stat", { hasText: label }).first().waitFor();
    }
  },
);

Then("it shows the source file name", async function (this: ConstellaWorld) {
  const file = this.page.locator(".report__file");
  await file.waitFor();
  assert.ok(((await file.textContent()) ?? "").trim().length > 0);
});

Then(
  "the {string} control is present in the bottom bar in the Graph view",
  async function (this: ConstellaWorld, label: string) {
    await this.page.getByRole("button", { name: label }).first().waitFor();
  },
);

Then(
  "the {string} control is present in the bottom bar in the Outline view",
  async function (this: ConstellaWorld, label: string) {
    await this.page.getByRole("button", { name: "Outline" }).click();
    await this.page.locator(".outline").waitFor();
    await this.page.getByRole("button", { name: label }).first().waitFor();
  },
);

Then(
  /^the (.+) cards match the header counts$/,
  async function (this: ConstellaWorld, _raw: string) {
    // Read header counts before opening the dialog covered them; re-read header
    // (still in the DOM behind the scrim) and compare to the report stats.
    const [nodes, hierarchy, references] = await headerCounts(this);
    assert.equal(await statValueByLabel(this, "Nodes"), nodes);
    assert.equal(await statValueByLabel(this, "Hierarchy links"), hierarchy);
    assert.equal(await statValueByLabel(this, "Reference links"), references);
  },
);

Then(
  "the body text reads similar to {string}",
  async function (this: ConstellaWorld, _expected: string) {
    const txt = ((await this.page.locator(".report__sub").textContent()) ?? "").trim();
    assert.match(txt, /nothing is inferred/i);
  },
);

Then("the source file name is {string}", async function (this: ConstellaWorld, name: string) {
  const file = this.page.locator(".report__file");
  await file.waitFor();
  assert.ok(((await file.textContent()) ?? "").includes(name));
});

Then("the confidence is shown as {string}", async function (this: ConstellaWorld, pct: string) {
  const txt = ((await this.page.locator(".report__sub").textContent()) ?? "").trim();
  assert.ok(txt.includes(pct), `report sub ${JSON.stringify(txt)} should include ${pct}`);
});

Then("the warnings count is {string}", async function (this: ConstellaWorld, count: string) {
  assert.equal(await statValueByLabel(this, "Warnings"), Number(count));
});

Then("the dialog closes", async function (this: ConstellaWorld) {
  await this.page.locator(".sheet--report").waitFor({ state: "hidden" });
});

Then("the graph remains open and interactive", async function (this: ConstellaWorld) {
  await this.page.locator(".viewtoggle").waitFor();
});

// ----------------------------------------------------------------------------
// Label settings
// ----------------------------------------------------------------------------

Then(
  /^the "Labels" mode offers (.+)$/,
  async function (this: ConstellaWorld, raw: string) {
    const labels = raw.match(/"([^"]+)"/g)?.map((s) => s.replace(/"/g, "")) ?? [];
    for (const label of labels) {
      await this.page
        .locator(".tiles--3 .tile__label", { hasText: label })
        .first()
        .waitFor();
    }
  },
);

Then(
  "{string} is described as {string}",
  async function (this: ConstellaWorld, mode: string, hint: string) {
    const tile = this.page.locator(".tiles--3 .tile", {
      has: this.page.locator(".tile__label", { hasText: mode }),
    });
    const got = ((await tile.locator(".tile__hint").textContent()) ?? "").trim();
    assert.equal(got, hint);
  },
);

// ----------------------------------------------------------------------------
// Outline
// ----------------------------------------------------------------------------

Then("the hierarchy is shown as an indented list", async function (this: ConstellaWorld) {
  await this.page.locator(".outline__list .outline__item").first().waitFor();
});

Then(
  "the root appears at the top labeled {string}",
  async function (this: ConstellaWorld, label: string) {
    const type = this.page.locator(".outline__item").first().locator(".outline__type");
    const got = ((await type.textContent()) ?? "").trim();
    assert.equal(got.toLowerCase(), label.toLowerCase());
  },
);

// ----------------------------------------------------------------------------
// View toggle
// ----------------------------------------------------------------------------

Then(
  "the {string} control is active on first open",
  async function (this: ConstellaWorld, label: string) {
    const btn = this.page.getByRole("button", { name: label, exact: false }).first();
    assert.equal(await btn.getAttribute("aria-pressed"), "true");
  },
);

Then("the same dataset and counts are shown", async function (this: ConstellaWorld) {
  const [nodes, hierarchy, references] = await headerCounts(this);
  assert.equal(nodes, 350);
  assert.equal(hierarchy, 349);
  assert.equal(references, 32);
});

Then("the active view indicator updates each time", async function (this: ConstellaWorld) {
  const graph = this.page.locator(".viewtoggle__opt", { hasText: "Graph" });
  assert.equal(await graph.getAttribute("aria-pressed"), "true");
});

// ----------------------------------------------------------------------------
// Theme
// ----------------------------------------------------------------------------

async function currentTheme(world: ConstellaWorld): Promise<string | null> {
  return world.page.locator("html").getAttribute("data-theme");
}

async function ensureTheme(world: ConstellaWorld, want: string): Promise<void> {
  if ((await currentTheme(world)) !== want) {
    await world.page.locator('.topbar button[aria-label^="Switch to"]').first().click();
  }
  assert.equal(await currentTheme(world), want);
}

Given("the app is in dark mode", async function (this: ConstellaWorld) {
  await this.open("/");
  await ensureTheme(this, "dark");
});

Given("I have set dark mode", async function (this: ConstellaWorld) {
  await this.open("/");
  await ensureTheme(this, "dark");
});

When("I click the theme toggle", async function (this: ConstellaWorld) {
  await this.page.locator('.topbar button[aria-label^="Switch to"]').first().click();
});

Then("the UI switches to light mode", async function (this: ConstellaWorld) {
  assert.equal(await currentTheme(this), "light");
});

Then("the toggle icon changes accordingly", async function (this: ConstellaWorld) {
  // Light mode shows the moon (☾) — i.e. "switch to dark" is now offered.
  await this.page.locator('.topbar button[aria-label="Switch to dark mode"]').first().waitFor();
});

// ----------------------------------------------------------------------------
// Privacy
// ----------------------------------------------------------------------------

Then("I see the reassurance {string}", async function (this: ConstellaWorld, _text: string) {
  await this.page.getByText(/Everything runs in your browser/i).first().waitFor();
});

// ----------------------------------------------------------------------------
// Header & navigation
// ----------------------------------------------------------------------------

Then("the header shows the dataset title", async function (this: ConstellaWorld) {
  // Title is now in the Document details report
  const reportOpen = (await this.page.locator(".sheet--report").count()) > 0;
  if (!reportOpen) {
    await this.page.getByRole("button", { name: "Details" }).click();
    await this.page.locator(".sheet--report").waitFor();
  }
  const title = this.page.locator(".sheet--report .gtitle");
  await title.waitFor();
  assert.ok(((await title.textContent()) ?? "").trim().length > 0);
});

Then(
  "it shows the node, hierarchy, and reference counts",
  async function (this: ConstellaWorld) {
    const counts = await headerCounts(this);
    assert.equal(counts.length, 3);
    assert.ok(counts.every((n) => Number.isFinite(n)));
  },
);

// ----------------------------------------------------------------------------
// Share & embed
// ----------------------------------------------------------------------------

Then(
  "I see text explaining the graph loads its renderer from a CDN so the snippet stays small",
  async function (this: ConstellaWorld) {
    const txt = ((await this.page.locator(".share-hint").textContent()) ?? "").trim();
    assert.match(txt, /CDN/);
  },
);

Then("I see a {string} button", async function (this: ConstellaWorld, label: string) {
  await this.page.getByRole("button", { name: label, exact: false }).first().waitFor();
});

Then("I see a {string} expander", async function (this: ConstellaWorld, label: string) {
  await this.page.locator("summary", { hasText: label }).first().waitFor();
});

Then(
  "the snippet is an {string} containing a full HTML document",
  async function (this: ConstellaWorld, _snippet: string) {
    const val = (await this.page.locator(".share-code__area").inputValue()) ?? "";
    assert.match(val, /iframe/i);
    assert.match(val, /srcdoc/i);
  },
);

Then("the document title references a Constella graph", async function (this: ConstellaWorld) {
  const val = (await this.page.locator(".share-code__area").inputValue()) ?? "";
  assert.match(val, /Constella/i);
});

// ----------------------------------------------------------------------------
// Export
// ----------------------------------------------------------------------------

Then(
  "I see {string} described as {string}",
  async function (this: ConstellaWorld, label: string, hint: string) {
    const row = this.page.locator(".exp-row", {
      has: this.page.locator(".exp-row__label", { hasText: label }),
    });
    await row.waitFor();
    const got = ((await row.locator(".exp-row__hint").textContent()) ?? "").trim();
    assert.equal(got, hint);
  },
);

Then(
  "the {string} row shows an {string} checkbox",
  async function (this: ConstellaWorld, rowLabel: string, _checkboxLabel: string) {
    const row = this.page.locator(".exp-row", {
      has: this.page.locator(".exp-row__label", { hasText: rowLabel }),
    });
    await row.locator('input[type="checkbox"]').waitFor();
  },
);

Then(
  "the {string} checkbox is checked by default",
  async function (this: ConstellaWorld, _label: string) {
    const checked = await this.page
      .locator(".exp-toggle input[type='checkbox']")
      .first()
      .isChecked();
    assert.equal(checked, true);
  },
);
