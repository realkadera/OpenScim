// Demonbane spells (client/engine/playerAttack/formula.js) against a demon:
// +20% accuracy; with Mark of Darkness +40% and +25% damage (WIKI: Demonbane
// spells). The purging staff doubles each: +40% accuracy without the mark,
// +80% and +50% damage with it (WIKI: Purging staff).
import assert from "node:assert/strict";
import { installHooks } from "../tools/determinism/node-hooks.mjs";

// The client's import graph reaches a stylesheet; the harness's hooks make it an empty module.
installHooks();
globalThis.self ??= globalThis; // as the harness: PicoGL reads `self` when it loads
globalThis.location ??= { pathname: "/" };
const { selectPlayerAttackProfile } = await import("../client/engine/playerAttack/profiles.js");

const PURGING_STAFF = 29594;
const KODAI_WAND = 21006;

const cast = (weaponId, markOfDarknessActive, targetAttributes = ["demon"]) =>
  selectPlayerAttackProfile({
    weaponId,
    formulaStyle: "magic",
    resources: { kind: "spell", spellId: "Dark Demonbane" },
    targetAttributes,
    markOfDarknessActive,
  });
const stages = (profile) => ({ accuracy: profile.hit.accuracy.attackRollStages ?? [], maxHit: profile.maxHit.stages ?? [] });
const percent = (n) => ({ numerator: 100 + n, denominator: 100 });

assert.deepEqual(stages(cast(KODAI_WAND, false)), { accuracy: [percent(20)], maxHit: [] });
assert.deepEqual(stages(cast(KODAI_WAND, true)), { accuracy: [percent(40)], maxHit: [percent(25)] });
assert.deepEqual(stages(cast(PURGING_STAFF, false)), { accuracy: [percent(40)], maxHit: [] });
assert.deepEqual(stages(cast(PURGING_STAFF, true)), { accuracy: [percent(80)], maxHit: [percent(50)] });

console.log("Demonbane spells: 20% accuracy, 40% and 25% damage marked; the purging staff doubles each, marked or not.");
