#!/usr/bin/env node
// Records which cache groups a route reads on the way to its first frame, so
// that tools/fetch-assets.mjs can pack them into a boot pack: a cache of a
// megabyte or two that a first visit starts from while the whole one follows.
//
//   npm run build && node tools/boot-packs.mjs [--routes /] [--settle 8000]
//
// Writes tools/assets/boot-packs/<name>.json, { "<cache index>": [group ids] }
// as the lists of tools/assets/cache-groups/. The name is the route's first
// path segment, "lobby" for "/". Then `npm run assets` builds the packs.
//
// A pack holds what the recording read: the page loaded and left alone for
// --settle milliseconds. What the route needs later and the pack lacks is
// there once the whole cache has arrived (CacheManager, client/assets/player.js).
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { chromium } from "playwright-core";
import { formatGroups } from "./assets/cache-groups.mjs";
import { bootPacksDirectory, bootPackName } from "./assets/boot-packs.mjs";
import { chromeArgs, chromePath, serveDist } from "./serve-dist.mjs";

const { values: opt } = parseArgs({
  options: {
    routes: { type: "string", default: "/" },
    settle: { type: "string", default: "8000" },
  },
});

const server = await serveDist();
const browser = await chromium.launch({
  executablePath: chromePath,
  args: chromeArgs,
});
try {
  for (const route of opt.routes.split(",")) {
    const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, ignoreHTTPSErrors: true });
    const page = await context.newPage();
    await page.addInitScript(() => {
      globalThis.__cacheReads = new Set();
      // A recording reads the whole cache, never a pack of an earlier one.
      globalThis.__noBootPack = true;
    });
    await page.goto(server.origin + route);
    await page.waitForFunction(
      () => {
        const screen = document.querySelector(".loading-screen");
        if (screen) window.__sawLoading = true;
        return window.__sawLoading && (!screen || screen.classList.contains("hidden"));
      },
      null,
      { timeout: 300000, polling: 100 },
    );
    // The lobby's window onto every fight: the encounter picker draws the
    // portrait of the tile it is on, so the recording walks all of them.
    if (route === "/") {
      const entry = page.getByText("Encounters", { exact: true }).first();
      if (!(await entry.isVisible())) await page.locator('[data-launcher="menu"]:visible').first().click();
      await entry.click();
      await page.locator(".ep").waitFor();
      for (let tile = await page.locator(".ep-tile").count(); tile > 0; tile--) {
        await page.keyboard.press("ArrowRight");
        await page.waitForTimeout(400);
      }
    }
    await page.waitForTimeout(Number(opt.settle));
    const groups = {};
    for (const read of await page.evaluate(() => [...globalThis.__cacheReads])) {
      const [index, group] = read.split(":").map(Number);
      (groups[index] ??= []).push(group);
    }
    await context.close();
    const name = bootPackName(route);
    mkdirSync(bootPacksDirectory, { recursive: true });
    writeFileSync(path.join(bootPacksDirectory, name + ".json"), formatGroups(groups));
    console.log(name.padEnd(24) + Object.values(groups).reduce((sum, ids) => sum + ids.length, 0) + " groups");
  }
} finally {
  await browser.close();
  server.close();
}
