import assert from "node:assert/strict";
import { test } from "node:test";
import { runScenario, loadEnvironment } from "../tools/determinism/harness.mjs";

const { rendering } = await loadEnvironment(); // the client uses web-root imports resolved by the harness loader
const { corruptedHunllefPresentation } = await import("../client/encounters/corrupted-hunllef/presentation.js");

const practice = (seed, ticks, extra = {}) => ({ name: "hunllef-attack-test", kind: "corrupted_hunllef",
  seed, ticks, mechanics: { infiniteHealth: true, ...extra }, script() {} });

test("corrupted staff and bow retain their crystal projectiles", () => {
  for (let offset = 0; offset < 3; offset++) {
    assert.equal(rendering.FD(23852 + offset)?.projectileId, 1723);
    assert.equal(rendering.FD(23855 + offset)?.projectileId, 249);
    assert.equal(rendering.FD(23855 + offset)?.hitSpotanim, 250);
  }
});

test("scene resolves its render config with audible Hunllef cues", () => {
  const calls = [];
  class Scene {
    setEncounterRenderConfig(config) { this.config = config; this.controller = config.createSceneObjectController(); }
    setEventAudioPlayer() {}
    setFrameSoundTracker() {}
    setGroundItemLoaderSource() {}
  }
  const presentation = corruptedHunllefPresentation(Scene);
  const scene = presentation.sceneBuilder({
    encounterRenderConfig: { ...presentation.renderConfig, mapOffset: [40, 40] },
    eventAudioPlayer: { engine: { play: (...args) => calls.push(args) } },
  });
  assert.deepEqual(scene.config.mapOffset, [40, 40]);
  const events = [
    { type: "inferno_visual", eventId: 1, animations: [{ actorId: "corrupted-hunllef", clipId: "switchMagic" }] },
    { type: "inferno_visual", eventId: 2, animations: [{ actorId: "corrupted-hunllef", clipId: "tornado" }] },
    { type: "inferno_visual", eventId: 3, projectiles: [{ spotAnimId: 1714 }] },
    { type: "inferno_visual", eventId: 4, animations: [{ actorId: "corrupted-hunllef", clipId: "switchRange" }] },
  ];
  scene.controller.consumeEvents(events);
  scene.controller.consumeEvents(events);
  assert.deepEqual(calls.map(([soundId]) => soundId), [4454, 4161, 134, 4454]);
});

test("Hunllef opens ranged and switches after four counted attacks", async () => {
  const launches = [];
  const switches = [];
  await runScenario(practice(71, 70), { onTick(tick, engine) {
    const visual = engine.getLastTickEvents().filter(event => event.type === "inferno_visual");
    for (const event of visual) {
      if (event.animations?.some(animation => animation.clipId === "attack" || animation.clipId === "tornado"))
        launches.push([tick, engine.encounter.attackStyle, event.animations[0].clipId]);
      if (event.animations?.some(animation => animation.clipId === "switchMagic" || animation.clipId === "switchRange"))
        switches.push([tick, engine.encounter.attackStyle, event.animations[0].clipId]);
    }
  } });
  assert.deepEqual(launches.slice(0, 5).map(([tick, style]) => [tick, style]),
    [[6, "range"], [11, "range"], [16, "range"], [21, "range"], [26, "magic"]]);
  assert.deepEqual(switches.slice(0, 2), [[22, "magic", "switchMagic"], [42, "range", "switchRange"]]);
  assert.equal(launches.find(([tick]) => tick === 61)?.[2], "attack", "fourth slot cannot summon");
  assert.equal(launches.find(([tick]) => tick === 66)?.[2], "tornado");
});

test("Protect from Missiles starts active in every practice phase", async () => {
  for (const phase of ["full", "middle", "low"]) {
    await runScenario(practice(71, 0, { corruptedHunllefStartPhase: phase }), { onTick(tick, engine) {
      if (tick !== 0) return;
      assert.equal(engine.player().activePrayer, "ProtectRange");
      assert.deepEqual(engine.player().prayerState.activePrayers, ["ProtectRange"]);
      assert.equal(engine.player().offensivePrayer, null);
    } });
  }
});

test("a protected bow hit has zero applied max, zero HP loss, and no damage XP", async () => {
  const hits = [];
  let final;
  const scenario = { ...practice(1, 20), equipment: { weapon: 23855 },
    script(tick, api) { if (tick === 1) api.act({ type: "attackTarget", targetId: "corrupted-hunllef" }); } };
  await runScenario(scenario, { onTick(tick, engine) {
    if (tick === 0) {
      assert.equal(engine.encounter.protection, "range");
      assert.equal(engine.getAdjustedTheoreticalDps().maxHit, 0);
    }
    hits.push(...engine.getLastTickEvents().filter(event => event.type === "hit_applied" && event.targetId === "corrupted-hunllef"));
    final = { hp: engine.worldState.getNpc("corrupted-hunllef").vitals.hp,
      xp: { ...engine.player().xpCounters }, offProtectionHits: engine.encounter.offProtectionHits };
  } });
  assert.ok(hits.length > 0);
  assert.ok(hits.every(hit => hit.damage === 0));
  assert.deepEqual(final, { hp: 1000, xp: {}, offProtectionHits: 0 });
});

test("final phase summons four tornadoes that expire after twenty ticks", async () => {
  const counts = new Map();
  const positions = new Map();
  await runScenario(practice(71, 89, { corruptedHunllefStartPhase: "low" }), { onTick(tick, engine) {
    const tornadoes = engine.worldState.getNpcs().filter(npc => npc.id.startsWith("hunllef-tornado-"));
    if ([65, 66, 67, 68, 87, 88].includes(tick)) counts.set(tick, tornadoes.length);
    if (tick === 68 || tick === 69) positions.set(tick, tornadoes.map(npc => [...npc.position]));
  } });
  assert.deepEqual([...counts], [[65, 0], [66, 0], [67, 0], [68, 4], [87, 4], [88, 0]]);
  assert.ok(positions.get(69).some(([x, y], index) =>
    x !== positions.get(68)[index][0] || y !== positions.get(68)[index][1]),
  "tornadoes wait through the spawn tick before their first chase step");
});

test("an active tornado set blocks another summon", async () => {
  const launches = [];
  await runScenario(practice(71, 73, { corruptedHunllefStartPhase: "low" }), { onTick(tick, engine) {
    if (tick === 68) engine.encounter.nextTornadoTick = 69;
    if (tick === 71) launches.push(...engine.getLastTickEvents()
      .filter(event => event.type === "inferno_visual")
      .flatMap(event => event.animations ?? []).map(animation => animation.clipId));
  } });
  assert.ok(launches.includes("attack"));
  assert.equal(launches.includes("tornado"), false);
});

test("prayer disable occurs at most once per Magic cycle", async () => {
  const disabledPerCycle = [];
  let magicCycle = -1;
  await runScenario(practice(71, 500), { onTick(tick, engine) {
    const visuals = engine.getLastTickEvents().filter(event => event.type === "inferno_visual");
    if (visuals.some(event => event.animations?.some(animation => animation.clipId === "switchMagic")) &&
      engine.encounter.attackStyle === "magic") {
      magicCycle++;
      disabledPerCycle[magicCycle] = 0;
    }
    for (const visual of visuals) {
      if (visual.projectiles?.some(projectile => projectile.spotAnimId === 1714))
        disabledPerCycle[magicCycle]++;
    }
  } });
  assert.ok(disabledPerCycle.length > 5);
  assert.ok(disabledPerCycle.every(count => count <= 1));
  assert.ok(disabledPerCycle.some(count => count === 1));
  assert.ok(disabledPerCycle.some(count => count === 0));
});

test("the special Magic projectile disables all active prayers on impact", async () => {
  let launched = false;
  let disabled = false;
  const scenario = { ...practice(3, 30), script(tick, api) {
    if (tick === 1) {
      api.act({ type: "protectionPrayer", prayer: "ProtectMagic" });
      api.act({ type: "offensivePrayer", prayer: "Piety" });
      api.act({ type: "independentPrayer", prayer: "Preserve" });
    }
  } };
  await runScenario(scenario, { onTick(tick, engine) {
    if (tick === 26) {
      launched = engine.getLastTickEvents().some(event => event.type === "inferno_visual" &&
        event.projectiles?.some(projectile => projectile.spotAnimId === 1714));
      assert.equal(engine.player().activePrayer, "ProtectMagic");
    }
    if (tick === 28) disabled = engine.player().activePrayer === null &&
      engine.player().offensivePrayer === null && engine.player().independentPrayers.length === 0 &&
      engine.player().prayerState.points > 0;
  } });
  assert.equal(launched, true);
  assert.equal(disabled, true);
});
