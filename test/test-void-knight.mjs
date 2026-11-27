// Void Knight equipment's set effects (client/engine/combatFormulas.js),
// WIKI: Void Knight equipment, Elite Void Knight equipment. Melee helm: +10%
// accuracy and damage. Ranger helm: +10% accuracy and damage, 12.5% damage
// in elite. Mage helm: +45% accuracy, and +5% magic damage in elite only.
// Each is a multiplier on the effective level (WIKI: Maximum melee hit,
// "(floor(level x prayer) + style + 8) x Void", rounded down), except the
// elite mage's, which is added to the magic damage bonus.
import assert from "node:assert/strict";
import { installHooks } from "../tools/determinism/node-hooks.mjs";

// The client's import graph reaches a stylesheet; the harness's hooks make it an empty module.
installHooks();
globalThis.self ??= globalThis; // as the harness: PicoGL reads `self` when it loads
globalThis.location ??= { pathname: "/" };
const { getPlayerAccuracyRolls, getFormulaMaxHit } = await import("../client/engine/combatFormulas.js");

// Level 99 in all, a stance without a bonus, no attack bonus: the roll is the effective level times 64.
const player = (voidSet) => ({ kind: "player", levels: { attack: 99, strength: 99, defence: 99, ranged: 99, magic: 99 }, stance: "Other", voidSet, magicBaseMaxHit: 30 });
const monster = {
  kind: "npc",
  levels: { attack: 1, strength: 1, defence: 1, ranged: 1, magic: 1 },
  offensive: { atk: 0, str: 0, ranged: 0, rangedStr: 0, magic: 0, magicStr: 0 },
  defensive: { stab: 0, slash: 0, crush: 0, magic: 0, rangedLight: 0, rangedStandard: 0, rangedHeavy: 0 },
};
const gear = {
  attackStab: 0, attackSlash: 0, attackCrush: 0, attackMagic: 0, attackRanged: 0, defenceStab: 0, defenceSlash: 0, defenceCrush: 0, defenceMagic: 0, defenceRanged: 0,
  meleeStrength: 100, rangedStrength: 100, magicDamage: 0, prayer: 0, attackSpeed: 4, attackRange: 1,
};
const level = (voidSet, style) => getPlayerAccuracyRolls(player(voidSet), monster, style, gear).attackRoll / 64;
const maxHit = (voidSet, style) => getFormulaMaxHit(player(voidSet), style, gear);
// The maximum hit of an effective level with a strength bonus of 100.
const hit = (effectiveLevel) => Math.floor((effectiveLevel * 164 + 320) / 640);

// No set: 99 + 8.
assert.equal(level("none", "melee_slash"), 107);
assert.equal(level("none", "ranged"), 107);
assert.equal(maxHit("none", "melee_slash"), hit(107));
assert.equal(maxHit("none", "ranged"), hit(107));
assert.equal(maxHit("none", "magic"), 30);

// Melee: floor(107 x 1.1) = 117 for accuracy and for damage.
assert.equal(level("melee", "melee_slash"), 117);
assert.equal(maxHit("melee", "melee_slash"), hit(117));

// Ranged: 117 for both; elite the same accuracy and floor(107 x 1.125) = 120 for damage.
assert.equal(level("ranged", "ranged"), 117);
assert.equal(maxHit("ranged", "ranged"), hit(117));
assert.equal(level("elite_ranged", "ranged"), 117);
assert.equal(maxHit("elite_ranged", "ranged"), hit(120));

// Magic: the level times 1.45 before the constant is added, so floor(99 x 1.45) - 99 = 44 more; no damage.
assert.equal(level("magic", "magic") - level("none", "magic"), 44);
assert.equal(level("elite_magic", "magic") - level("none", "magic"), 44);
assert.equal(maxHit("magic", "magic"), 30);
// Elite: +5% magic damage, 30 x 1.05 = 31.5.
assert.equal(maxHit("elite_magic", "magic"), 31);

// A set helps its own style alone.
assert.equal(level("melee", "ranged"), 107);
assert.equal(level("ranged", "melee_slash"), 107);
assert.equal(level("magic", "melee_slash"), 107);
assert.equal(maxHit("melee", "ranged"), hit(107));
assert.equal(maxHit("elite_ranged", "melee_slash"), hit(107));
assert.equal(maxHit("elite_magic", "ranged"), hit(107));

console.log("Void: melee 10% and 10%, ranged 10% and 10% (12.5% elite), magic 45% accuracy (elite 5% damage).");
