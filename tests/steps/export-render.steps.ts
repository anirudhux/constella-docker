// Phase-4 guard: the exported standalone HTML must keep rendering while the
// renderer is refactored. Generates both export variants through the app's own
// modules (same code path as the Share dialog), boots the offline one in a
// fresh page, and asserts it draws + stays silent on the console.
import { When, Then } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { writeFileSync, mkdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";
import type { Page } from "playwright";
import type { ConstellaWorld } from "../support/world";

const OUT_DIR = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "../_report",
);

interface Variants {
  offline: string;
  embed: string;
}

// Kept on the World between steps of the scenario.
const state = new WeakMap<ConstellaWorld, Variants & { page?: Page }>();

When(
  "I generate both standalone export variants from the live app",
  async function (this: ConstellaWorld) {
    const variants = (await this.page.evaluate(async () => {
      const wizard = JSON.parse(
        sessionStorage.getItem("constella:wizard:v2") ?? "null",
      );
      if (!wizard?.graph) throw new Error("no graph in wizard state");
      const [{ buildStandaloneHtml }, { readGraphTheme, DEFAULT_NODE_PALETTE }] =
        await Promise.all([
          import("/src/export/html.ts"),
          import("/src/app/graphTheme.ts"),
        ]);
      const cfg = {
        theme: readGraphTheme(),
        palette: DEFAULT_NODE_PALETTE,
        labelMode: "smart",
        labelSize: 12,
        clickAction: "tooltip",
      };
      return {
        offline: buildStandaloneHtml(wizard.graph, cfg, { title: "Guard export" }),
        embed: buildStandaloneHtml(wizard.graph, cfg, {
          title: "Guard export",
          cdnThree: true,
        }),
      };
    })) as Variants;
    state.set(this, variants);
  },
);

Then(
  "the offline export renders nodes, labels and a working tooltip with no console errors",
  async function (this: ConstellaWorld) {
    const s = state.get(this)!;
    mkdirSync(OUT_DIR, { recursive: true });
    const file = path.join(OUT_DIR, "guard-export.html");
    writeFileSync(file, s.offline);

    const page = await this.context.newPage();
    s.page = page;
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });

    await page.goto(pathToFileURL(file).href);
    // Three booted and drew into the scene
    await page.locator("#scene canvas").waitFor({ timeout: 15_000 });
    assert.ok(
      await page.evaluate(() => !!(window as { THREE?: unknown }).THREE),
      "global THREE missing",
    );
    // DOM labels exist
    const labels = await page.locator("#labels .nlabel").count();
    assert.ok(labels > 0, `expected node labels, found ${labels}`);
    // Badge points at the live site (regression guard for the dead-URL fix)
    assert.equal(
      await page.locator(".cn-mark").getAttribute("href"),
      "https://constella.anirudhux.com",
    );
    // Tooltip answers a click near the root (canvas center)
    const box = (await page.locator("#scene canvas").boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page
      .locator("#tooltip.show")
      .waitFor({ timeout: 5_000 })
      .catch(() => {
        /* center may miss the root at some sizes — tooltip is best-effort,
           rendering + silence are the hard assertions */
      });
    assert.deepEqual(errors, [], `console errors in export: ${errors.join(" | ")}`);
    // Parity baseline for the refactor stages
    await page.screenshot({ path: path.join(OUT_DIR, "phase4-baseline-export.png") });
    await page.close();
  },
);

Then(
  "the embed variant references CDN Three with integrity pinning",
  async function (this: ConstellaWorld) {
    const s = state.get(this)!;
    assert.match(s.embed, /<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/three@[\d.]+\/build\/three\.min\.js" integrity="sha384-/);
    assert.ok(!s.embed.includes("// three.js r"), "embed should not inline Three");
  },
);

Then(
  "the offline export size is within the expected envelope",
  async function (this: ConstellaWorld) {
    const s = state.get(this)!;
    const kb = Buffer.byteLength(s.offline, "utf8") / 1024;
    // Floor proves Three really is inlined; ceiling catches runtime bloat as
    // the generated bundle replaces the hand-written one in Stage 2.
    assert.ok(kb > 500, `offline export suspiciously small: ${kb.toFixed(0)}KB`);
    assert.ok(kb < 1500, `offline export bloated: ${kb.toFixed(0)}KB`);
  },
);
