// Unit tests for opt-in engine features:
// 1. plan.minHit on rollNpcAttack (client/encounters/shared/npcAttack.js)
// 2. retaliation.startsOutOfCombat (client/engine/npcRetaliation.js)
// 3. context.inputs.targetTile in SimulationEngine (client/engine/SimulationEngine.js)
import assert from "node:assert/strict";
import { test } from "node:test";
import { loadEnvironment } from "../tools/determinism/harness.mjs";

const { engineModule } = await loadEnvironment();
const { rollNpcAttack } = await import("../client/encounters/shared/npcAttack.js");
const { scheduleNpcRetaliation, resolvePendingRetaliations } = await import("../client/engine/npcRetaliation.js");
const { createSeededRandom } = await import("../client/engine/random.js");
const { SimulationEngine, createEmptyInventory, createEmptyCombatSupplies } = engineModule;

test("rollNpcAttack: minHit enforces a minimum damage floor on hit, default 0 when omitted", () => {
  const attacker = {
    id: "attacker",
    npcTypeId: 100,
    size: 1,
    position: [10, 10],
    formulaStats: {
      levels: { attack: 200, strength: 200, defence: 100, magic: 100 },
      offensiveBonus: 100,
      strengthBonus: 100,
    },
  };
  const target = {
    id: "dummy",
    kind: "npc",
    npcTypeId: 101,
    size: 1,
    position: [10, 11],
    formulaStats: {
      levels: { defence: 1 },
      defensiveBonus: 0,
    },
  };

  // 1. Default (no minHit): damage rolls between 0 and maxHit, can roll below 15.
  const rng1 = createSeededRandom(42);
  const hitsWithoutMin = [];
  for (let i = 0; i < 100; i++) {
    const res = rollNpcAttack({
      attacker,
      target,
      random: rng1,
      plan: {
        attackSpeed: 4,
        attackRange: 1,
        formulaStyle: "melee",
        alwaysHits: true,
        maxHit: 30,
        impactDelayTicks: 1,
      },
    });
    if (res && res.accuracySucceeded) {
      hitsWithoutMin.push(res.rolledDamage);
    }
  }
  assert.ok(hitsWithoutMin.length > 0, "has hits without min");
  assert.ok(hitsWithoutMin.some((d) => d < 15), "omitted minHit allows hits below 15");
  assert.ok(hitsWithoutMin.every((d) => d >= 0 && d <= 30), "damage bounded in [0, 30]");

  // 2. With minHit: 15: rolled damage must always be >= 15.
  const rng2 = createSeededRandom(42);
  const hitsWithMin = [];
  for (let i = 0; i < 100; i++) {
    const res = rollNpcAttack({
      attacker,
      target,
      random: rng2,
      plan: {
        attackSpeed: 4,
        attackRange: 1,
        formulaStyle: "melee",
        alwaysHits: true,
        minHit: 15,
        maxHit: 30,
        impactDelayTicks: 1,
      },
    });
    if (res && res.accuracySucceeded) {
      hitsWithMin.push(res.rolledDamage);
    }
  }
  assert.ok(hitsWithMin.length > 0, "has hits with min");
  assert.ok(hitsWithMin.every((d) => d >= 15 && d <= 30), "all hits bounded in [15, 30]");
});

test("npcRetaliation: startsOutOfCombat allows opening hit to delay next action despite pre-set target", () => {
  // Case A: Default NPC (startsOutOfCombat omitted/false):
  // Aggressive NPC has targetId: "player", nextActionTick: 5, attackSpeed: 6.
  // When player attacks on tick 2, since targetId is already "player" and nextActionTick + 8 >= 2,
  // isAlreadyFightingSource is true, so nextActionTick remains 5.
  const defaultNpc = {
    id: "mob",
    alive: true,
    combat: {
      targetId: "player",
      nextActionTick: 5,
      attackSpeed: 6,
      lastAttackTick: null,
      retaliation: {
        mode: "standard",
        pending: [],
        lastIncomingAttackTick: null,
      },
    },
  };
  scheduleNpcRetaliation(defaultNpc, {
    style: "melee",
    accuracySucceeded: true,
    launchTick: 2,
    impactTick: 2,
    sourceId: "player",
  });
  const worldA = {
    tick: 2,
    actors: new Map([["player", { alive: true }], [defaultNpc.id, defaultNpc]]),
    getNpc: (id) => (id === defaultNpc.id ? defaultNpc : null),
    getNpcs: () => [defaultNpc],
  };
  resolvePendingRetaliations(worldA);
  assert.equal(defaultNpc.combat.nextActionTick, 5, "default NPC does not delay nextActionTick when already targeting player");

  // Case B: Opt-in (startsOutOfCombat: true):
  // The NPC has targetId: "player", but has not yet attacked or received incoming attacks.
  // With startsOutOfCombat: true, isAlreadyFightingSource returns false.
  // delayNextActionForRetaliation sets nextActionTick = max(4, 3 + floor(6/2)) = 6.
  const optInNpc = {
    id: "graardor",
    alive: true,
    combat: {
      targetId: "player",
      nextActionTick: 4,
      attackSpeed: 6,
      lastAttackTick: null,
      retaliation: {
        mode: "standard",
        startsOutOfCombat: true,
        pending: [],
        lastIncomingAttackTick: null,
      },
    },
  };
  scheduleNpcRetaliation(optInNpc, {
    style: "range",
    accuracySucceeded: true,
    launchTick: 2,
    impactTick: 3,
    sourceId: "player",
  });
  const worldB = {
    tick: 3,
    actors: new Map([["player", { alive: true }], [optInNpc.id, optInNpc]]),
    getNpc: (id) => (id === optInNpc.id ? optInNpc : null),
    getNpcs: () => [optInNpc],
  };
  resolvePendingRetaliations(worldB);
  assert.equal(optInNpc.combat.nextActionTick, 6, "startsOutOfCombat delays nextActionTick to 6 on opening player hit");
});

test("SimulationEngine: inputs.targetTile is passed to encounter.onTick", () => {
  let observedTargetTile = undefined;
  const mockEncounter = {
    kind: "mock_test",
    init() {},
    resolveHazards(context) {
      observedTargetTile = context.inputs?.targetTile;
      return [];
    },
    processPostTick() { return []; },
    getOutcome() { return { phase: "active" }; },
    getSnapshot() { return { kind: "mock_test", state: {}, visuals: {} }; },
    getEngineRules() { return { targetTile: true }; },
    getDefaultMechanicsConfig() { return {}; },
    getEncounterControlInfo() { return { debugActions: [] }; },
    getArenaConfig() { return { minX: 0, maxX: 100, minY: 0, maxY: 100 }; },
    getDefaultPlayerStart() { return [0, 0]; },
    createNpcs() { return []; },
  };

  const engine = new SimulationEngine({
    encounter: mockEncounter,
    inventory: createEmptyInventory(),
    equipment: {},
    combatSupplies: createEmptyCombatSupplies(),
    attackStylePerCategory: {},
  });

  // Step tick with player target position [45, 55]
  engine.advanceTick([45, 55]);
  assert.deepEqual(observedTargetTile, [45, 55], "inputs.targetTile matches target destination");
});
