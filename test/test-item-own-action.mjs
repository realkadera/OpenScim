// An inventory item's own action, one the interface has no use of its own for (the Blackstone fragment's "Activate"),
// reaches the encounter: from a left click, with the first of the cache's actions, and from the right-click menu.
// On Zebak's route, whose encounter has no use for it; what it is handed is read off its resolveHazards.
import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium } from "playwright-core";
import { browserOptions } from "../tools/browser.mjs";

const blackstoneFragment = 28357; // CACHE BLACKSTONE_FRAGMENT: "Activate" first

test("an item's own action reaches the encounter", async () => {
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
    const actions = await page.evaluate((id) => engine.objTypeLoader.load(id).inventoryActions, blackstoneFragment);
    assert.equal(actions[0], "Activate", "the cache's first action");
    await page.evaluate((id) => {
      engine.player().inventory[0] = { id };
      window.itemUses = [];
      const resolveHazards = engine.encounter.resolveHazards.bind(engine.encounter);
      engine.encounter.resolveHazards = (context, mechanics) => {
        if (context.inputs.itemUses) window.itemUses.push(...context.inputs.itemUses);
        return resolveHazards(context, mechanics);
      };
    }, blackstoneFragment);
    const slot = page.locator('button[aria-label^="Item "]').first();
    await page.waitForFunction((id) => document.querySelector('button[aria-label^="Item "]').getAttribute("aria-label") === "Item " + id, blackstoneFragment);
    // A left click.
    await slot.click();
    await page.waitForFunction(() => window.itemUses.length === 1, null, { timeout: 10000 });
    assert.deepEqual(await page.evaluate(() => window.itemUses), [{ inventoryIndex: 0, itemId: blackstoneFragment, option: "Activate" }]);
    // The right-click menu's entry.
    await slot.click({ button: "right" });
    const menuItems = page.locator('[role="menuitem"]');
    await menuItems.first().waitFor();
    const texts = await menuItems.evaluateAll((items) => items.map((item) => item.textContent));
    const index = texts.findIndex((text) => text.startsWith("Activate"));
    assert.ok(index >= 0, JSON.stringify(texts));
    const box = await menuItems.nth(index).boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForFunction(() => window.itemUses.length === 2, null, { timeout: 10000 });
    assert.equal(await page.evaluate(() => window.itemUses[1].option), "Activate");
  } finally {
    await browser.close();
  }
});
