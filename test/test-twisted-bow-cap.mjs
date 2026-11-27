// The twisted bow (client/engine/playerAttack/formula.js) scales with the
// target's Magic, counted up to 250, and up to 350 against a monster of the
// Chambers of Xeric (WIKI: Twisted bow; the monster table's attribute
// "xerician"). Accuracy never passes 140%.
import assert from "node:assert/strict";
import { installHooks } from "../tools/determinism/node-hooks.mjs";

// The client's import graph reaches a stylesheet; the harness's hooks make it an empty module.
installHooks();
globalThis.self ??= globalThis; // as the harness: PicoGL reads `self` when it loads
globalThis.location ??= { pathname: "/" };
const { selectPlayerAttackProfile } = await import("../client/engine/playerAttack/profiles.js");

const TWISTED_BOW = 20997;

const shot = (targetMagicLevel, targetAttributes) =>
  selectPlayerAttackProfile({
    weaponId: TWISTED_BOW,
    formulaStyle: "ranged",
    resources: { kind: "ammo", ammoId: 11212 }, // Dragon arrow
    targetAttributes,
    targetMagicLevel,
    targetMagicAttackBonus: 0,
  });
const percents = (profile) => [profile.hit.accuracy.attackRollStages[0].numerator, profile.maxHit.stages[0].numerator];

// WIKI's curves at 250 Magic: 140% accuracy (the cap), 215% damage.
assert.deepEqual(percents(shot(250, [])), [140, 215]);
// Outside the Chambers, Magic over 250 counts as 250.
assert.deepEqual(percents(shot(350, [])), [140, 215]);
assert.deepEqual(percents(shot(350, ["demon"])), [140, 215]);
// In the Chambers it counts up to 350: 248% damage at 350, and no more above it.
assert.deepEqual(percents(shot(250, ["xerician"])), [140, 215]);
assert.deepEqual(percents(shot(300, ["xerician"])), [140, 233]);
assert.deepEqual(percents(shot(350, ["xerician"])), [140, 248]);
assert.deepEqual(percents(shot(500, ["xerician"])), [140, 248]);

console.log("Twisted bow: Magic counted to 250, to 350 against a monster of the Chambers of Xeric.");
