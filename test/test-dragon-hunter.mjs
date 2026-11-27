// Dragon hunter weapons (client/engine/playerAttack/formula.js, profiles.js)
// against a monster with the dragon attribute (WIKI: Draconic (attribute)):
// the crossbow +30% accuracy and +25% damage, added to a Slayer helmet (i)'s
// 15%; the lance +20% and +20%, multiplied with the helmet's; the wand +75%
// and +40% on its spells, multiplied with the helmet's. Elvarg, the revenant
// dragon and Zulrah are not affected.
import assert from "node:assert/strict";
import { installHooks } from "../tools/determinism/node-hooks.mjs";

// The client's import graph reaches a stylesheet; the harness's hooks make it an empty module.
installHooks();
globalThis.self ??= globalThis; // as the harness: PicoGL reads `self` when it loads
globalThis.location ??= { pathname: "/" };
const { selectPlayerAttackProfile } = await import("../client/engine/playerAttack/profiles.js");
const { monsterByNpcTypeId } = await import("../client/data/monsters.js");

const CROSSBOW = 21012;
const CROSSBOW_T = 25916;
const CROSSBOW_B = 25918;
const LANCE = 22978;
const WAND = 30070;
const RUNE_CROSSBOW = 9185;
const SLAYER_HELMET_I = 11865;
const DRAGON = ["dragon"];

const bolts = { kind: "ammo", ammoId: 21905 }; // Dragon bolts
const spell = { kind: "spell", spellId: "Fire Surge" };
const profile = (weaponId, formulaStyle, resources, targetAttributes, extra = {}) =>
  selectPlayerAttackProfile({ weaponId, formulaStyle, resources, targetAttributes, ...extra });
const stages = (found) => ({ accuracy: found.hit.accuracy.attackRollStages ?? [], maxHit: found.maxHit.stages ?? [] });
const percent = (n) => ({ numerator: 100 + n, denominator: 100 });
const value = (ratios) => ratios.reduce((product, ratio) => (product * ratio.numerator) / ratio.denominator, 1);
const helmet = { numerator: 23, denominator: 20 }; // the Slayer helmet (i)'s 15% on ranged and magic
const meleeHelmet = { numerator: 7, denominator: 6 };
const on = { headId: SLAYER_HELMET_I };

// The crossbow and its two ornament kits.
for (const crossbow of [CROSSBOW, CROSSBOW_T, CROSSBOW_B]) {
  assert.deepEqual(stages(profile(crossbow, "ranged", bolts, DRAGON)), { accuracy: [percent(30)], maxHit: [percent(25)] });
}
// With the Slayer helmet (i): 15 + 30 and 15 + 25, one stage each.
const crossbowOnTask = stages(profile(CROSSBOW, "ranged", bolts, DRAGON, on));
assert.equal(crossbowOnTask.accuracy.length, 1);
assert.equal(crossbowOnTask.maxHit.length, 1);
assert.equal(value(crossbowOnTask.accuracy), 1.45);
assert.equal(value(crossbowOnTask.maxHit), 1.4);
// Not a dragon: the helmet alone. Another crossbow on a dragon: the helmet alone.
assert.deepEqual(stages(profile(CROSSBOW, "ranged", bolts, [], on)), { accuracy: [helmet], maxHit: [helmet] });
assert.deepEqual(stages(profile(RUNE_CROSSBOW, "ranged", bolts, DRAGON, on)), { accuracy: [helmet], maxHit: [helmet] });
assert.deepEqual(stages(profile(CROSSBOW, "ranged", bolts, [])), { accuracy: [], maxHit: [] });

// The lance, and with the helmet: its stage first, then the lance's.
assert.deepEqual(stages(profile(LANCE, "melee_stab", { kind: "none" }, DRAGON)), { accuracy: [percent(20)], maxHit: [percent(20)] });
assert.deepEqual(stages(profile(LANCE, "melee_stab", { kind: "none" }, DRAGON, on)), { accuracy: [meleeHelmet, percent(20)], maxHit: [meleeHelmet, percent(20)] });
assert.deepEqual(stages(profile(LANCE, "melee_stab", { kind: "none" }, [])), { accuracy: [], maxHit: [] });

// The wand's spells, and with the helmet: its stage first, then the wand's.
assert.deepEqual(stages(profile(WAND, "magic", spell, DRAGON)), { accuracy: [percent(75)], maxHit: [percent(40)] });
assert.deepEqual(stages(profile(WAND, "magic", spell, DRAGON, on)), { accuracy: [helmet, percent(75)], maxHit: [helmet, percent(40)] });
assert.deepEqual(stages(profile(WAND, "magic", spell, [])), { accuracy: [], maxHit: [] });
// A blow with the wand is a blow like any other, and not refused.
assert.deepEqual(stages(profile(WAND, "melee_crush", { kind: "none" }, DRAGON)), { accuracy: [], maxHit: [] });
// A spell cast by hand with the crossbow or the lance on has no bonus, the helmet's apart.
assert.deepEqual(stages(profile(CROSSBOW, "magic", spell, DRAGON)), { accuracy: [], maxHit: [] });
assert.deepEqual(stages(profile(LANCE, "magic", spell, DRAGON)), { accuracy: [], maxHit: [] });
assert.deepEqual(stages(profile(CROSSBOW, "magic", spell, DRAGON, on)), { accuracy: [helmet], maxHit: [helmet] });

// The monster table: the excluded three are not dragons to it, the others are.
const monsters = [...new Set(monsterByNpcTypeId.values())];
const attributesOf = (name) => monsters.filter((monster) => monster.name === name).map((monster) => monster.attributes ?? []);
for (const name of ["Elvarg", "Revenant dragon", "Zulrah"]) {
  assert.ok(attributesOf(name).length > 0, name);
  assert.ok(attributesOf(name).every((attributes) => !attributes.includes("dragon")), name);
}
for (const name of ["Vorkath", "Great Olm", "Alchemical Hydra", "Wyrm", "Drake", "Skeletal Wyvern"]) {
  assert.ok(attributesOf(name).length > 0, name);
  assert.ok(attributesOf(name).every((attributes) => attributes.includes("dragon")), name);
}

console.log("Dragon hunter: crossbow 30/25 added to the helmet's, lance 20/20 and wand 75/40 multiplied; Elvarg, revenant dragon and Zulrah apart.");
