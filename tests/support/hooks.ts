import {
  BeforeAll,
  AfterAll,
  Before,
  After,
  Status,
  setDefaultTimeout,
  type ITestCaseHookParameter,
} from "@cucumber/cucumber";
import { chromium, type Browser } from "playwright";
import { spawn, type ChildProcess } from "node:child_process";
import { BASE_URL, ConstellaWorld } from "./world";

setDefaultTimeout(30_000);

let browser: Browser;
let server: ChildProcess | undefined;

async function waitForServer(url: string, timeoutMs = 40_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Dev server not reachable at ${url} after ${timeoutMs}ms`);
}

BeforeAll(async () => {
  // When BASE_URL is supplied externally (e.g. the live deploy) we don't manage
  // a server — just point at it. Otherwise spawn a vite dev server on a
  // dedicated port so we don't collide with the user's own dev/preview.
  if (!process.env.BASE_URL) {
    server = spawn("npx", ["vite", "--port", "5191", "--strictPort"], {
      stdio: "ignore",
      detached: false,
    });
  }
  await waitForServer(BASE_URL);
  browser = await chromium.launch();
});

Before(async function (this: ConstellaWorld) {
  this.context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  this.page = await this.context.newPage();
});

After(async function (this: ConstellaWorld, { result }: ITestCaseHookParameter) {
  if (result?.status === Status.FAILED && this.page) {
    this.attach(await this.page.screenshot(), "image/png");
  }
  await this.context?.close();
});

AfterAll(async () => {
  await browser?.close();
  if (server && !server.killed) server.kill();
});
