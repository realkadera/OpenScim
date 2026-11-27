// Phosani's Nightmare loads on its route and is drawn from the trimmed cache
// (the dream's map square on plane 3, each of her forms, the totems); her
// spores and flowers are drawn as the map objects they are; a new form is
// drawn as its own NPC type; she dies into the victory screen. The mechanics
// themselves are digested by the determinism harness
// (tools/determinism/scenarios/phosanis-nightmare.mjs) and asserted by
// test/test-phosanis-nightmare-rules.mjs.
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
    ["**/engine/SimulationEngine.js*", "this.encounter = options.encounter;", "if (options.encounter.kind === 'phosanis_nightmare') window.engine = this;"],
    ["**/encounters/shared/buildScene.js*", "const scene = new Scene();", "window.scene = scene;"],
  ]) {
    await page.route(path, async (route) => {
      const response = await route.fetch();
      const body = await response.text();
      assert.ok(body.includes(marker));
      await route.fulfill({ response, body: body.replace(marker, marker + probe) });
    });
  }

  await page.goto(origin + "/phosanis-nightmare/");
  await page.waitForFunction(() => window.engine && window.scene, null, { timeout: 60000 });
  await page.locator(".loading-screen").waitFor({ state: "hidden", timeout: 60000 });
  assert.equal(new URL(page.url()).pathname, "/phosanis-nightmare/");

  // The player starts in the first of her setups (loadouts.js, the wiki's strategies page): Inquisitor's mace and
  // armour, Tumeken's shadow for the totems, a full inventory.
  const setup = await page.evaluate(() => {
    const { equipment, inventory, position } = engine.player();
    return { weapon: equipment.weapon, head: equipment.head, items: inventory.filter(Boolean).length, shadow: inventory[0]?.id, position };
  });
  assert.deepEqual(setup, { weapon: 24417, head: 24419, items: 28, shadow: 27275, position: [33, 28] });

  // Every form she takes and the totems are loaded; she stands on plane 3, 1,240 over plane 0.
  const types = [9416, 9417, 9418, 11153, 9419, 9420, 9421, 11155, 9422, 11154, 9434, 9435, 9436];
  await page.waitForFunction((types) => types.every((id) => scene.isNpcTypeLoaded(id)), types, { timeout: 60000 });
  assert.equal(await page.evaluate(() => scene.terrainHeights[32][31]), -1240);

  // Her spores and flowers: drawn as their map objects, on their tiles, from the encounter's snapshot.
  const drawn = await page.evaluate(() => {
    engine.setMechanicsConfig({ ...engine.mechanicsConfig, infiniteHealth: true });
    const encounter = engine.encounter;
    const context = () => ({ tick: engine.worldState.tick, world: engine.worldState, tickEvents: engine.tickEvents });
    const advance = (n) => { for (let i = 0; i < n; i++) engine.advanceTick(engine.player().position); };
    const draw = () => scene.sceneObjectController.update({ state: { encounter: engine.getEncounterSnapshot(), tick: engine.worldState.tick }, interpolatedTick: engine.worldState.tick })
      .map(({ data }) => [data.locId, data.localX, data.localY]);
    encounter.untilSpecial = 1000; // no special of her own meanwhile
    encounter.specials.startSpores(context());
    advance(6);
    // Armed: each spore drawn on its tile (one set off by the player is drawn bursting for 2 ticks).
    const armed = draw().filter(([locId]) => locId === 37739).map(([, x, y]) => x + "," + y);
    const tiles = encounter.getSnapshot().state.spores?.tiles ?? [];
    const spores = tiles.filter(([x, y]) => armed.includes(x + "," + y)).length;
    const sporeTiles = tiles.length;
    encounter.specials.interrupt();
    encounter.specials.startFlowers(context());
    advance(15);
    const flowers = draw().filter(([locId]) => locId >= 37740 && locId <= 37745);
    return { spores, sporeTiles, flowers: flowers.length, open: flowers.every(([locId]) => locId === 37742 || locId === 37745) };
  });
  assert.ok(drawn.sporeTiles >= 10 && drawn.spores === drawn.sporeTiles, JSON.stringify(drawn));
  assert.ok(drawn.flowers > 30 && drawn.open, JSON.stringify(drawn));

  // Her second form (the boss hitpoints preset): drawn as its own type once the scene has caught up.
  const second = await page.evaluate(() => {
    engine.applyBossHpPreset(2134);
    engine.advanceTick(engine.player().position);
    return engine.worldState.getNpc("phosanis-nightmare").npcTypeId;
  });
  assert.equal(second, (await page.evaluate(() => engine.getEncounterSnapshot().state.forms))[1]);
  await page.waitForFunction(
    (type) => [...scene.npcInstanceManager.instanceRegistry.values()].some((instance) => instance.npcTypeId === type),
    second,
    { timeout: 30000 },
  );

  // Cursed, the icon over the player is that of the style his protection stops now (the Outside recordings): Protect
  // from Magic shows the missiles icon; the curse gone, the magic one again.
  const overhead = (name) => page.waitForFunction((name) => [...document.querySelectorAll("img")].some((img) => img.getAttribute("src")?.endsWith("/overhead_" + name + ".png")), name, { timeout: 15000 });
  await page.evaluate(() => {
    engine.encounter.specials.curse = { turns: 5, endsAt: null };
    engine.player().activePrayer = "ProtectMagic";
  });
  await overhead("missiles");
  await page.evaluate(() => {
    engine.encounter.specials.curse = null;
    engine.player().activePrayer = "ProtectMagic";
  });
  await overhead("magic");

  // Her desperation, then her death; the application's own loop plays it and ends the fight.
  await page.evaluate(() => {
    engine.applyBossHpPreset(150);
    engine.advanceTick(engine.player().position);
  });
  assert.equal(await page.evaluate(() => engine.worldState.getNpc("phosanis-nightmare").npcTypeId), 11154);
  await page.evaluate(() => engine.setBossHp(0));
  await page.waitForFunction(() => engine.getEncounterOutcome().phase === "victory" && document.body.innerText.includes("PHOSANI'S NIGHTMARE DEFEATED"), null, { timeout: 120000 });
  assert.deepEqual(errors, []);
  console.log("Phosani's Nightmare: route, drawing and victory");
} finally {
  await browser.close();
}
