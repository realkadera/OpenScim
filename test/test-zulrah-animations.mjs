// Exercise the real cache, CPU model posing and encounter clock without a browser or WebGL.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, test } from "node:test";
import { loadEnvironment } from "../tools/determinism/harness.mjs";
import { zulrahAnimations, animationTicks, clientCyclesPerTick, sampleBossAnimation } from "../client/encounters/zulrah/animations.js";

const environment = await loadEnvironment();
const { CacheManager } = await import("../client/assets/player.js");
const unused = new Proxy({}, { get: () => async () => null });
const cache = new CacheManager(unused, unused);
cache.cacheInfo = JSON.parse(readFileSync("client/osrs-cache/manifest.json", "utf8"));
const zip = readFileSync("client/osrs-cache/disk.zip");
await cache.initializeCacheSystem(await cache.extractZip(zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength)));
const presentation = environment.rendering.KV.find((entry) => entry.kind === "zulrah");
const scene = presentation.sceneBuilder({ cacheManager: cache, encounterRenderConfig: presentation.renderConfig });
after(() => scene.dispose());
const manager = scene.npcInstanceManager;
for (const config of presentation.renderConfig.preloadNpcTypes.filter((entry) => entry.npcTypeId <= 2044)) {
  await manager.loadNpcType(config.npcTypeId, cache.getNpcModelLoader(), cache.getAnimationSystem(), config);
}

const poseOf = (instance) => [instance.posedVerticesX, instance.posedVerticesY, instance.posedVerticesZ].map((axis) => Array.from(axis ?? []));
function poseBoss(npcTypeId, clipId, startedTick, cycle) {
  const npc = { id: "zulrah", npcTypeId, position: [26, 65], previousPosition: [26, 65], facingAngle: 0, alive: true, size: 5 };
  const state = { currentTick: Math.floor(cycle / clientCyclesPerTick), encounterOutcome: { phase: "active" }, npcs: [npc], encounter: { state: { bossAnimation: { clipId, startedTick } } } };
  scene.syncNpcInstances(state.npcs, false, state);
  scene.restoreBossAnimation(state, cycle);
  manager.PA(0, 1, []);
  return manager.instanceRegistry.get(scene.getNpcRenderInstanceId("zulrah"));
}

test("Zulrah's declared clips and durations match the real cached sequences on every form", () => {
  for (const typeId of [2042, 2043, 2044]) {
    const clips = manager.typeRegistry.get(typeId).animationSet.attackClips;
    for (const [name, definition] of Object.entries(zulrahAnimations)) {
      assert.equal(clips[name].seqId, definition.seqId);
      assert.equal(clips[name].frameLengths.reduce((sum, length) => sum + length, 0), definition.cycles);
      for (const id of clips[name].frameIds) assert.ok(cache.getAnimationSystem().loadFrame(id), `${typeId}/${name}: missing frame ${id}`);
    }
  }
});

test("both red slams actually move Magma's vertices and restore mid-attack after a form change or seek", () => {
  for (const clipId of ["meleeFocus", "meleeAttack"]) {
    poseBoss(2042, "emerge", 0, 0); // The same actor becomes the red form.
    const first = poseBoss(2043, clipId, 10, 310);
    const firstPose = poseOf(first);
    const later = poseBoss(2043, clipId, 10, 440);
    const laterPose = poseOf(later);
    assert.equal(later.animController.primaryTrack.clip.seqId, zulrahAnimations[clipId].seqId);
    assert.notDeepEqual(firstPose, laterPose, `${clipId} must deform the red model`);
    poseBoss(2044, "shoot", 20, 610); // A forward seek to another colour.
    const restored = poseBoss(2043, clipId, 10, 440); // Seek back into the slam.
    assert.deepEqual(poseOf(restored), laterPose, `${clipId}: seek must restore the same pose`);
    assert.equal(restored.animController.primaryTrack.elapsedTicks, 140);
  }
});

test("dive holds its final pose, the submerged model is hidden, and surface restores on the new form", () => {
  const diving = poseBoss(2043, "submerge", 10, 359);
  const lastPose = poseOf(diving);
  const submerged = poseBoss(2043, "submerge", 10, 375);
  assert.deepEqual(poseOf(submerged), lastPose, "the completed dive must not snap back to idle");
  scene.zulrahSubmerged = true;
  const options = { entityHider: null, tzhaarHpTracker: null };
  assert.equal(scene.resolveHiddenNpcModels([], options)(scene.getNpcRenderInstanceId("zulrah")), true);
  assert.equal(scene.resolveHiddenNpcModels([], options)("snakeling_1"), false);
  const queue = { commands: [] };
  manager.renderAll(queue, scene.resolveHiddenNpcModels([], options));
  assert.equal(queue.commands.length, 0, "the submerged boss must submit no model meshes");
  assert.equal(scene.getAllNpcHitTestData().some(({ actorId }) => actorId === scene.getNpcRenderInstanceId("zulrah")), false);
  scene.zulrahSubmerged = false;
  assert.equal(scene.resolveHiddenNpcModels([], options), undefined);
  const early = poseOf(poseBoss(2044, "emerge", 13, 395));
  const late = poseOf(poseBoss(2044, "emerge", 13, 440));
  assert.notDeepEqual(early, late, "the next form must visibly surface");
  assert.equal(sampleBossAnimation({ clipId: "emerge", startedTick: 13 }, 450), null);
});

test("live and reconstructed replay paths restore the red attack rather than leaving an idle replacement model", () => {
  poseBoss(2043, "meleeFocus", 10, 310);
  const state = { currentTick: 14, encounterOutcome: { phase: "active" }, npcs: [{ id: "zulrah", npcTypeId: 2043, alive: true }], encounter: { state: { bossAnimation: { clipId: "meleeFocus", startedTick: 10 } } } };
  const instance = manager.instanceRegistry.get(scene.getNpcRenderInstanceId("zulrah"));
  instance.animController.reset();
  scene.getEncounterAttackTriggers(state, 14);
  manager.PA(0, 1, []);
  assert.equal(instance.animController.primaryTrack.clip.seqId, 5806);
  assert.equal(instance.animController.primaryTrack.elapsedTicks, 120);
  const expected = poseOf(instance);
  instance.animController.reset();
  scene.primaryCycle = 420;
  scene.replayEffectIndex = {};
  assert.equal(scene.restoreEncounterPrimaries({ simulationState: state, replayHistory: { frames: [], throughFrameIndex: 0 } }), true);
  manager.PA(0, 1, []);
  assert.deepEqual(poseOf(instance), expected);
  scene.replayEffectIndex = undefined;
});

test("all rotations serialize attacks, recovery, dive, submerged and surface without replacing a final shot", async () => {
  await environment.prepareArena("zulrah");
  for (const rotation of [1, 2, 3, 4]) {
    const engine = environment.engineModule.createSimulationEngine({
      encounterConfig: { kind: "zulrah", mechanics: { zulrahRotation: String(rotation), zulrahSnakelings: true, zulrahToxicClouds: true, infiniteHealth: true } },
      objTypeLoader: environment.objTypeLoader,
      enableIntro: false,
      combatSeed: 101,
      inventory: [],
      equipment: {},
      attackStylePerCategory: {},
      combatSupplies: environment.engineModule.createEmptyCombatSupplies(),
    });
    let previous = engine.getState();
    const stages = new Set();
    const phases = new Set();
    const redClips = new Set();
    for (let tick = 0; tick < 450; tick++) {
      engine.advanceTick(engine.player().position);
      const state = engine.getState();
      const boss = state.npcs.find((npc) => npc.id === "zulrah");
      const before = previous.npcs.find((npc) => npc.id === "zulrah");
      const current = state.encounter.state;
      const prior = previous.encounter.state;
      stages.add(current.phaseState);
      phases.add(current.phaseIndex);
      const cues = engine.getLastTickEvents().filter((event) => event.type === "inferno_visual").flatMap((event) => event.animations ?? []).filter((cue) => cue.actorId === "zulrah");
      assert.ok(cues.length <= 1, `rotation ${rotation}, tick ${state.currentTick}: conflicting boss cues`);
      if (boss.npcTypeId === 2043 && ["meleeFocus", "meleeAttack"].includes(current.bossAnimation.clipId)) redClips.add(current.bossAnimation.clipId);
      if (current.phaseState === "submerging" && prior.phaseState !== "submerging") {
        const end = prior.bossAnimation.startedTick + animationTicks(prior.bossAnimation.clipId);
        assert.ok(state.currentTick >= end, "final attack must complete before the dive");
        assert.deepEqual(boss.position, before.position);
        assert.equal(boss.npcTypeId, before.npcTypeId);
      }
      if (current.phaseState === "submerged") {
        assert.equal(boss.untargetable, true);
        assert.deepEqual(boss.position, before.position);
        assert.equal(boss.npcTypeId, before.npcTypeId);
      }
      if (current.phaseIndex !== prior.phaseIndex) {
        assert.equal(prior.phaseState, "submerged");
        assert.equal(current.phaseState, "emerging");
        assert.equal(current.bossAnimation.clipId, "emerge");
      }
      if (current.phaseState === "emerging" && state.currentTick < current.bossAnimation.startedTick + animationTicks("emerge")) assert.equal(boss.untargetable, true);
      previous = state;
    }
    assert.deepEqual([...redClips].sort(), ["meleeAttack", "meleeFocus"]);
    assert.equal(phases.size, previous.encounter.state.phaseCount, `rotation ${rotation}: exercise every phase`);
    for (const stage of ["attacking", "recovering", "submerging", "submerged", "emerging"]) assert.ok(stages.has(stage), `rotation ${rotation}: missing ${stage}`);
  }
});
