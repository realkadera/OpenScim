// client/util/combatLevelColor.js against the wiki's table of colours
// (https://oldschool.runescape.wiki/w/Combat_level), and the client's combat
// level (client/engine/playerState.js getCombatLevel) against the formula.
import assert from "node:assert/strict";

import { combatLevelColor } from "../client/util/combatLevelColor.js";
import { getCombatLevel } from "../client/engine/playerState.js";

// The table's rows: the other's level minus your own, and its colour.
for (const [diff, color] of [
  [10, "#ff0000"],
  [30, "#ff0000"],
  [9, "#ff3000"],
  [6, "#ff7000"],
  [3, "#ffb000"],
  [0, "#ffff00"],
  [-1, "#c0ff00"],
  [-4, "#80ff00"],
  [-7, "#40ff00"],
  [-10, "#00ff00"],
  [-90, "#00ff00"],
])
  assert.equal(combatLevelColor(100, 100 + diff), color, `difference ${diff}`);
// The bands between the rows are three levels wide.
assert.equal(combatLevelColor(100, 107), "#ff3000");
assert.equal(combatLevelColor(100, 104), "#ff7000");
assert.equal(combatLevelColor(100, 101), "#ffb000");
assert.equal(combatLevelColor(100, 97), "#c0ff00");
assert.equal(combatLevelColor(100, 94), "#80ff00");
assert.equal(combatLevelColor(100, 91), "#40ff00");
assert.equal(combatLevelColor(undefined, 50), "#ffff00");

// Base levels (max), not boosted ones: 3 for a new account, 126 at the most.
const stats = (levels) => Object.fromEntries(Object.entries(levels).map(([skill, max]) => [skill, { current: 1, max }]));
assert.equal(getCombatLevel(stats({ attack: 1, strength: 1, defence: 1, ranged: 1, magic: 1, prayer: 1, hitpoints: 10 })), 3);
assert.equal(getCombatLevel(stats({ attack: 99, strength: 99, defence: 99, ranged: 99, magic: 99, prayer: 99, hitpoints: 99 })), 126);
assert.equal(getCombatLevel(stats({ attack: 1, strength: 1, defence: 1, ranged: 99, magic: 1, prayer: 1, hitpoints: 10 })), 50);
console.log("Combat level colour passed");
