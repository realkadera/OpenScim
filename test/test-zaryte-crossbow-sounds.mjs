// Zaryte crossbow in the browser: an Evoke with ruby dragon bolts (e) is
// heard as the game plays it (5306, not the ordinary crossbow's 2695), its
// Blood Forfeit as ruby's 2911; the equipment picker counts the crossbow as
// checked, with only the bolt sounds nobody recorded left to say.
import assert from "node:assert/strict";
import {chromium} from "playwright-core";
import { browserOptions } from "../tools/browser.mjs";

const browser = await chromium.launch(browserOptions);
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => {
    window.soundIds = new WeakMap();
    window.playedSounds = [];
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function(...args) {
      playedSounds.push(soundIds.get(this.buffer));
      return start.apply(this, args);
    };
  });
  await page.route("**/application.js*", async route => {
    const response = await route.fetch();
    const body = await response.text();
    const soundMarker = "this.bufferCache.set(h2, h8);";
    const pickerMarker = "function Bce(h2) {";
    assert.ok(body.includes(soundMarker) && body.includes(pickerMarker));
    await route.fulfill({response, body: body
      .replace(soundMarker, soundMarker + "soundIds.set(h8,h2);")
      .replace(pickerMarker, "window.weaponGaps = describeWeaponVerificationGaps;" + pickerMarker)});
  });
  await page.route("**/engine/SimulationEngine.js*", async route => {
    const response = await route.fetch();
    const marker = "this.encounter = options.encounter;";
    const body = await response.text();
    assert.ok(body.includes(marker));
    await route.fulfill({response, body: body.replace(marker, marker + "window.engine=this;")});
  });
  await page.goto(process.env.TEST_ORIGIN + "/zebak/");
  await page.waitForFunction(() => window.engine?.objTypeLoader && engine.worldState.actors.has("zebak"));
  await page.locator(".loading-screen").waitFor({state: "hidden"});
  // The first click resumes the audio context. It is also a walk, taken on the next tick: let that tick pass, or the
  // walk would replace the attack queued below.
  await page.mouse.click(640, 425);
  const clickTick = await page.evaluate(() => engine.currentTick);
  await page.waitForFunction((tick) => engine.currentTick > tick + 1, clickTick);

  assert.deepEqual(await page.evaluate(() => weaponGaps(26374)),
    ["Opal, pearl, sapphire, emerald, dragonstone and onyx bolt effects have no sound yet."]);

  await page.evaluate(() => {
    const p = engine.player();
    engine.setMechanicsConfig({...engine.mechanicsConfig, infiniteHealth: true, infiniteSpecialAttack: true});
    p.inventory[0] = {id: 26374};
    engine.queueEquipFromInventory(0, 26374, "weapon");
    p.combatSupplies.equippedAmmo = {id: 21944}; // Ruby dragon bolts (e)
    engine.advanceTick(p.position);
    engine.teleportPlayer([23, 32], p.facing);
    engine.combatRandom = () => 0; // the shot lands: Evoke makes its bolt effect certain
    window.events = [];
    const emit = engine.tickEvents.emit.bind(engine.tickEvents);
    engine.tickEvents.emit = event => { events.push(event); return emit(event); };
    playedSounds.length = 0;
    engine.queueSpecialAttackToggle();
    engine.queueAttackTarget("zebak");
  });
  // The application's own loop ticks from here, and plays what the ticks bring.
  await page.waitForFunction(() => events.some(e => e.type === "npc_graphic_applied" && e.spotAnimId === 754), null, {timeout: 15000});
  await page.waitForFunction(() => playedSounds.includes(2911), null, {timeout: 5000});
  const result = await page.evaluate(() => ({
    weapon: engine.player().equipment.weapon,
    evoke: events.find(e => e.type === "attack_started" && e.usingSpecialAttack === true),
    sounds: playedSounds.slice(),
  }));
  assert.equal(result.weapon, 26374);
  assert.ok(result.evoke, "no Evoke started");
  assert.ok(result.sounds.includes(5306), JSON.stringify(result.sounds));
  assert.ok(!result.sounds.includes(2695), JSON.stringify(result.sounds));
  assert.ok(result.sounds.includes(2911), JSON.stringify(result.sounds));
  assert.deepEqual(errors, []);
  console.log("zaryte crossbow sounds: ok", result.sounds.join(" "));
} finally {
  await browser.close();
}
