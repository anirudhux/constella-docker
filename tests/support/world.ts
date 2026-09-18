import { setWorldConstructor, World, type IWorldOptions } from "@cucumber/cucumber";
import type { BrowserContext, Page } from "playwright";

// Where the suite points. Defaults to the locally-spawned vite preview
// (see hooks.ts); override to run the same scenarios against the live deploy:
//   BASE_URL=https://constella.anirudhux.com npm run test:smoke
export const BASE_URL = process.env.BASE_URL ?? "http://localhost:5191";

// One World per scenario. The browser is shared (launched in BeforeAll); the
// context + page are created fresh per scenario in the Before hook, so state
// never leaks between scenarios.
export class ConstellaWorld extends World {
  context!: BrowserContext;
  page!: Page;

  constructor(options: IWorldOptions) {
    super(options);
  }

  async open(path = "/"): Promise<void> {
    await this.page.goto(new URL(path, BASE_URL).href, { waitUntil: "domcontentloaded" });
  }
}

setWorldConstructor(ConstellaWorld);
