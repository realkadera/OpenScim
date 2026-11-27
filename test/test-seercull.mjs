// The Seercull and its special attack, Soulshot: a bow that fires arrows up to
// amethyst; the special is certain to hit, takes its maximum from the visible
// Ranged level and the arrow alone, costs all the energy, and takes its damage
// off the target's Magic, once.
import assert from "node:assert/strict";
import { register } from "node:module";
import { chromium } from "playwright-core";

// The client's import graph reaches a stylesheet; the harness's hooks make it an empty module.
register("../tools/determinism/node-hooks.mjs", import.meta.url);
globalThis.self ??= globalThis; // as the harness: PicoGL reads `self` when it loads
globalThis.location ??= { pathname: "/" };
const { selectPlayerAttackProfile } = await import("../client/engine/playerAttack/profiles.js");
const { getSpecialAttackDefinition } = await import("../client/data/specialAttackDefinitions.js");
const { getWeaponCategory } = await import("../client/data/weaponCategories.js");
const { isAmmoCompatibleWithWeapon, weaponRequiresAmmo, getAmmoRefusalMessage } = await import("../client/engine/ammunition.js");

const SEERCULL = 6724;
const TWISTED_BOW = 20997;
const arrows = { rune: 892, amethyst: 21326, dragon: 11212, seekingDragon: 33595 };

// A bow that needs arrows, and takes none above amethyst (WIKI).
assert.equal(getWeaponCategory(SEERCULL), "bow");
assert.ok(weaponRequiresAmmo(SEERCULL));
assert.ok(isAmmoCompatibleWithWeapon(SEERCULL, arrows.rune));
assert.ok(isAmmoCompatibleWithWeapon(SEERCULL, arrows.amethyst));
assert.ok(!isAmmoCompatibleWithWeapon(SEERCULL, arrows.dragon));
assert.ok(!isAmmoCompatibleWithWeapon(SEERCULL, arrows.seekingDragon));
assert.ok(isAmmoCompatibleWithWeapon(TWISTED_BOW, arrows.dragon)); // the other bows as before
// Arrows above the bow's are refused in words; nothing else is.
const tooStrong = "Your bow isn't powerful enough for those arrows.";
assert.equal(getAmmoRefusalMessage(SEERCULL, arrows.dragon), tooStrong);
assert.equal(getAmmoRefusalMessage(SEERCULL, arrows.seekingDragon), tooStrong);
assert.equal(getAmmoRefusalMessage(SEERCULL, arrows.amethyst), null);
assert.equal(getAmmoRefusalMessage(SEERCULL, undefined), null);
assert.equal(getAmmoRefusalMessage(TWISTED_BOW, arrows.dragon), null);

// The special: all the energy, and the damage off the Magic, only while that is undrained.
assert.deepEqual(getSpecialAttackDefinition(SEERCULL), {
  energyCost: 100,
  animationId: 426,
  postHitEffects: [{ effect: "drain_magic", base: 0, percentOfDamage: 100, onlyIfUndrained: true }],
});

// WIKI: Maximum Hit = floor(0.5 + (Visible Ranged Level + 10) * (Ammo Ranged Strength + 64) / 640).
const soulshot = (playerRangedLevel, ammoRangedStrength, extra = {}) =>
  selectPlayerAttackProfile({
    weaponId: SEERCULL,
    formulaStyle: "ranged",
    isSpecialAttack: true,
    resources: { kind: "ammo", ammoId: arrows.amethyst },
    playerRangedLevel,
    ammoRangedStrength,
    targetAttributes: [],
    ...extra,
  });
assert.deepEqual(soulshot(99, 55), {
  kind: "singleHit",
  maxHit: { kind: "fixed", maxHit: 20 }, // 0.5 + 109 * 119 / 640 = 20.77
  hit: { accuracy: { kind: "guaranteed" }, damage: { kind: "uniformToMaxHit" } },
});
assert.equal(soulshot(112, 55).maxHit.maxHit, 23); // 0.5 + 122 * 119 / 640 = 23.18
assert.equal(soulshot(112, 49).maxHit.maxHit, 22); // rune arrows: 0.5 + 122 * 113 / 640 = 22.04
assert.equal(soulshot(50, 7).maxHit.maxHit, 7); // bronze arrows at the level to wield it: 0.5 + 60 * 71 / 640 = 7.16
// Nothing else raises it: an imbued Slayer helmet puts no stage on the maximum.
assert.deepEqual(soulshot(99, 55, { headId: 11865 }).maxHit, { kind: "fixed", maxHit: 20 });
// An ordinary shot of the Seercull is the formula's.
assert.equal(selectPlayerAttackProfile({ weaponId: SEERCULL, formulaStyle: "ranged", resources: { kind: "ammo", ammoId: arrows.amethyst }, targetAttributes: [] }).maxHit.kind, "base");

// In the fight, against Zebak (Magic 100).
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe",
  args: ["--enable-unsafe-swiftshader"],
});
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/engine/SimulationEngine.js*", async (route) => {
    const response = await route.fetch();
    const marker = "this.encounter = options.encounter;";
    const body = await response.text();
    assert.ok(body.includes(marker));
    await route.fulfill({ response, body: body.replace(marker, marker + "window.engine = this;") });
  });
  await page.goto(process.env.TEST_ORIGIN + "/zebak/");
  await page.waitForFunction(() => window.engine, null, { timeout: 60000 });
  await page.locator(".loading-screen").waitFor({ state: "hidden", timeout: 120000 });
  const result = await page.evaluate(([amethystArrow, dragonArrow]) => {
    const player = engine.player();
    const zebak = engine.worldState.getNpcs().find((npc) => npc.role === "boss");
    engine.setMechanicsConfig({ ...engine.mechanicsConfig, infiniteHealth: true, infiniteSpecialAttack: false });
    player.inventory[0] = { id: 6724 };
    player.inventory[1] = { id: amethystArrow, quantity: 100 };
    engine.queueEquipFromInventory(0, 6724, "weapon");
    engine.queueEquipAmmoFromInventory(1, amethystArrow);
    engine.advanceTick(player.position);
    const hits = [];
    const messages = [];
    const emit = engine.tickEvents.emit.bind(engine.tickEvents);
    engine.tickEvents.emit = (event) => {
      if (event.type === "hitsplat_spawned" && event.targetId === zebak.id) hits.push(event.amount);
      if (event.type === "game_message") messages.push(event.segments.map((segment) => segment.text).join(""));
      return emit(event);
    };
    // A special with full energy, then ticks until its arrow lands: the first hitsplat on Zebak is the Soulshot's.
    const fire = () => {
      const before = hits.length;
      player.specialAttack.energy = 100;
      engine.queueSpecialAttackToggle();
      engine.queueAttackTarget(zebak.id);
      for (let tick = 0; tick < 12 && hits.length === before; tick++) engine.advanceTick(player.position);
      return { hit: hits[before], energy: player.specialAttack.energy, armed: player.isSpecialAttackActive, magicDrain: zebak.debuffs?.magicDrain ?? 0 };
    };
    // A Soulshot may roll 0 and drain nothing: fire until one does damage.
    let first;
    for (let attempt = 0; attempt < 20 && !(first?.hit > 0); attempt++) first = fire();
    const second = [fire(), fire(), fire()];
    const range = engine.getPlayerAttackRange();
    // Dragon arrows: no shot, the game's words once, and the attack given up. The arrows in flight land first.
    engine.queueAttackTarget(null);
    for (let tick = 0; tick < 6; tick++) engine.advanceTick(player.position);
    player.inventory[2] = { id: dragonArrow, quantity: 100 };
    engine.queueEquipAmmoFromInventory(2, dragonArrow);
    engine.advanceTick(player.position);
    const hitsBefore = hits.length;
    messages.length = 0;
    engine.queueAttackTarget(zebak.id);
    for (let tick = 0; tick < 8; tick++) engine.advanceTick(player.position);
    const refused = { ammo: player.combatSupplies.equippedAmmo?.id, shots: hits.length - hitsBefore, messages: [...messages], target: player.attackTarget };
    return { weapon: player.equipment.weapon, ranged: player.stats.ranged.current, range, magic: zebak.formulaStats.levels.magic, first, second, refused };
  }, [arrows.amethyst, arrows.dragon]);

  assert.equal(result.weapon, SEERCULL);
  assert.equal(result.range, 8); // WIKI: 8 tiles on Accurate and Rapid
  // The first Soulshot that does damage: within its maximum, all the energy spent, and that much off the Magic.
  const maxHit = Math.floor((320 + (result.ranged + 10) * (55 + 64)) / 640);
  assert.ok(result.first.hit > 0 && result.first.hit <= maxHit, JSON.stringify(result));
  assert.equal(result.first.energy, 0);
  assert.equal(result.first.armed, false);
  assert.equal(result.first.magicDrain, result.first.hit);
  assert.ok(result.first.magicDrain < result.magic);
  // The next ones hit as well and take nothing more off it (WIKI: "only ... if it is not already reduced").
  for (const later of result.second) {
    assert.ok(later.hit <= maxHit, JSON.stringify(result));
    assert.equal(later.energy, 0);
    assert.equal(later.magicDrain, result.first.magicDrain);
  }
  assert.deepEqual(result.refused, { ammo: arrows.dragon, shots: 0, messages: [tooStrong], target: null });
  assert.deepEqual(errors, []);
  console.log("seercull: ok", JSON.stringify({ first: result.first, later: result.second.map((later) => later.hit) }));
} finally {
  await browser.close();
}
