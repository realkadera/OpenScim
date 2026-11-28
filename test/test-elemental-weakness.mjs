// Elemental weakness (#44), WIKI (Elemental weakness): the standard spellbook's strike to surge spells of a monster's
// weak element get floor(base max hit × weakness%) added to the max hit, after every other magic damage source, and
// (inferred: the wiki gives no formula) the attack roll × (100 + weakness) / 100. No other spell gains anything.
import assert from "node:assert/strict";
import { installHooks } from "../tools/determinism/node-hooks.mjs";

installHooks();
globalThis.self ??= globalThis; // as the harness: PicoGL reads `self` when it loads
globalThis.location ??= { pathname: "/" };
const { buildPlayerAttackPlan } = await import("../client/engine/playerAttack/plan.js");
const { selectPlayerAttackProfile } = await import("../client/engine/playerAttack/profiles.js");
const { getMonsterFormulaStats } = await import("../client/engine/monsterStats.js");
const { getSingleRollHitChance } = await import("../client/engine/combatFormulas.js");

const MAGGOT_KING = 15742; // CACHE (client/encounters/maggot-king/ids.js)
const far = getMonsterFormulaStats(MAGGOT_KING, "Far");
assert.deepEqual(far?.elementalWeakness, { element: "fire", percent: 80 }, "the Maggot King far away: 80% weak to fire (TABLE)");
const { elementalWeakness, ...noWeakness } = far;

const level = (n) => ({ current: n, base: n });
const player = {
  stats: { attack: level(99), strength: level(99), defence: level(99), ranged: level(99), magic: level(99), hitpoints: level(99), prayer: level(99) },
  equipment: { weapon: 1381 }, // Staff of air
  equipmentStats: { attackStab: 0, attackSlash: 0, attackCrush: 0, attackMagic: 10, attackRanged: 0, defenceStab: 0, defenceSlash: 0, defenceCrush: 0, defenceMagic: 0, defenceRanged: 0, meleeStrength: 0, rangedStrength: 0, magicDamage: 0, prayer: 0 },
  activePrayer: null,
  offensivePrayer: null,
  selectedAttackStyleIndex: 0,
};
function plan(spellId, formulaStats) {
  const resources = { kind: "spell", spellId };
  const profile = selectPlayerAttackProfile({ weaponId: player.equipment.weapon, formulaStyle: "magic", isSpecialAttack: false, resources, targetAttributes: [] });
  const result = buildPlayerAttackPlan({
    profile, resources, formulaStyle: "magic", player, manualCast: true, attackSpeedTicks: 5,
    delivery: { kind: "projectile" }, application: { kind: "standard" },
    target: { npcTypeId: MAGGOT_KING, formulaStats, debuffs: {} },
  });
  assert.equal(result?.kind, "ready", spellId + " plans");
  return { ...result.diagnostics, chance: result.hits[0].accuracy.chance };
}

// Fire Surge (base max hit 24): +floor(24 × 80%) = 19, and an attack roll 80% higher.
const weak = plan("Fire Surge", far);
const plain = plan("Fire Surge", noWeakness);
assert.equal(plain.profileMaxHit, 24);
assert.equal(weak.profileMaxHit, 24 + 19);
assert.equal(weak.baseAttackRoll, plain.baseAttackRoll, "the base roll is the same; the weakness comes after it");
assert.equal(weak.chance, getSingleRollHitChance(Math.floor((plain.baseAttackRoll * 180) / 100), plain.baseDefenceRoll));
assert.ok(weak.chance > plain.chance);
// Another element, and another book: nothing.
assert.deepEqual(plan("Water Surge", far), plan("Water Surge", noWeakness));
assert.deepEqual(plan("Ice Barrage", far), plan("Ice Barrage", noWeakness));
// Near (5%): +floor(24 × 5%) = 1.
assert.equal(plan("Fire Surge", getMonsterFormulaStats(MAGGOT_KING, "Nearby")).profileMaxHit, 24 + 1);
console.log("Fire Surge on the far Maggot King: max hit 24 + 19; Water Surge and Ice Barrage unchanged; near, 24 + 1.");
