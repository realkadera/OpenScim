import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { loadEnvironment } from "../tools/determinism/harness.mjs";
import { zulrahRotations } from "../client/encounters/zulrah/rotations.js";
import placements from "../client/encounters/zulrah/cloud-placements.json" with { type: "json" };
import { zulrahLoadouts } from "../client/encounters/zulrah/loadouts.js";
import { readCacheGroups } from "../tools/assets/cache-groups.mjs";

const environment = await loadEnvironment();
const { normalizeInventory, parseCombatSupplies } = await import("../client/engine/supplies.js");
const { getEquipmentDefinition } = await import("../client/data/equipment.js");
const { getConsumableDefinition } = await import("../client/engine/consumables.js");
const { getActiveSpell } = await import("../client/data/weaponCategories.js");
const { resolveAttackResources } = await import("../client/engine/attackResources.js");
const { buildSimulationEngine } = await import("../client/engine/createSimulationEngine.js");
await environment.prepareArena("zulrah");
const { getMonsterFormulaStats } = await import("../client/engine/monsterStats.js");
const { definition, zulrahNpcIds, snakelingNpc } = await import("../client/encounters/zulrah/encounter.js");
const presets = Object.fromEntries(
  Object.entries(zulrahLoadouts).map(([key, preset]) => [
    key,
    { ...preset, inventory: normalizeInventory(preset.inventory.map((id) => ({ id }))) },
  ])
);
const modelGroups = new Set(readCacheGroups()[7]);
function newEngine(rotation = 1, preset) {
  return buildSimulationEngine({
    encounterConfig: { kind: "zulrah", mechanics: { zulrahRotation: String(rotation), zulrahSnakelings: false, zulrahToxicClouds: true, infiniteHealth: true } },
    objTypeLoader: environment.objTypeLoader, enableIntro: false, combatSeed: 123,
    inventory: preset?.inventory ?? [], equipment: preset?.equipment ?? {}, attackStylePerCategory: {},
    combatSupplies: parseCombatSupplies(preset?.supplies ?? {}),
  }, { encounterSeed: 456 });
}

test("the initial green phase only spits four barrages; the returning green phase attacks five times before four barrages", () => {
  for (const rotation of [1, 2, 3, 4]) {
    const phases = zulrahRotations[rotation];
    assert.equal(phases[0].attacks, 0);
    assert.equal(phases[0].cloudVolleys.length, 4);
    const last = phases.at(-1);
    assert.equal(last.form, "serpentine");
    assert.equal(last.attacks, 5);
    assert.equal(last.cloudVolleys.length, 4);
    const engine = newEngine(rotation);
    const encounter = engine.encounter;
    assert.equal(encounter.buildPhaseActions(phases[0]).filter(a => a.kind === "attack").length, 0);
    assert.deepEqual(encounter.buildPhaseActions(last).map(a => a.kind), [...Array(5).fill("attack"), ...Array(4).fill("venom")]);
    // Tick the actual fight through its initial appearance and then jump to RESET.
    let openingAttacks = 0;
    let openingShots = 0;
    while (encounter.phaseIndex === 0) {
      engine.advanceTick(engine.player().position);
      const events = engine.getLastTickEvents();
      openingAttacks += events.filter(e => e.type === "zuk_attack" && e.sourceId === "zulrah").length;
      openingShots += events.filter(e => e.type === "inferno_visual").flatMap(e => e.animations ?? []).filter(a => a.clipId === "shoot").length;
    }
    assert.equal(openingAttacks, 0);
    assert.equal(openingShots, 4);
    encounter.transitionToPhase(engine.worldState.getNpc("zulrah"), phases.length - 1, { tick: engine.worldState.tick, world: engine.worldState, tickEvents: engine.tickEvents });
    let returningAttacks = 0;
    let returningShots = 0;
    while (encounter.phaseIndex === phases.length - 1) {
      engine.advanceTick(engine.player().position);
      const events = engine.getLastTickEvents();
      returningAttacks += events.filter(e => e.type === "zuk_attack" && e.sourceId === "zulrah").length;
      returningShots += events.filter(e => e.type === "inferno_visual").flatMap(e => e.animations ?? []).filter(a => a.clipId === "shoot").length;
    }
    assert.equal(returningAttacks, 5);
    assert.equal(returningShots, 9);
    assert.equal(encounter.phaseIndex, 1, "repeat after RESET must skip the opening-only phase");
  }
});

test("damage above 50 re-rolls to 45..50 per landed hit, including on the red and blue forms", () => {
  const engine = newEngine();
  const boss = engine.worldState.getNpc("zulrah");
  const rules = engine.encounter.getEngineRules();
  const results = new Set();
  for (const npcTypeId of [2042, 2043, 2044]) {
    boss.npcTypeId = npcTypeId;
    for (const damage of [0, 1, 45, 49, 50]) assert.equal(rules.playerDamageOnNpc(damage, { target: boss }), damage);
    for (let n = 0; n < 40; n++) {
      boss.vitals.hp = boss.vitals.maxHp = 1000;
      engine.combatSystem.applyHit(engine.worldState, engine.player(), boss, { rolledDamage: 100, accuracySucceeded: true, style: "range", attackKind: "range_arrow" }, engine.buildCombatContext());
      const dealt = 1000 - boss.vitals.hp;
      assert.ok(dealt >= 45 && dealt <= 50);
      results.add(dealt);
    }
  }
  assert.equal(results.size, 6, "it must re-roll, not clamp everything to 50");
  assert.equal(rules.playerDamageOnNpc(100, { target: { id: "snakeling_1" } }), 100);
});

test("a landed red slam stuns movement, clears running animation and then releases; other damage does not stun", () => {
  const engine = newEngine();
  const encounter = engine.encounter;
  const player = engine.player();
  engine.applyEnvironmentalDamage({ baseDamage: 25, attackType: "typeless", source: "Zulrah (Melee)" }, 0);
  const until = encounter.stunnedUntilTick;
  assert.ok(until > 0);
  const start = [...player.position];
  for (let tick = 1; tick < until; tick++) {
    engine.advanceTick([32, 68]);
    assert.deepEqual(player.position, start);
    assert.equal(player.isMoving, false);
    assert.equal(player.isRunning, false);
  }
  engine.advanceTick([32, 68]);
  assert.notDeepEqual(player.position, start);
  assert.equal(encounter.getSnapshot().state.playerStunned, false);
  const other = newEngine();
  other.applyEnvironmentalDamage({ baseDamage: 0, attackType: "typeless", source: "Zulrah (Melee)" }, 0);
  other.applyEnvironmentalDamage({ baseDamage: 4, attackType: "typeless", source: "Toxic cloud" }, 0);
  assert.equal(other.encounter.stunnedUntilTick, 0);

  const red = newEngine();
  red.executeEncounterCommand({ encounter: "zulrah", type: "next-phase" });
  for (let tick = 0; tick < 20 && !red.encounter.stunnedUntilTick; tick++) red.advanceTick(red.player().position);
  const slam = red.damageHistory.find(hit => hit.source === "Zulrah (Melee)");
  assert.ok(slam && slam.baseDamage >= 20 && slam.baseDamage <= 30, "a real tail slam must deal 20..30 and trigger the stun hook");
  assert.ok(red.encounter.stunnedUntilTick > red.worldState.tick);
});

test("clouds hurt every tick, once per tick even on overlapping footprints, without applying venom status", () => {
  const engine = newEngine();
  const encounter = engine.encounter;
  const [x, y] = engine.player().position;
  encounter.activeClouds = [{ x, y, expiresTick: 100 }, { x, y, expiresTick: 100 }];
  for (let tick = 1; tick <= 4; tick++) {
    const context = { tick, world: engine.worldState };
    const hits = encounter.resolveHazards(context, { zulrahToxicClouds: true });
    assert.equal(hits.length, 1);
    assert.equal(hits[0].applyPoison, undefined);
    engine.applyEnvironmentalDamage(hits[0], tick);
    assert.equal(engine.player().poisonState.poisonVarp, 0);
    assert.equal(encounter.resolveHazards(context, { zulrahToxicClouds: true }).length, 0);
  }
});

test("each rotation phase has an independently editable cloud entry with valid canonical coordinates", () => {
  assert.match(placements.placementStatus, /Provisional|Authoritative/);
  const canonicalCenters = new Set([
    "26,61", "29,61", "32,61",
    "23,62", "23,65", "23,68",
    "33,64", "33,67", "33,70"
  ]);
  // Verify Rotation 1 (Magma A) Phase 4 is a direct attack phase with no clouds,
  // and Phase 7 (South Green) is the cloud-spitting phase.
  assert.equal(placements.rotations["1"][3].volleys.length, 0, "R1 (Magma A) Phase 4 has no cloud volleys");
  assert.equal(placements.rotations["1"][6].volleys.length, 3, "R1 (Magma A) Phase 7 spits 3 cloud volleys");
  for (const [rotation, phases] of Object.entries(zulrahRotations)) {
    const entries = placements.rotations[rotation];
    assert.equal(entries.length, phases.length);
    entries.forEach((entry, index) => {
      assert.equal(entry.phase, index + 1);
      assert.equal(entry.form, phases[index].form);
      assert.deepEqual(entry.volleys, phases[index].cloudVolleys);
      for (const volley of entry.volleys) for (const tile of volley) {
        assert.equal(tile.length, 2);
        assert.ok(tile.every(Number.isInteger));
        assert.ok(
          canonicalCenters.has(`${tile[0]},${tile[1]}`),
          `Cloud tile [${tile}] must be one of the 9 canonical centers`,
        );
      }
    });
  }
  assert.notEqual(zulrahRotations[1][0], zulrahRotations[2][0]);
  assert.notEqual(zulrahRotations[1][0].cloudVolleys, zulrahRotations[2][0].cloudVolleys);
});

test("rotation 3 phase 3 interleaves cloud volleys and snakeling spawns before melee slam", () => {
  const engine = newEngine(3);
  const encounter = engine.encounter;
  encounter.snakelingsEnabled = true;
  const rot3Phase3 = zulrahRotations[3][2];
  assert.equal(rot3Phase3.interleaved, true);
  const actions = encounter.buildPhaseActions(rot3Phase3);
  assert.deepEqual(
    actions.map((a) => a.kind),
    ["venom", "snakeling", "venom", "snakeling", "venom", "snakeling", "melee", "melee"],
    "Rotation 3 Phase 3 must interleave 3 volleys with 3 snakeling spawns, concluding with melee slams"
  );
  // Verify 6-tick spacing between volleys gives player ample time to navigate around south bend
  assert.deepEqual(actions[0].volley, [[33, 70], [33, 67]]);
  assert.deepEqual(actions[2].volley, [[32, 61], [29, 61]]);
  assert.deepEqual(actions[4].volley, [[23, 65], [23, 62]]);
});

test("pillar safe spots [24, 64] and [32, 64] take no damage from canonical cloud roots", () => {
  const engine = newEngine(1);
  const encounter = engine.encounter;
  const player = engine.player();
  const context = { tick: 1, world: engine.worldState };

  // Set up active clouds from canonical roots
  // South bend: [26, 61], [29, 61], [32, 61]
  // West arm: [23, 62], [23, 65], [23, 68]
  // East arm: [33, 64], [33, 67], [33, 70]
  encounter.activeClouds = [
    { x: 23, y: 62, expiresTick: 100 },
    { x: 33, y: 67, expiresTick: 100 },
    { x: 33, y: 70, expiresTick: 100 },
    { x: 32, y: 61, expiresTick: 100 },
    { x: 29, y: 61, expiresTick: 100 },
  ];

  // West pillar safe tile [24, 64]
  player.position = [24, 64];
  let hits = encounter.resolveHazards(context, { zulrahToxicClouds: true });
  assert.equal(hits.length, 0, "West pillar [24, 64] should not be damaged by canonical [23, 62] cloud");

  // East pillar safe tile [32, 64]
  player.position = [32, 64];
  hits = encounter.resolveHazards(context, { zulrahToxicClouds: true });
  assert.equal(hits.length, 0, "East pillar [32, 64] should not be damaged by canonical East / South clouds");

  // East tip safe tile [32, 70] during opener phase
  player.position = [32, 70];
  encounter.activeClouds = [
    { x: 29, y: 61, expiresTick: 100 },
    { x: 32, y: 61, expiresTick: 100 },
    { x: 26, y: 61, expiresTick: 100 },
    { x: 23, y: 62, expiresTick: 100 },
    { x: 33, y: 64, expiresTick: 100 },
    { x: 33, y: 67, expiresTick: 100 },
    { x: 23, y: 68, expiresTick: 100 },
    { x: 23, y: 65, expiresTick: 100 },
  ];
  hits = encounter.resolveHazards(context, { zulrahToxicClouds: true });
  assert.equal(hits.length, 0, "East tip [32, 70] (Stand tile) must be completely clear of all 4 opener cloud volleys");
});

test("tanzanite form uses 85% magic and 15% ranged distribution (OBS: 45/53 attacks)", () => {
  const engine = newEngine(1);
  const encounter = engine.encounter;
  const tanzPhase = { form: "tanzanite", spot: "CENTER", pattern: "mage", attacks: 10 };
  let magicCount = 0;
  let rangedCount = 0;
  const trials = 1000;
  for (let i = 0; i < trials; i++) {
    // In mage pattern, random() < 0.85 rolls Magic
    const isMagic = encounter.random() < 0.85;
    if (isMagic) magicCount++;
    else rangedCount++;
  }
  const magicPct = magicCount / trials;
  assert.ok(magicPct >= 0.80 && magicPct <= 0.90, `Magic percentage ${magicPct} should be ~0.85`);
});

test("standing behind west or east pillar protects against magma melee slam", () => {
  const engine = newEngine(1);
  const encounter = engine.encounter;
  const player = engine.player();
  const boss = engine.worldState.getNpc("zulrah");

  // Middle spot with Magma form
  encounter.rotation = 1;
  encounter.phaseIndex = 1; // Magma phase at CENTER
  encounter.pendingMeleeTarget = [24, 64];
  encounter.meleeWindupEndTick = 10;

  // Test West Pillar safe tile [24, 62]
  player.position = [24, 62];
  let res = encounter.tickBoss(boss, { tick: 10, world: engine.worldState, random: encounter.random });
  assert.equal(res.environmentalDamages.length, 0, "West pillar tile [24, 62] should take 0 damage");

  // Test East Pillar safe tile [32, 64]
  encounter.pendingMeleeTarget = [32, 64];
  encounter.meleeWindupEndTick = 20;
  player.position = [32, 64];
  res = encounter.tickBoss(boss, { tick: 20, world: engine.worldState, random: encounter.random });
  assert.equal(res.environmentalDamages.length, 0, "East pillar tile [32, 64] should take 0 damage");

  // Test vulnerable tile in slam area [27, 62]
  encounter.pendingMeleeTarget = [27, 62];
  encounter.meleeWindupEndTick = 30;
  player.position = [27, 62];
  res = encounter.tickBoss(boss, { tick: 30, world: engine.worldState, random: encounter.random });
  assert.equal(res.environmentalDamages.length, 1, "Vulnerable tile in slam area should take damage");
  assert.ok(res.environmentalDamages[0].baseDamage >= 20 && res.environmentalDamages[0].baseDamage <= 30);
});

test("snakelings path toward the player when moveNpc is invoked and attack at proper range", () => {
  const engine = newEngine(1);
  const encounter = definition.factory();
  const player = engine.player();
  player.position = [28, 60];
  const world = {
    ...engine.worldState,
    getPlayer: () => player,
    getNpcs: () => [],
    actors: new Map([["player", player]]),
    occupancy: engine.worldState.occupancy,
  };
  const emittedEvents = [];
  const context = { tick: 1, world, random: () => 0.5, tickEvents: { emit: (e) => emittedEvents.push(e) } };

  // Create a melee snakeling at distance
  const snakeling = snakelingNpc.createActor({
    id: "test_snakeling",
    kind: "npc",
    role: "minion",
    npcTypeId: zulrahNpcIds.snakelingMelee,
    position: [26, 60],
    previousPosition: [26, 60],
    size: 1,
    alive: true,
    spawnTick: 1,
    lifetimeTicks: 42,
    vitals: { hp: 1, maxHp: 1 },
    formulaStats: structuredClone(getMonsterFormulaStats(zulrahNpcIds.snakelingMelee)),
    combat: { attackRange: 1, attackSpeed: 4, nextActionTick: 1, targetId: "player", lastAttackTick: null },
  }, {});

  // moveNpc should produce path steps toward player
  const moves = encounter.moveNpc(snakeling, context);
  assert.ok(Array.isArray(moves));
  assert.equal(moves.length, 1);
  assert.equal(moves[0].npcId, "test_snakeling");

  // When melee snakeling is not adjacent (distance > 1), tick should return idle without attack
  const tickResult = encounter.definitions.tick(snakeling, context);
  assert.equal(tickResult.npcAttacks, undefined);

  // When adjacent (distance <= 1), melee attack is rolled
  snakeling.position = [28, 61];
  const adjResult = encounter.definitions.tick(snakeling, context);
  assert.equal(adjResult.npcAttacks?.length, 1);
  assert.equal(adjResult.npcAttacks[0].style, "melee");

  // Expired snakeling dies
  const lateContext = { tick: 50, world, random: () => 0.5, tickEvents: { emit: () => {} } };
  const lateResult = encounter.definitions.tick(snakeling, lateContext);
  assert.equal(snakeling.alive, false);
});

test("zulrahAudio resolves attacks, projectiles, and visual events", async () => {
  const { zulrahAudio } = await import("../client/encounters/zulrah/audio.js");
  assert.equal(zulrahAudio.layerName, "zulrah");

  // Test zuk_attack rules
  const rangedAudio = zulrahAudio.rules.zuk_attack.resolve({ attack: "zulrah_ranged", projectileArrivalCycles: 60 });
  assert.equal(rangedAudio.kind, "play");
  assert.deepEqual(rangedAudio.sound.map(s => s.id), [213, 214]);

  const magicAudio = zulrahAudio.rules.zuk_attack.resolve({ attack: "zulrah_magic", projectileArrivalCycles: 60 });
  assert.equal(magicAudio.kind, "play");
  assert.deepEqual(magicAudio.sound.map(s => s.id), [162, 163]);

  // Test inferno_visual rules
  const visualAudio = zulrahAudio.rules.inferno_visual.resolve({
    zulrahSounds: [{ id: 790, range: 7, position: [29, 61] }, { id: 796, range: 15 }],
  });
  assert.equal(visualAudio.kind, "play");
  assert.equal(visualAudio.sound.length, 2);
  assert.equal(visualAudio.sound[0].id, 790);
  assert.equal(visualAudio.sound[0].channel, "area");
  assert.equal(visualAudio.sound[1].id, 796);
  assert.equal(visualAudio.sound[1].channel, "sfx");
});

test("all four presets have usable equipment, 28 inventory slots, food/potions and working weapon resources", () => {
  assert.deepEqual(Object.keys(presets), ["max_tbow", "max_hybrid", "void_hybrid", "bowfa"]);
  for (const [key, preset] of Object.entries(presets)) {
    assert.equal(preset.inventory.length, 28);
    assert.ok(preset.inventory.every(item => item?.id));
    for (const [slot, id] of Object.entries(preset.equipment)) {
      assert.ok(getEquipmentDefinition(id), `${key}: missing ${slot} item ${id}`);
      const type = environment.objTypeLoader.load(id);
      assert.notEqual(type.name, "null");
      for (const key of ["maleModel0", "maleModel1", "maleModel2", "femaleModel0", "femaleModel1", "femaleModel2"]) {
        if (type[key] >= 0) assert.ok(modelGroups.has(type[key]), `${type.name}: missing ${key} model ${type[key]}`);
      }
    }
    for (const id of [13441, 3144, 5952, 2434]) {
      assert.ok(preset.inventory.some(item => item.id === id));
      assert.ok(getConsumableDefinition(id), `unsupported consumable ${id}`);
    }
    const engine = newEngine(1, preset);
    const player = engine.player();
    const spell = getActiveSpell({ weaponId: player.equipment.weapon, selectedStyleIndex: player.selectedAttackStyleIndex, selectedSpell: player.combatSupplies.selectedSpell, spellbook: player.combatSupplies.spellbook });
    if (key === "void_hybrid") assert.equal(player.equipment.weapon, 27275, "use a supported staff until Twinflame combat is implemented");
    const resources = resolveAttackResources({ weaponId: player.equipment.weapon, equipment: player.equipment, inventory: player.inventory, formulaStyle: spell ? "magic" : "ranged", supplies: player.combatSupplies, activeSpell: spell?.name ?? null, magicLevel: 99 });
    assert.notEqual(resources.kind, "unavailable", `${key}: default weapon needs working resources`);
  }
});

test("opener gives a 5-tick grace period allowing player to position unless player attacks Zulrah early", () => {
  // Scenario A: Player does not attack. Zulrah emerges across ticks 0..3, stays idle ticks 4..8, and takes first action at tick 9.
  const idleEngine = newEngine(1);
  let firstShotTick = null;
  for (let t = 0; t < 15; t++) {
    idleEngine.advanceTick(idleEngine.player().position);
    const shots = idleEngine.getLastTickEvents()
      .filter(e => e.type === "inferno_visual")
      .flatMap(e => e.animations ?? [])
      .filter(a => a.clipId === "shoot");
    if (shots.length > 0 && firstShotTick === null) {
      firstShotTick = idleEngine.worldState.tick;
    }
  }
  assert.equal(firstShotTick, 9, "Zulrah must wait until tick 9 when player does not attack");

  // Scenario B: Player attacks Zulrah early at tick 4. The grace period is cancelled and Zulrah fires immediately.
  const activeEngine = newEngine(1, presets.bowfa);
  let earlyShotTick = null;
  for (let t = 0; t < 15; t++) {
    if (t === 4) {
      activeEngine.player().attackTarget = "zulrah";
      activeEngine.encounter.onPlayerAttackStarted({ targetId: "zulrah" });
    }
    activeEngine.advanceTick(activeEngine.player().position);
    const shots = activeEngine.getLastTickEvents()
      .filter(e => e.type === "inferno_visual")
      .flatMap(e => e.animations ?? [])
      .filter(a => a.clipId === "shoot");
    if (shots.length > 0 && earlyShotTick === null) {
      earlyShotTick = activeEngine.worldState.tick;
    }
  }
  assert.ok(earlyShotTick !== null && earlyShotTick < 9, "Zulrah must react early when attacked before tick 9");
});

test("Zulrah turns to face cloud volleys and snakeling spawns, setting lockedFacing", () => {
  const engine = newEngine(1);
  const boss = engine.worldState.getNpc("zulrah");
  
  // Advance until first cloud volley fires
  let volleyFired = false;
  while (!volleyFired && engine.worldState.tick < 20) {
    engine.advanceTick(engine.player().position);
    const visuals = engine.getLastTickEvents().filter(e => e.type === "inferno_visual");
    for (const v of visuals) {
      if (v.projectiles?.some(p => p.spotAnimId === 1045)) {
        volleyFired = true;
      }
    }
  }
  assert.ok(volleyFired, "First cloud volley must fire");
  assert.ok(boss.facing !== 0, "Boss facing must turn toward volley tiles");
  assert.equal(boss.lockedFacing, boss.facing, "lockedFacing must match facing angle");

  // Verify cloud spit projectile contains 3D flight properties required by renderer
  let sampleProj = null;
  const engine2 = newEngine(1);
  while (!sampleProj && engine2.worldState.tick < 20) {
    engine2.advanceTick(engine2.player().position);
    for (const v of engine2.getLastTickEvents().filter(e => e.type === "inferno_visual")) {
      sampleProj = v.projectiles?.find(p => p.spotAnimId === 1045);
      if (sampleProj) break;
    }
  }
  assert.ok(sampleProj, "Cloud projectile must be emitted");
  assert.ok(Array.isArray(sampleProj.sourcePosition), "sourcePosition must be array");
  assert.equal(typeof sampleProj.startDelayCycles, "number");
  assert.equal(typeof sampleProj.endDelayCycles, "number");
  assert.ok(sampleProj.endDelayCycles > sampleProj.startDelayCycles);
});

test("projectiles use accurate IDs: 1045 for venom clouds, 1047 for snakeling eggs, 1044 for ranged, 1046 for magic, 1230 for snakeling magic", async () => {
  const { zulrahSpotIds } = await import("../client/encounters/zulrah/encounter.js");
  assert.equal(zulrahSpotIds.toxicCloud, 1045, "Venom cloud spit projectile must be 1045");
  assert.equal(zulrahSpotIds.snakelingSpawn, 1047, "Snakeling egg spit projectile must be 1047");
  assert.equal(zulrahSpotIds.rangedProjectile, 1044, "Zulrah ranged attack projectile must be 1044");
  assert.equal(zulrahSpotIds.magicProjectile, 1046, "Zulrah magic attack projectile must be 1046");
  assert.equal(zulrahSpotIds.snakelingMagic, 1230, "Snakeling magic projectile must be 1230");
});

test("all inferno_visual events pass renderer schema with animations, projectiles, and graphics arrays", async () => {
  const z = await import("zod");
  const Fx = z.z.number().int().nonnegative();
  const tx = z.z.number().int().nonnegative();
  const nx = z.z.tuple([z.z.number(), z.z.number()]);
  const sx = z.z.discriminatedUnion("kind", [
    z.z.object({
      kind: z.z.literal("actor"),
      actorId: z.z.string().min(1),
      size: z.z.number().int().positive(),
      position: nx,
    }),
    z.z.object({
      kind: z.z.literal("tile"),
      position: nx,
    }),
  ]);
  const rx = z.z.object({
    spotAnimId: tx,
    sourcePosition: nx,
    target: sx,
    startDelayCycles: tx,
    endDelayCycles: tx,
    slope: tx,
    startOffset: tx,
    startHeight: tx,
    endHeight: tx,
  }).refine((e) => e.endDelayCycles >= e.startDelayCycles);
  const Ex = z.z.object({
    type: z.z.literal("inferno_visual"),
    eventId: Fx,
    tick: Fx,
    animations: z.z.array(
      z.z.object({
        actorId: z.z.string().min(1),
        clipId: z.z.string().min(1),
        delayCycles: Fx,
      }),
    ),
    projectiles: z.z.array(rx),
    graphics: z.z.array(
      z.z.object({
        spotAnimId: Fx,
        target: sx,
        delayCycles: Fx,
        height: Fx,
      }),
    ),
  });

  const engine1 = newEngine(1);
  let totalVisualEvents = 0;
  let spitCloudFound = false;

  for (let t = 0; t < 30; t++) {
    engine1.advanceTick(engine1.player().position);
    const events = engine1.getLastTickEvents().filter((e) => e.type === "inferno_visual");
    for (const ev of events) {
      totalVisualEvents++;
      const result = Ex.safeParse(ev);
      assert.ok(result.success, `inferno_visual at tick ${t} failed renderer schema: ${JSON.stringify(result.error?.issues)}`);
      assert.ok(Array.isArray(ev.animations), "animations must be an array");
      assert.ok(Array.isArray(ev.projectiles), "projectiles must be an array");
      assert.ok(Array.isArray(ev.graphics), "graphics must be an array");

      if (ev.projectiles.some((p) => p.spotAnimId === 1045)) spitCloudFound = true;
    }
  }

  const engine3 = newEngine(3);
  engine3.encounter.snakelingsEnabled = true;
  engine3.encounter.transitionToPhase(
    engine3.worldState.getNpc("zulrah"),
    1,
    { tick: 0, world: engine3.worldState, tickEvents: engine3.tickEvents },
    { immediate: true },
  );
  let snakelingSpitFound = false;
  for (let t = 0; t < 25; t++) {
    engine3.advanceTick(engine3.player().position);
    const events = engine3.getLastTickEvents().filter((e) => e.type === "inferno_visual");
    for (const ev of events) {
      totalVisualEvents++;
      const result = Ex.safeParse(ev);
      assert.ok(result.success, `inferno_visual at tick ${t} failed renderer schema: ${JSON.stringify(result.error?.issues)}`);
      assert.ok(Array.isArray(ev.animations), "animations must be an array");
      assert.ok(Array.isArray(ev.projectiles), "projectiles must be an array");
      assert.ok(Array.isArray(ev.graphics), "graphics must be an array");

      if (ev.projectiles.some((p) => p.spotAnimId === 1047)) snakelingSpitFound = true;
    }
  }

  assert.ok(totalVisualEvents > 0, "Must emit inferno_visual events");
  assert.ok(spitCloudFound, "Must emit venom cloud spit projectile (1045)");
  assert.ok(snakelingSpitFound, "Must emit snakeling egg spit projectile (1047)");
});

