// An NPC's health bar shows its hitpoints after a hit, live as in a replay.
// The bar's fill is taken once per hit and kept (rendering.js,
// shownHealthRatio). Live, the scene's frame takes the engine's events of a
// tick while the application's state can still be the tick's before: when the
// game loop's frame callback ran before the scene's, the bar kept the
// hitpoints from before the hit (a minion's full bar after it was hit; a
// boss's chunk of hitpoints left after the kill). Here the game loop's frame
// callback runs first in every frame, the tick's before the scene's, and the
// player hits the Mirrorback of an egg nobody hit with the elder maul (as
// the player who found it did), given ten times its hitpoints so that it
// lasts: each hit moves its bar.
import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { browserOptions } from "../tools/browser.mjs";

const origin = process.env.TEST_ORIGIN;
const browser = await chromium.launch(browserOptions);

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 850 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.stack));
  const marker = "this.encounter = options.encounter;";
  await page.route("**/engine/SimulationEngine.js*", async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    assert.ok(body.includes(marker));
    await route.fulfill({ response, body: body.replace(marker, marker + "if (options.encounter.kind === 'araxxor') window.engine = this;") });
  });
  // Each frame, the callbacks the game loop asked for (from Grid.js, through
  // the scheduler of rendering.js) run before the others, the scene's. The
  // order is otherwise that of the requests, which a pause can turn round.
  await page.addInitScript(() => {
    const request = window.requestAnimationFrame.bind(window);
    let queue = [], next = 0, asked = false;
    window.requestAnimationFrame = (callback) => {
      const id = ++next;
      queue.push({ id, callback, loop: /\/assets\/Grid\.js/.test(new Error().stack) });
      if (!asked) {
        asked = true;
        request((time) => {
          asked = false;
          const frame = [...queue.filter(({ loop }) => loop), ...queue.filter(({ loop }) => !loop)];
          queue = [];
          for (const { callback: run } of frame) run(time);
        });
      }
      return id;
    };
    window.cancelAnimationFrame = (id) => {
      queue = queue.filter((queued) => queued.id !== id);
    };
  });

  await page.goto(origin + "/araxxor/");
  await page.locator(".loading-screen").waitFor({ state: "hidden", timeout: 120000 });
  await page.waitForFunction(() => window.engine && engine.currentTick >= 2, null, { timeout: 60000 });
  // White eggs first: a Mirrorback hatches from the first, which nobody hits.
  const target = "araxyte-0";
  await page.evaluate(() => {
    engine.setMechanicsConfig({ ...engine.mechanicsConfig, infiniteHealth: true });
    engine.encounter.configureRunStart({ araxxorEggs: "white" });
  });
  await page.waitForFunction((id) => engine.worldState.getNpc(id)?.alive, target, { timeout: 120000 });
  await page.evaluate((target) => {
    const npc = engine.worldState.getNpc(target);
    npc.vitals.maxHp = npc.vitals.hp = 10 * npc.vitals.maxHp;
    engine.queueEquipFromInventory(0, 21003, "weapon"); // the elder maul
    engine.queueAttackTarget(target);
  }, target);

  // At the end of each tick (its last frame), the bar drawn against the Mirrorback's
  // hitpoints: the thirtieths the game shows, 1 + floor(29 * hp / max).
  const ticks = await page.evaluate((target) => new Promise((done) => {
    const out = [];
    let tick = engine.currentTick, last = null, hits = 0;
    const width = 60; // a 2 x 2 NPC's bar
    const watch = () => {
      const npc = engine.worldState.getNpc(target);
      if (engine.currentTick !== tick) {
        if (last) out.push(last);
        hits += engine.getLastTickEvents().filter((event) => event.type === "hitsplat_spawned" && event.targetId === target).length;
        tick = engine.currentTick;
      }
      const bar = [...document.querySelectorAll("[data-healthbars] > div")].find((element) => element.style.width === width + "px");
      last = bar && {
        tick,
        drawn: Math.round((parseInt(bar.querySelector('[data-role="fg-clip"]').style.width) * 30) / width),
        shown: Math.min(30, 1 + Math.floor((29 * npc.vitals.hp) / npc.vitals.maxHp)),
      };
      if (hits < 4) requestAnimationFrame(watch);
      else done(out);
    };
    watch();
  }), target);
  assert.ok(ticks.length > 12, `${ticks.length} ticks with the bar`);
  assert.deepEqual(ticks.filter(({ drawn, shown }) => drawn !== shown), []);
  assert.deepEqual(errors, []);
  console.log(`the Mirrorback's bar showed its hitpoints at the end of ${ticks.length} ticks of hits`);
} finally {
  await browser.close();
}
