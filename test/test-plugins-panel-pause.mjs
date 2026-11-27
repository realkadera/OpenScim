// The fight stands still while the Plugins panel is open, and runs again once
// the panel is closed. In the lobby there is no fight to hold.
import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { browserOptions } from "../tools/browser.mjs";

const origin = process.env.TEST_ORIGIN;
const TICK_MS = 600; // WIKI: a game tick is 0.6 s
const browser = await chromium.launch(browserOptions);

try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.stack));
  await page.route("**/engine/SimulationEngine.js*", async (route) => {
    const marker = "this.encounter = options.encounter;";
    const response = await route.fetch();
    const body = await response.text();
    assert.ok(body.includes(marker));
    await route.fulfill({ response, body: body.replace(marker, marker + "if (options.encounter.kind === 'zebak') window.engine = this;") });
  });

  await page.goto(origin + "/zebak/");
  await page.waitForFunction(() => window.engine, null, { timeout: 60000 });
  await page.locator(".loading-screen").waitFor({ state: "hidden", timeout: 60000 });
  const tick = () => page.evaluate(() => engine.getState().currentTick);
  const runs = (from) => page.waitForFunction((since) => engine.getState().currentTick >= since + 2, from, { timeout: 60000 });
  await runs(await tick());

  // Open: one tick already under way may still land, then none for five more.
  await page.click('[data-tutorial="plugins-button"]');
  await page.waitForSelector(".plugins-overlay.open");
  await page.waitForTimeout(TICK_MS);
  const held = await tick();
  await page.waitForTimeout(5 * TICK_MS);
  assert.equal(await tick(), held, "the fight ticked with the Plugins panel open");

  await page.click('.plugins-overlay button[aria-label="Close plugins"]');
  await page.waitForSelector(".plugins-overlay.open", { state: "detached" });
  await runs(held);

  // The same button toggles: open holds again, a second press lets it run.
  await page.click('[data-tutorial="plugins-button"]');
  await page.waitForSelector(".plugins-overlay.open");
  await page.waitForTimeout(TICK_MS);
  const heldAgain = await tick();
  await page.waitForTimeout(5 * TICK_MS);
  assert.equal(await tick(), heldAgain, "the fight ticked with the Plugins panel open again");
  await page.keyboard.press("Escape");
  await page.waitForSelector(".plugins-overlay.open", { state: "detached" });
  await runs(heldAgain);

  // The scene says why it stands still (client/plugins/pluginsPausedHint.js):
  // no label with the panel closed, one with it open.
  const label = page.locator(".plugins-paused-hint");
  const pulsing = () => page.evaluate(() => [".plugins-paused-hint", ".plugins-overlay .panel-close-button"].map((selector) => document.querySelector(selector).classList.contains("plugins-paused-pulse")));
  assert.equal(await label.count(), 0);
  await page.click('[data-tutorial="plugins-button"]');
  await page.waitForSelector(".plugins-overlay.open");
  assert.equal(await label.textContent(), "Paused – close Plugins to resume");
  // It is over the scene, clear of the panel.
  const [labelBox, panelBox] = [await label.boundingBox(), await page.locator(".plugins-overlay").boundingBox()];
  assert.ok(labelBox.x + labelBox.width < panelBox.x, "the label lies under the Plugins panel");
  // A click on the scene pulses the label and the panel's close button; the other buttons turn the camera and do not.
  assert.deepEqual(await pulsing(), [false, false]);
  await page.mouse.click(420, 620, { button: "middle" });
  assert.deepEqual(await pulsing(), [false, false]);
  await page.mouse.click(420, 620);
  assert.deepEqual(await pulsing(), [true, true]);
  // The label is a button that closes the panel; it goes with it and the fight runs.
  await page.waitForTimeout(TICK_MS);
  const heldUnderLabel = await tick();
  await label.click();
  await page.waitForSelector(".plugins-overlay.open", { state: "detached" });
  assert.equal(await label.count(), 0);
  assert.equal(await page.locator(".plugins-paused-pulse").count(), 0);
  await runs(heldUnderLabel);

  assert.deepEqual(errors, []);
  console.log("Plugins panel: the fight holds while it is open, the scene says so, and it runs once the panel is closed");
} finally {
  await browser.close();
}
