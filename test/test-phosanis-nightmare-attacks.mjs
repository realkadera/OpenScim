// Phosani's Nightmare's attacks in the browser, as the application's own loop plays them: her magic and ranged
// projectiles (1764, 1766) are drawn in flight above the dream's floor (plane 3, 1,240 over plane 0), and her attacks
// are heard (phosanis-nightmare/audio.js). The player stands where he starts, with infinite health, and does nothing.
import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { browserOptions } from "../tools/browser.mjs";

const origin = process.env.TEST_ORIGIN;
const browser = await chromium.launch({ ...browserOptions, args: [...browserOptions.args, "--autoplay-policy=no-user-gesture-required"] });

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 850 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.stack));
  // Every sound started, by its id.
  await page.addInitScript(() => {
    window.soundIds = new WeakMap();
    window.playedSounds = [];
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args) {
      playedSounds.push(soundIds.get(this.buffer));
      return start.apply(this, args);
    };
  });
  for (const [path, marker, probe] of [
    ["**/application.js*", "this.bufferCache.set(h2, h8);", "soundIds.set(h8,h2);"],
    ["**/engine/SimulationEngine.js*", "this.encounter = options.encounter;", "if (options.encounter.kind === 'phosanis_nightmare') window.engine = this;"],
    ["**/encounters/shared/buildScene.js*", "const scene = new Scene();", "(window.scenes ??= []).push(scene);"],
  ]) {
    await page.route(path, async (route) => {
      const response = await route.fetch();
      const body = await response.text();
      assert.ok(body.includes(marker), path);
      await route.fulfill({ response, body: body.replace(marker, marker + probe) });
    });
  }

  await page.goto(origin + "/phosanis-nightmare/");
  await page.waitForFunction(() => window.engine && window.scenes, null, { timeout: 60000 });
  await page.locator(".loading-screen").waitFor({ state: "hidden", timeout: 60000 });
  await page.waitForFunction(() => (window.scene = window.scenes.find((each) => each.isTerrainLoaded() && each.spotAnimRenderer?.boundLoader)), null, { timeout: 120000 });
  // A click lets the page's audio start, as a player's would.
  await page.mouse.click(640, 700);
  await page.evaluate(() => {
    engine.setMechanicsConfig({ ...engine.mechanicsConfig, infiniteHealth: true });
    // The projectiles in flight, sampled every frame.
    window.flying = new Set();
    // The lowest any of them flew, over the floor under it (in tiles; the scene's terrain is plane 3's).
    window.lowest = Infinity;
    const floor = (x, y) => -(scene.terrainHeights?.[Math.floor(x)]?.[Math.floor(y)] ?? 0) / 128;
    const sample = () => {
      // An encounter's projectiles fly in its visuals' flights (rendering.js, NpcProjectileFlights).
      for (const flight of scene.visuals?.flights?.flights?.values() ?? []) {
        flying.add(flight.cue?.spotAnimId);
        const at = flight.runtime?.motion?.position;
        if (at && flight.runtime.cycle >= flight.runtime.config.startCycle) lowest = Math.min(lowest, at.z - floor(at.x, at.y));
      }
      window.sceneKind ??= scene.constructor.name + " visuals:" + (scene.visuals?.constructor.name ?? "none");
      requestAnimationFrame(sample);
    };
    sample();
  });

  // Her first attacks come from tick 29; by tick 60 she has made several, magic and ranged among them.
  await page.waitForFunction(() => engine.worldState.tick >= 60, null, { timeout: 120000 });
  const seen = await page.evaluate(() => ({ flying: [...flying], sounds: [...new Set(playedSounds)], sceneKind, lowest, floor: -scene.terrainHeights[33][24] / 128 }));

  assert.ok(seen.flying.includes(1764) || seen.flying.includes(1766), "her projectiles in flight: " + JSON.stringify(seen.flying));
  // Above the floor the whole way (it is 9.7 tiles up; flown from plane 0's surface they were 9 tiles under it).
  assert.ok(seen.floor > 9, "the dream's floor: " + seen.floor);
  assert.ok(seen.lowest > 0 && seen.lowest < 2, "her projectiles over the floor by " + seen.lowest);
  // Her magic attack's run (4334, 4239, ...) or her ranged one's (4221, 4251, ...).
  assert.ok([4334, 4239, 4221, 4251].some((id) => seen.sounds.includes(id)), "her attacks heard: " + JSON.stringify(seen.sounds));
  assert.deepEqual(errors, []);
  console.log("Phosani's Nightmare: her projectiles drawn and her attacks heard");
} finally {
  await browser.close();
}
