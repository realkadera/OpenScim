// The Leviathan loads on its route and is drawn from the trimmed cache (the
// Scar's arena and its neighbours, the boss, its tails, the pathfinder and the
// tornado); a shadow spell stuns it and says so; the rocks of its roars are
// drawn where they fell and block the way; it dies into the victory screen.
// The mechanics themselves are digested by the determinism harness
// (tools/determinism/scenarios/leviathan.mjs), their rules in
// test-leviathan-rules.mjs.
import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { browserOptions } from "../tools/browser.mjs";

const origin = process.env.TEST_ORIGIN;
const browser = await chromium.launch(browserOptions);

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 850 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.stack));
  // A model, an animation or a map square missing from the trimmed cache is logged, not thrown.
  page.on("console", (message) => message.text().includes("Empty container") && errors.push(message.text()));
  for (const [path, marker, probe] of [
    ["**/engine/SimulationEngine.js*", "this.encounter = options.encounter;", "if (options.encounter.kind === 'leviathan') window.engine = this;"],
    ["**/encounters/shared/buildScene.js*", "const scene = new Scene();", "window.scene = scene;"],
  ]) {
    await page.route(path, async (route) => {
      const response = await route.fetch();
      const body = await response.text();
      assert.ok(body.includes(marker));
      await route.fulfill({ response, body: body.replace(marker, marker + probe) });
    });
  }

  await page.goto(origin + "/leviathan/");
  await page.waitForFunction(() => window.engine && window.scene, null, { timeout: 60000 });
  await page.locator(".loading-screen").waitFor({ state: "hidden", timeout: 60000 });
  assert.equal(new URL(page.url()).pathname, "/leviathan/");
  await page.waitForFunction(() => [12214, 12216, 12217, 12218, 12220, 12222].every((id) => scene.isNpcTypeLoaded(id)), null, { timeout: 60000 });
  // The five tails are drawn round the arena, and are none of the fight's actors.
  await page.waitForFunction(() => [0, 1, 2, 3, 4].every((n) => scene.npcInstanceManager.instanceRegistry.has("leviathan-tail-" + n)), null, { timeout: 60000 });
  assert.equal(await page.evaluate(() => [...engine.worldState.actors.keys()].some((id) => id.includes("tail"))), false);

  // The player starts in the first of its setups (loadouts.js, the wiki's strategies page): the crossbow and its
  // ammunition worn, the rune pouch of Shadow Rush, 27 items so that the twisted bow has a slot for the buckler.
  const setup = await page.evaluate(() => {
    const { equipment, inventory, combatSupplies: supplies } = engine.player();
    return { weapon: equipment.weapon, shield: equipment.shield, items: inventory.filter(Boolean).length, ammo: supplies.equippedAmmo.id, runes: supplies.runePouch.slots.map((slot) => slot.id), spellbook: supplies.spellbook };
  });
  assert.deepEqual(setup, { weapon: 26374, shield: 21000, items: 27, ammo: 21944, runes: [560, 562, 566, 556], spellbook: "ancient" });

  // A shadow spell, in the application's own loop: stunned, and told so in the chatbox.
  await page.evaluate(() => {
    engine.setMechanicsConfig({ ...engine.mechanicsConfig, infiniteHealth: true });
    engine.injectAction({ type: "manualCast", targetId: "leviathan", spellName: "Shadow Rush" });
  });
  await page.waitForFunction(() => document.body.innerText.includes("Your spell stuns the Leviathan!"), null, { timeout: 60000 });
  await page.waitForFunction(() => engine.getEncounterSnapshot().state.stunnedUntil === null, null, { timeout: 60000 });
  // To the first roar's rocks: one on the player's tile, which puts them a tile
  // off it, two that tell the first special. Each is drawn as the loc it leaves,
  // and none can be walked on.
  const rocks = await page.evaluate(() => {
    const stood = [...engine.player().position];
    for (let tick = 0; tick < 60 && engine.getEncounterSnapshot().state.rubble.length < 3; tick++) engine.advanceTick(engine.player().position);
    const encounter = engine.getEncounterSnapshot();
    const drawn = scene.sceneObjectController.update({ state: { encounter }, interpolatedTick: engine.worldState.tick });
    const { rubble } = encounter.state;
    return {
      rubble: rubble.length,
      drawn: drawn.map((object) => object.data.locId),
      tiles: drawn.every((object, n) => object.data.localX === rubble[n][0] && object.data.localY === rubble[n][1]),
      onStood: rubble.some(([x, y]) => x === stood[0] && y === stood[1]),
      pushed: Math.max(...engine.player().position.map((v, n) => Math.abs(v - stood[n]))) === 1,
      stood,
    };
  });
  const { stood } = rocks;
  delete rocks.stood;
  assert.deepEqual(rocks, { rubble: 3, drawn: [47590, 47590, 47590], tiles: true, onStood: true, pushed: true });
  // A step back onto the rock that fell on the player is refused.
  const blocked = await page.evaluate((stood) => {
    for (let tick = 0; tick < 3; tick++) engine.advanceTick(stood);
    return engine.player().position.join() !== stood.join();
  }, stood);
  assert.equal(blocked, true);

  // Enraged: the pathfinder comes 3 ticks later, in the north-west corner (or the next clockwise one clear of rocks).
  const pathfinder = await page.evaluate(() => {
    engine.setBossHp(170);
    for (let tick = 0; tick < 6; tick++) engine.advanceTick(engine.player().position);
    return { enraged: engine.getEncounterSnapshot().state.enraged, there: engine.worldState.getNpc("abyssal-pathfinder") !== undefined };
  });
  assert.deepEqual(pathfinder, { enraged: true, there: true });

  // Killed; the application's own loop plays its death and ends the fight,
  // with the rocks and the pathfinder gone.
  await page.evaluate(() => engine.setBossHp(0));
  await page.waitForFunction(() => engine.getEncounterOutcome().phase === "victory" && document.body.innerText.includes("THE LEVIATHAN DEFEATED"), null, { timeout: 120000 });
  const cleared = await page.evaluate(() => ({ rubble: engine.getEncounterSnapshot().state.rubble.length, pathfinder: engine.worldState.getNpc("abyssal-pathfinder") ?? null }));
  assert.deepEqual(cleared, { rubble: 0, pathfinder: null });
  assert.deepEqual(errors, []);
  console.log("The Leviathan loaded on /leviathan/, was drawn with its tails and rocks, was stunned, enraged with its pathfinder and was won");
} finally {
  await browser.close();
}
