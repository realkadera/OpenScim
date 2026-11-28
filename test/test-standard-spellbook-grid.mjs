// The standard spellbook's grid: the whole book in level order, offered in the setup picker like the Ancient and
// Arceuus books, with every combat spell the engine casts among its combat spells and four icons a spell in the
// asset manifest.
import assert from "node:assert/strict";
import fs from "node:fs";
import { register } from "node:module";

// The client's import graph reaches a stylesheet; the harness's hooks make it an empty module.
register("../tools/determinism/node-hooks.mjs", import.meta.url);
globalThis.self ??= globalThis;
globalThis.location ??= { pathname: "/" };
const { combatSpells, getSpellIconName, isSupportedCombatSpell } = await import("../client/data/combatSpells.js");
const { getRequiredMagicLevel } = await import("../client/engine/spells.js");

const grid = fs.readFileSync(new URL("../client/assets/Grid.js", import.meta.url), "utf8");
const start = grid.indexOf("var STANDARD_GRID = [");
const block = grid.slice(start, grid.indexOf("];", start));
// Each entry is a spell of its own (IPe(icon, label, category, level, ...)) or one of the data's combat spells.
const spells = [...block.matchAll(/IPe\("([a-z_0-9]+)", "([^"]+)", "([a-z]+)", (\d+)|standardCombatSpell\("([^"]+)"\)/g)].map(
  ([, icon, label, category, level, combat]) =>
    combat
      ? { icon: getSpellIconName(combat), label: combat, category: "combat", level: getRequiredMagicLevel(combat) }
      : { icon, label, category, level: Number(level) },
);
assert.equal(spells.length, 75, "the whole book, not just its combat spells");
assert.match(grid, /iconDir: FPe\(\) \+ "\/normal_spell",\s*grid: STANDARD_GRID,\s*available: true,/);

// In level order, as the other books' grids.
assert.deepEqual(spells.map((spell) => spell.level), [...spells.map((spell) => spell.level)].sort((a, b) => a - b));

// Every combat spell of the book the engine casts is in it, as combat.
const labels = new Map(spells.map((spell) => [spell.label, spell]));
for (const spell of combatSpells.filter((each) => each.spellbook === "standard" && isSupportedCombatSpell(each.name))) {
  assert.equal(labels.get(spell.name)?.category, "combat", spell.name);
}

// Four icons each, from the manifest (npm run assets fetches them).
const manifest = new Set(JSON.parse(fs.readFileSync(new URL("../tools/assets/manifest.json", import.meta.url), "utf8")).files.map((file) => file.path));
for (const { icon } of spells) {
  for (const suffix of ["", "_resized", "_disabled", "_disabled_resized"]) {
    const path = `assets/ui/packs/pack-vanilla/spells/normal_spell/${icon}${suffix}.png`;
    assert.ok(manifest.has(path), path);
  }
}
console.log(`Standard spellbook grid: ${spells.length} spells, every supported combat spell among them, each with its four icons.`);
