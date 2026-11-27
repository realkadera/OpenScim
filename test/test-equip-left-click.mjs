// A left click on a worn item in the inventory puts it on, whether the cache names its "Wear" (the Torva platebody
// 26384) or gives the item no actions at all (the Torva platebody 30303, which gets them from equipment.js).
import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium } from "playwright-core";
import { browserOptions } from "../tools/browser.mjs";

test("a left click wears either Torva platebody", async () => {
  const browser = await chromium.launch(browserOptions);
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
    await page.route("**/engine/SimulationEngine.js*", async (route) => {
      const response = await route.fetch();
      const marker = "this.encounter = options.encounter;";
      const body = await response.text();
      assert.ok(body.includes(marker));
      await route.fulfill({ response, body: body.replace(marker, marker + "window.engine=this;") });
    });
    await page.goto(process.env.TEST_ORIGIN + "/zebak/");
    await page.waitForFunction(() => window.engine?.objTypeLoader && engine.worldState.actors.has("zebak"));
    await page.waitForSelector('button[aria-label^="Item "]');
    // The left click of the inventory (Grid.js) takes the first action that is not undefined.
    const notWorn = await page.evaluate(async () => {
      const { getEquipmentDefinitions, getInventoryActions } = await import("/data/equipment.js");
      return getEquipmentDefinitions()
        .map(({ id }) => [id, getInventoryActions(id, new Array(5)).find((action) => action !== undefined)])
        .filter(([, first]) => first !== "Wear" && first !== "Wield");
    });
    assert.deepEqual(notWorn, [], "every item of equipment.js without cache actions is worn or wielded first");
    // The second platebody has the restored one's bonuses (itemVariants.js; WIKI: Torva platebody, Restored).
    const stats = await page.evaluate(() => [26384, 30303].map((id) => { const s = engine.lookupItemStats(id); return [s.attackMagic, s.attackRanged, s.defenceStab, s.defenceSlash, s.defenceCrush, s.defenceMagic, s.defenceRanged, s.meleeStrength, s.prayer]; }));
    assert.deepEqual(stats, [[-18, -14, 117, 111, 117, -11, 142, 6, 1], [-18, -14, 117, 111, 117, -11, 142, 6, 1]]);
    for (const id of [26384, 30303]) {
      await page.evaluate((id) => {
        const player = engine.player();
        player.equipment.body = undefined;
        player.inventory[0] = { id };
      }, id);
      const slot = page.locator('button[aria-label^="Item "]').first();
      await page.waitForFunction((id) => document.querySelector('button[aria-label^="Item "]').getAttribute("aria-label") === "Item " + id, id);
      await slot.click();
      await page.waitForFunction((id) => engine.player().equipment.body === id, id, { timeout: 10000 });
    }
  } finally {
    await browser.close();
  }
});
