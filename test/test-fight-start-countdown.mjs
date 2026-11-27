// The application counts "3, 2, 1" before a fight, unless the encounter's
// descriptor says `fightStartCountdown: false` (Grid.js, gOOwnCountdown): then
// the fight runs from the start. The Maggot King keeps his countdown; here he
// is loaded as he is, and once more with the field put into his descriptor.
import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { browserOptions } from "../tools/browser.mjs";

const origin = process.env.TEST_ORIGIN;
const browser = await chromium.launch(browserOptions);

// Loads the Maggot King's route and says whether a countdown was shown and on
// which tick the engine stood once the page had run for a while.
async function load(withoutCountdown) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 850 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.stack));
  // Every element of the countdown that is ever put on the page, from the first script on.
  await page.addInitScript(() => {
    window.countdownsSeen = 0;
    new MutationObserver((records) => {
      for (const record of records)
        for (const node of record.addedNodes)
          if (node.nodeType === 1 && (node.matches(".fight-start-countdown") || node.querySelector(".fight-start-countdown"))) window.countdownsSeen++;
    }).observe(document, { childList: true, subtree: true });
  });
  const patches = [["**/engine/SimulationEngine.js*", "this.encounter = options.encounter;", "if (options.encounter.kind === 'maggot_king') window.engine = this;"]];
  if (withoutCountdown) patches.push(["**/encounters/maggot-king/encounter.js*", "descriptor: {", "fightStartCountdown: false,"]);
  for (const [path, marker, probe] of patches) {
    await page.route(path, async (route) => {
      const response = await route.fetch();
      const body = await response.text();
      assert.ok(body.includes(marker));
      await route.fulfill({ response, body: body.replace(marker, marker + probe) });
    });
  }
  await page.goto(origin + "/maggot-king/");
  await page.waitForFunction(() => window.engine, null, { timeout: 60000 });
  await page.locator(".loading-screen").waitFor({ state: "hidden", timeout: 60000 });
  // Without a countdown the fight is under way at once; with one it waits for "GO".
  await page.waitForFunction(() => engine.currentTick >= 2 || window.countdownsSeen > 0, null, { timeout: 60000 });
  const seen = await page.evaluate(() => ({ countdowns: window.countdownsSeen, tick: engine.currentTick }));
  assert.deepEqual(errors, []);
  await page.close();
  return seen;
}

try {
  const as = await load(false);
  assert.ok(as.countdowns > 0, "the Maggot King's fight starts with a countdown");
  const without = await load(true);
  assert.equal(without.countdowns, 0, "fightStartCountdown: false shows no countdown");
  assert.ok(without.tick >= 2, "and the fight runs from the start");
  console.log("A fight counts down unless its descriptor says fightStartCountdown: false");
} finally {
  await browser.close();
}
