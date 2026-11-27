// A first visit is in the world before the whole game cache has arrived: it
// starts from the route's boot pack (CacheManager.bootFromPack,
// client/assets/player.js), and the whole cache follows behind the running
// game and is kept for the next visit, which downloads neither.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { browserOptions } from "../tools/browser.mjs";
import { unzipCache } from "../tools/assets/cache.mjs";

const origin = process.env.TEST_ORIGIN;
const repo = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(fs.readFileSync(path.join(repo, "client/osrs-cache/manifest.json"), "utf8"));
const whole = await unzipCache(fs.readFileSync(path.join(repo, "client/osrs-cache/disk.zip")));
assert.ok(manifest.bootPacks?.lobby, "client/osrs-cache has no boot pack for the lobby: npm run assets");

const browser = await chromium.launch(browserOptions);

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 850 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  // The groups a read found empty that the whole cache has ("Empty container
  // <index>:<group>"): read from the pack too early. One the whole cache
  // lacks as well is not the pack's doing.
  const empty = new Set();
  page.on("console", (message) => {
    for (const [, group] of message.text().matchAll(/Empty container (\d+:\d+)/g)) empty.add(group);
  });
  const missing = async () => {
    const found = [];
    for (const group of empty) if (await whole.group(...group.split(":").map(Number))) found.push(group);
    return found;
  };
  let requests = [];
  page.on("request", (request) => {
    const { pathname } = new URL(request.url());
    if (pathname.startsWith("/osrs-cache/")) requests.push(pathname);
  });
  // The whole cache is held back until the test lets it through.
  let release;
  const held = new Promise((resolve) => (release = resolve));
  await page.route("**/osrs-cache/disk.zip*", async (route) => {
    await held;
    await route.continue();
  });
  // The checksum of the cache the browser keeps, once there is one.
  const stored = () =>
    page.evaluate(
      () =>
        new Promise((resolve, reject) => {
          const open = indexedDB.open("osrs-yama-cache", 2);
          open.onerror = () => reject(open.error);
          open.onsuccess = () => {
            const read = open.result.transaction("meta").objectStore("meta").getAll();
            read.onsuccess = () => {
              open.result.close();
              resolve(read.result.map((meta) => meta.manifestHash));
            };
          };
        }),
    );
  const visit = async () => {
    requests = [];
    await page.goto(origin + "/");
    await page.locator(".loading-screen[aria-busy=false]").waitFor({ state: "attached", timeout: 60000 });
    await page.locator(".loading-screen").waitFor({ state: "hidden", timeout: 60000 });
  };

  // index.html has the loading screen on the page before any script has run.
  const html = await (await fetch(origin + "/")).text();
  // A built page has its own text ahead of it (tools/seo/prerender.mjs).
  assert.match(html, /<div id="root">(<main .*<\/main>)?<div class="loading-screen"/, "the loading screen is in index.html");

  await visit();
  assert.ok(requests.includes("/osrs-cache/boot/lobby.zip"), "the first visit asks for the lobby's boot pack");
  assert.deepEqual(await stored(), [], "and is in the world with the whole cache still held back");
  assert.deepEqual(errors, []);

  // The lobby's encounter picker has what it draws: every portrait is in the pack.
  const entry = page.getByText("Encounters", { exact: true }).first();
  if (!(await entry.isVisible())) await page.locator('[data-launcher="menu"]:visible').first().click();
  await entry.click();
  await page.locator(".ep").waitFor();
  for (let tile = await page.locator(".ep-tile").count(); tile > 0; tile--) {
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(150);
  }
  assert.deepEqual(await missing(), [], "the picker read a group the pack lacks");

  // A fight is entered with the whole cache: its scene waits for it, and
  // reads nothing the pack lacks meanwhile.
  await page.locator(".ep-search").fill("yama");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => location.pathname.startsWith("/yama"), null, { timeout: 60000 });
  await page.waitForTimeout(4000);
  assert.deepEqual(await stored(), [], "still held back");
  assert.deepEqual(await missing(), [], "the fight read a group before the whole cache was there");

  release();
  for (let waited = 0; !(await stored()).length; waited += 500) {
    assert.ok(waited < 120000, "the whole cache follows and is kept");
    await page.waitForTimeout(500);
  }
  assert.deepEqual(await stored(), [manifest.diskZipSha256]);
  await page.waitForTimeout(3000);
  assert.deepEqual(await missing(), [], "the fight's scene, loaded from the whole cache");
  assert.deepEqual(errors, []);

  await visit();
  assert.deepEqual(
    requests.filter((name) => name !== "/osrs-cache/keys.json"),
    ["/osrs-cache/manifest.json"],
    "the next visit reads the kept cache: no boot pack, no download",
  );
  assert.deepEqual(errors, []);

  // A fight is entered with the whole cache: its first visit has no pack to
  // start from, and index.html asks for the whole cache itself.
  await page.unroute("**/osrs-cache/disk.zip*");
  const fresh = await browser.newPage({ viewport: { width: 1280, height: 850 } });
  const asked = [];
  fresh.on("request", (request) => {
    const { pathname } = new URL(request.url());
    if (pathname.startsWith("/osrs-cache/")) asked.push(pathname);
  });
  await fresh.goto(origin + "/yama/");
  await fresh.locator(".loading-screen[aria-busy=false]").waitFor({ state: "attached", timeout: 120000 });
  assert.deepEqual(asked.filter((name) => name !== "/osrs-cache/keys.json"), ["/osrs-cache/manifest.json", "/osrs-cache/disk.zip"], "once, and no pack");
} finally {
  await browser.close();
}
console.log("boot pack: a first visit starts from it, the whole cache follows and is kept");
