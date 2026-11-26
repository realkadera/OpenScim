// Unit test for Ring of recoil and charged Ring of suffering recoil damage in CombatSystem.js.
// WIKI: When damaged by an NPC, Ring of recoil or charged Ring of suffering deals
// floor(damage * 0.1) + 1 recoil damage back to the attacker.
// Uncharged variants (19550, 19710, etc.) do not recoil.
import assert from "node:assert/strict";
import { test } from "node:test";
import { loadEnvironment } from "../tools/determinism/harness.mjs";

const { engineModule } = await loadEnvironment();
const { CombatSystem } = await import("../client/engine/CombatSystem.js");

test("recoil rings: uncharged rings deal no recoil; charged rings deal floor(damage * 0.1) + 1", () => {
  const hitsApplied = [];
  const combatContext = {
    events: {
      setCurrentTick() {},
      emit(event) {
        if (event.type === "hit_applied") {
          hitsApplied.push(event);
        }
      },
    },
  };

  const worldState = {
    tick: 10,
    actors: new Map(),
    pendingHits: [],
  };

  const combat = new CombatSystem();

  const attacker = {
    id: "boss",
    kind: "npc",
    alive: true,
    position: [10, 11],
    vitals: { hp: 500, maxHp: 500 },
  };
  const player = {
    id: "player",
    kind: "player",
    alive: true,
    position: [10, 10],
    vitals: { hp: 99, maxHp: 99 },
    equipment: {},
  };

  worldState.actors.set("boss", attacker);
  worldState.actors.set("player", player);

  // 1. No ring equipped: player takes 20 damage, boss takes 0 recoil.
  player.equipment.ring = undefined;
  combat.applyHit(
    worldState,
    attacker,
    player,
    { style: "melee", rolledDamage: 20, accuracySucceeded: true, impactDelayTicks: 0 },
    combatContext,
  );
  assert.equal(hitsApplied.filter((h) => h.targetId === "boss").length, 0, "no recoil without ring");

  // 2. Uncharged Ring of suffering (i) (19710): player takes 20 damage, boss takes 0 recoil.
  player.equipment.ring = 19710;
  combat.applyHit(
    worldState,
    attacker,
    player,
    { style: "melee", rolledDamage: 20, accuracySucceeded: true, impactDelayTicks: 0 },
    combatContext,
  );
  assert.equal(hitsApplied.filter((h) => h.targetId === "boss").length, 0, "no recoil with uncharged ring");

  // 3. Ring of recoil (2550): player takes 20 damage, boss takes floor(20/10) + 1 = 3 recoil damage.
  player.equipment.ring = 2550;
  combat.applyHit(
    worldState,
    attacker,
    player,
    { style: "melee", rolledDamage: 20, accuracySucceeded: true, impactDelayTicks: 0 },
    combatContext,
  );
  const recoilHits1 = hitsApplied.filter((h) => h.targetId === "boss");
  assert.equal(recoilHits1.length, 1, "recoil applied to boss");
  assert.equal(recoilHits1[0].damage, 3, "20 damage recoils 3");

  // 4. Charged Ring of suffering (ri) (20657):
  // 15 damage: floor(15/10) + 1 = 2
  // 35 damage: floor(35/10) + 1 = 4
  player.equipment.ring = 20657;
  combat.applyHit(
    worldState,
    attacker,
    player,
    { style: "range", rolledDamage: 15, accuracySucceeded: true, impactDelayTicks: 0 },
    combatContext,
  );
  const recoilHits2 = hitsApplied.filter((h) => h.targetId === "boss");
  assert.equal(recoilHits2.length, 2);
  assert.equal(recoilHits2[1].damage, 2, "15 damage recoils 2");

  combat.applyHit(
    worldState,
    attacker,
    player,
    { style: "range", rolledDamage: 35, accuracySucceeded: true, impactDelayTicks: 0 },
    combatContext,
  );
  const recoilHits3 = hitsApplied.filter((h) => h.targetId === "boss");
  assert.equal(recoilHits3.length, 3);
  assert.equal(recoilHits3[2].damage, 4, "35 damage recoils 4");

  // 5. Zero damage (e.g. miss): no recoil.
  combat.applyHit(
    worldState,
    attacker,
    player,
    { style: "range", rolledDamage: 0, accuracySucceeded: false, impactDelayTicks: 0 },
    combatContext,
  );
  assert.equal(hitsApplied.filter((h) => h.targetId === "boss").length, 3, "no recoil on 0 damage");
});
