// Nex loads on her route and is drawn from the trimmed cache (her chamber,
// her two types, her mages, her reavers, the stalagmites' stand-in and the
// teammates); the team fights beside the player; her shadows, icicles and
// stalagmites are drawn as the map objects they are; she dies into the victory screen. The
// mechanics themselves are digested by the determinism harness
// (tools/determinism/scenarios/nex.mjs) and asserted by
// test/test-nex-rules.mjs.
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
    ["**/engine/SimulationEngine.js*", "this.encounter = options.encounter;", "if (options.encounter.kind === 'nex') window.engine = this;"],
    ["**/encounters/shared/buildScene.js*", "const scene = new Scene();", "window.scene = scene;"],
  ]) {
    await page.route(path, async (route) => {
      const response = await route.fetch();
      const body = await response.text();
      assert.ok(body.includes(marker));
      await route.fulfill({ response, body: body.replace(marker, marker + probe) });
    });
  }

  await page.goto(origin + "/nex/");
  await page.waitForFunction(() => window.engine && window.scene, null, { timeout: 60000 });
  await page.locator(".loading-screen").waitFor({ state: "hidden", timeout: 60000 });
  assert.equal(new URL(page.url()).pathname, "/nex/");

  // The player starts in the first of her setups (loadouts.js, the wiki's strategies page): the Zaryte crossbow in
  // Masori (f), Osmumten's fang for a prison, a full inventory; west of her, with three teammates around her.
  const setup = await page.evaluate(() => {
    const { equipment, inventory, position } = engine.player();
    const mates = engine.worldState.getNpcs().filter((npc) => npc.id.startsWith("nex-mate")).length;
    return { weapon: equipment.weapon, head: equipment.head, items: inventory.filter(Boolean).length, fang: inventory[0]?.id, position, mates };
  });
  assert.deepEqual(setup, { weapon: 26374, head: 27235, items: 28, fang: 26219, position: [42, 19], mates: 3 });

  // Every NPC type the fight draws is loaded.
  const types = [11278, 11279, 11283, 11284, 11285, 11286, 11294, 14153, 8636];
  await page.waitForFunction((types) => types.every((id) => scene.isNpcTypeLoaded(id)), types, { timeout: 60000 });

  // Her shadows and her containment's icicles: drawn as their map objects, on their tiles, from the snapshot.
  const drawn = await page.evaluate(() => {
    engine.setMechanicsConfig({ ...engine.mechanicsConfig, infiniteHealth: true });
    const encounter = engine.encounter;
    const context = () => ({ tick: engine.worldState.tick, world: engine.worldState, tickEvents: engine.tickEvents, despawnNpc: () => {}, spawnNpc: () => {} });
    const advance = (n) => { for (let i = 0; i < n; i++) engine.advanceTick(engine.player().position); };
    const draw = () => scene.sceneObjectController.update({ state: { encounter: engine.getEncounterSnapshot(), tick: engine.worldState.tick }, interpolatedTick: engine.worldState.tick })
      .map(({ data }) => [data.locId, data.localX, data.localY]);
    advance(24); // her intro, into her smoke phase
    encounter.untilSpecial = 1000; // no special of her own meanwhile
    encounter.specials.smash(context());
    advance(1);
    const shadows = draw().filter(([locId]) => locId === 42942).length;
    const party = encounter.party.living(engine.worldState).length;
    advance(4);
    const spent = draw().filter(([locId]) => locId === 29733).length;
    encounter.specials.startContainment(context(), encounter.boss());
    advance(5);
    const icicles = draw().filter(([locId]) => locId === 26209).length;
    const ring = draw().filter(([locId]) => locId === 42943).length;
    return { shadows, party, spent, icicles, ring };
  });
  assert.ok(drawn.shadows >= 1 && drawn.shadows <= drawn.party, JSON.stringify(drawn));
  assert.equal(drawn.spent, drawn.shadows, JSON.stringify(drawn));
  assert.equal(drawn.icicles, 9, "her containment: icicles on her 9 tiles (" + JSON.stringify(drawn) + ")");
  assert.equal(drawn.ring, 16, "her containment: and on the 16 about her (" + JSON.stringify(drawn) + ")");

  // The teammates fight: her hitpoints fall without the player's help, with the application's own loop.
  const before = await page.evaluate(() => engine.worldState.getNpc("nex").vitals.hp);
  await page.waitForFunction((before) => engine.worldState.getNpc("nex").vitals.hp < before, before, { timeout: 60000 });

  // Her death; the application's own loop plays it and ends the fight.
  await page.evaluate(() => engine.setBossHp(0));
  await page.waitForFunction(() => engine.getEncounterOutcome().phase === "victory" && document.body.innerText.includes("NEX DEFEATED"), null, { timeout: 120000 });
  assert.deepEqual(errors, []);
  console.log("Nex: route, drawing, teammates and victory");
} finally {
  await browser.close();
}
