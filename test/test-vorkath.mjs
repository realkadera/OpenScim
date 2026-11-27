// Vorkath loads on her route and is drawn from the trimmed cache (her crater's
// map square and the squares around it, her and her spawn); her acid is drawn
// where it lies; her icy breath freezes the player (the engine's rule
// playerMovementLocked) until the spawn is gone; she dies into the victory
// screen. The mechanics themselves are digested by the determinism harness
// (tools/determinism/scenarios/vorkath.mjs).
import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const origin = process.env.TEST_ORIGIN;
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe",
  args: ["--enable-unsafe-swiftshader"],
});

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 850 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.stack));
  // A model, an animation or a map square missing from the trimmed cache is logged, not thrown.
  page.on("console", (message) => message.text().includes("Empty container") && errors.push(message.text()));
  for (const [path, marker, probe] of [
    ["**/engine/SimulationEngine.js*", "this.encounter = options.encounter;", "if (options.encounter.kind === 'vorkath') window.engine = this;"],
    ["**/encounters/shared/buildScene.js*", "const scene = new Scene();", "window.scene = scene;"],
  ]) {
    await page.route(path, async (route) => {
      const response = await route.fetch();
      const body = await response.text();
      assert.ok(body.includes(marker));
      await route.fulfill({ response, body: body.replace(marker, marker + probe) });
    });
  }

  await page.goto(origin + "/vorkath/");
  await page.waitForFunction(() => window.engine && window.scene, null, { timeout: 60000 });
  await page.locator(".loading-screen").waitFor({ state: "hidden", timeout: 60000 });
  assert.equal(new URL(page.url()).pathname, "/vorkath/");

  // The wiki's best ranged setup (loadouts.js): the two-handed Ascension crossbows with their diamond bolts (e).
  const setup = await page.evaluate(() => {
    const { equipment, inventory, combatSupplies } = engine.player();
    return { weapon: equipment.weapon, shield: equipment.shield ?? null, ammo: combatSupplies.equippedAmmo.id, items: inventory.filter(Boolean).length };
  });
  assert.deepEqual(setup, { weapon: 34681, shield: null, ammo: 34696, items: 28 });

  // Through her specials: acid on the floor drawn as the game's acid, and a
  // freeze that holds the player while the spawn is up.
  const specials = await page.evaluate(() => {
    engine.setMechanicsConfig({ ...engine.mechanicsConfig, infiniteHealth: true });
    const state = () => engine.getEncounterSnapshot().state;
    let acid = null;
    let frozen = null;
    for (let tick = 0; tick < 200 && (acid === null || frozen === null); tick++) {
      const before = [...engine.player().position];
      engine.advanceTick([before[0], before[1] - 5]); // he keeps trying to walk south
      if (acid === null && state().acidPools.length > 0) {
        const encounter = engine.getEncounterSnapshot();
        const drawn = scene.sceneObjectController.update({ state: { encounter }, interpolatedTick: engine.worldState.tick });
        acid = { pools: encounter.state.acidPools.length, drawn: drawn.length, locs: [...new Set(drawn.map((object) => object.data.locId))] };
      }
      if (frozen === null && state().frozen) {
        engine.advanceTick([before[0], before[1] - 5]);
        frozen = { held: engine.player().position[0] === before[0] && engine.player().position[1] === before[1] };
      }
    }
    return { acid, frozen };
  });
  assert.ok(specials.acid && specials.acid.pools > 20 && specials.acid.drawn === specials.acid.pools, JSON.stringify(specials.acid));
  assert.deepEqual(specials.acid.locs, [32000]);
  assert.deepEqual(specials.frozen, { held: true });
  await page.waitForFunction(() => scene.isNpcTypeLoaded(8061) && scene.isNpcTypeLoaded(8063), null, { timeout: 60000 });

  // Killed; the application's own loop plays her death and ends the fight.
  await page.evaluate(() => engine.setBossHp(0));
  await page.waitForFunction(() => engine.getEncounterOutcome().phase === "victory" && document.body.innerText.includes("VORKATH DEFEATED"), null, { timeout: 120000 });
  assert.deepEqual(errors, []);
  console.log("Vorkath loaded on /vorkath/, drew her acid, froze the player for her spawn, and was won");
} finally {
  await browser.close();
}
