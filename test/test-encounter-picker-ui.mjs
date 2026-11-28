// The encounter picker in the page: it opens from the menu, lists the
// encounters in their sections, is searched and walked with the keyboard,
// and starts a fight.
import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { browserOptions } from "../tools/browser.mjs";

const origin = process.env.TEST_ORIGIN;
const browser = await chromium.launch(browserOptions);

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.stack));
  await page.goto(origin + "/");
  await page.locator(".loading-screen").waitFor({ state: "hidden", timeout: 60000 });

  // The menu is open when the page loads and shut after a choice from it.
  const open = async () => {
    const entry = page.getByText("Encounters", { exact: true }).first();
    if (!(await entry.isVisible())) await page.locator('[data-launcher="menu"]:visible').first().click();
    await entry.click();
    await page.locator(".ep").waitFor();
  };
  const activeTile = () => page.locator(".ep-tile.active .ep-tile-name").innerText();

  // Every encounter is a tile, under the sections of the catalog; the lobby
  // and the nexus are not fights and have none.
  await open();
  const names = await page.locator(".ep-tile-name").allInnerTexts();
  for (const name of ["Zebak", "The Inferno", "Fortis Colosseum", "Vardorvis", "Yama"]) assert.ok(names.includes(name), name + " has a tile");
  assert.ok(!names.includes("Lobby"));
  const sections = (await page.locator(".ep-section").allInnerTexts()).map((text) => text.replace(/\s*\d+$/, "").trim());
  for (const section of ["Raids", "Waves", "Desert Treasure II", "Bosses"]) assert.ok(sections.includes(section), "section " + section);
  // What is announced and not built is listed, and cannot be fought. (Nothing is, since the Whisperer was built;
  // test-encounter-picker.mjs lists such a fight from a catalog of its own.)
  if (await page.locator(".ep-tile.soon").count()) {
    await page.locator(".ep-tile.soon").first().click();
    assert.equal(await page.locator(".ep-fight").count(), 0);
  }

  // The search box has the keyboard: a search by another name finds the
  // encounter, one that names a mode chooses it, and the arrows walk the tiles.
  assert.ok(await page.locator(".ep-search").evaluate((input) => input === document.activeElement));
  await page.keyboard.type("zuk");
  assert.equal(await activeTile(), "The Inferno");
  await page.locator(".ep-search").fill("glyphic");
  assert.equal(await activeTile(), "Yama");
  assert.match(await page.locator(".ep-mode.active .ep-mode-name").innerText(), /Glyphic/);
  await page.locator(".ep-search").fill("zzzz");
  assert.match(await page.locator(".ep-empty").innerText(), /No encounters match/);
  await page.locator(".ep-search").fill("");
  const first = await page.locator(".ep-tile").first().locator(".ep-tile-name").innerText();
  await page.locator(".ep-tile").first().click();
  await page.keyboard.press("ArrowRight");
  assert.notEqual(await activeTile(), first);
  await page.keyboard.press("ArrowLeft");
  assert.equal(await activeTile(), first);
  // A section's chip leaves its tiles alone.
  await page.locator(".ep-chip", { hasText: "Desert Treasure II" }).click();
  assert.deepEqual((await page.locator(".ep-section").allInnerTexts()).length, 1);
  await page.locator(".ep-chip", { hasText: "All" }).click();

  // Escape closes the window; Enter fights the chosen encounter.
  await page.keyboard.press("Escape");
  await page.locator(".ep").waitFor({ state: "detached" });
  assert.equal(new URL(page.url()).pathname, "/");
  await open();
  await page.keyboard.type("vardorvis");
  assert.equal(await activeTile(), "Vardorvis");
  await page.keyboard.press("Enter");
  await page.locator(".ep").waitFor({ state: "detached" });
  await page.waitForFunction(() => location.pathname.startsWith("/vardorvis"), null, { timeout: 60000 });

  assert.deepEqual(errors, []);
  console.log("Encounter picker passed");
} finally {
  await browser.close();
}
