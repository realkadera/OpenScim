// The Spellbook tab of a fight on the standard spellbook (Zebak) lists the whole book, and a combat spell clicked
// there and then on the boss is cast. Its grid was an empty list once, and the tab showed nothing; then the combat
// spells alone.
import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { browserOptions } from "../tools/browser.mjs";

const browser = await chromium.launch(browserOptions);
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  // Every icon the tab asks for is in the pack.
  const missing = [];
  page.on("response", (response) => {
    if (response.status() === 404 && response.url().includes("normal_spell")) missing.push(response.url());
  });
  await page.route("**/engine/SimulationEngine.js*", async (route) => {
    const response = await route.fetch();
    const marker = "this.encounter = options.encounter;";
    const body = await response.text();
    assert.ok(body.includes(marker));
    await route.fulfill({ response, body: body.replace(marker, marker + "window.engine=this;") });
  });
  await page.goto(process.env.TEST_ORIGIN + "/zebak/");
  await page.waitForFunction(() => window.engine?.objTypeLoader && engine.worldState.actors.has("zebak"));
  // Air and mind runes, for Wind Strike.
  await page.evaluate(() => {
    const player = engine.player();
    player.inventory[20] = { id: 556, quantity: 1000 };
    player.inventory[21] = { id: 558, quantity: 1000 };
    window.casts = [];
    const emit = engine.tickEvents.emit.bind(engine.tickEvents);
    engine.tickEvents.emit = (event) => {
      if (event.type === "attack_started" && event.spellId) casts.push(event.spellId);
      return emit(event);
    };
  });
  await page.waitForTimeout(1500);
  await page.locator('[aria-label="Spellbook (F6)"]').click();
  await page.waitForSelector('button[data-spell="fire_surge"]');
  const spells = await page.evaluate(() => [...document.querySelectorAll("button[data-spell]")].map((button) => button.dataset.spell));
  assert.equal(spells.length, 75);
  for (const spell of ["wind_strike", "fire_surge", "iban_blast", "varrock_teleport", "high_level_alchemy"]) assert.ok(spells.includes(spell), spell);

  await page.locator('button[data-spell="wind_strike"]').click();
  await page.mouse.click(800, 240); // Zebak, in the middle of the scene
  await page.waitForFunction(() => casts.includes("Wind Strike"), null, { timeout: 20000 });
  assert.deepEqual(missing, []);
} finally {
  await browser.close();
}
