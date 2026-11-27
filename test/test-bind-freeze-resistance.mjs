// A bind is a freeze: the scorching bow's special binds for 21 ticks, shortened by the target's freeze resistance as a
// freeze is, and a target immune to freezes (100%) isn't bound. Before, binds ignored it. The numbers are the
// monster table's; the Doom's fight doesn't come to this rule (see below).
import assert from "node:assert/strict";
import { installHooks } from "../tools/determinism/node-hooks.mjs";

installHooks();
globalThis.self ??= globalThis;
globalThis.location ??= { pathname: "/" };
const { applySpecialAttackEffects } = await import("../client/engine/specialAttacks.js");
const { getSpecialAttackDefinition } = await import("../client/data/specialAttackDefinitions.js");
const { getMonsterFormulaStats } = await import("../client/engine/monsterStats.js");

const SCORCHING_BOW = 29591;
const bind = getSpecialAttackDefinition(SCORCHING_BOW).onFireEffects.filter((effect) => effect.effect === "bind");
assert.deepEqual(bind, [{ effect: "bind", delayTicks: 2, durationTicks: 21 }]);

const bound = (freezeResistance) => {
  const target = { formulaStats: { freezeResistance, attributes: ["demon"], levels: {} }, debuffs: {} };
  applySpecialAttackEffects({ id: "player" }, target, 0, bind, 100, "on-fire");
  return target.debuffs.boundUntilTick === undefined ? 0 : target.debuffs.boundUntilTick - target.debuffs.boundFromTick;
};
assert.equal(bound(0), 21, "no resistance: the whole 21 ticks");
assert.equal(bound(50), 10, "half: floor(21 / 2)");
assert.equal(bound(100), 0, "immune: not bound");

// TABLE: the Doom's burrowed form is immune; his standing form (14707) is not. In his fight the burrowed Doom keeps
// the standing form's formula stats (burrow.js changes his npcTypeId only), so this rule doesn't reach him there: his
// burrow drops a bind itself (burrow.js, #156).
assert.equal(getMonsterFormulaStats(14707, "Delve 1").freezeResistance, 0);
assert.equal(getMonsterFormulaStats(14709).freezeResistance, 100);
assert.equal(bound(getMonsterFormulaStats(14709).freezeResistance), 0);
console.log("Binds: 21 ticks unresisted, 10 at 50%, none on a freeze-immune target.");
