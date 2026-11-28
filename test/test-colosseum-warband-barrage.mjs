// Ice Barrage on a Fremennik warbander (Quartet, in Sol Heredit's fight). The
// wiki: +104 magic attack bonus with Augury, or +140 without, guarantees the
// freeze on each of the three, but not a max hit; and "The only exception is
// Ice Barrage on the berserker" to its magic weakness (always hit, max hit).
// A fight of the harness, no browser: one barrage per seed, the moment the
// warbander is there.
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { test } from "node:test";
import { cacheZip, runScenario } from "../tools/determinism/harness.mjs";
import { castOn, magicGear, rangedGear } from "../tools/determinism/scenarios/common.mjs";

const WARBANDER = "sol_quartet_warbander";
const rune = { water: 555, blood: 565, death: 560 };
const ancients = { spellbook: "ancient", runePouch: { kind: "divine", slots: [{ id: rune.water }, { id: rune.blood }, { id: rune.death }] } };
const level = (value) => ({ current: value, max: value });
const stats = { ...Object.fromEntries(["attack", "strength", "defence", "ranged", "magic", "prayer", "hitpoints"].map((skill) => [skill, level(99)])) };
const seeds = Array.from({ length: 24 }, (_, index) => index + 1);

// One barrage at a fresh warbander: its role, whether it was frozen, and the damage of the cast.
async function barrage(seed, gear) {
  let cast = null;
  let result = null;
  await runScenario({
    name: "warband-barrage",
    kind: "sol_heredit",
    seed,
    ticks: 30,
    mechanics: { infiniteHealth: true },
    options: { modifiers: { quartet: 1 } },
    stats,
    ...gear,
    supplies: { ...gear.supplies, ...ancients },
    script(tick, api) {
      const warbander = api.npcs().find((npc) => npc.id === WARBANDER);
      if (!warbander || result) return;
      if (cast === null) {
        castOn(api, WARBANDER, "Ice Barrage");
        cast = { hp: warbander.vitals.hp, tick };
        return;
      }
      // The freeze starts as the spell is cast, the damage lands a few ticks on.
      cast.frozen ||= warbander.debuffs?.boundUntilTick !== undefined;
      if (tick >= cast.tick + 8) {
        result = { role: warbander.archetypeId.replace("colosseum_warband_", ""), frozen: cast.frozen, damage: cast.hp - warbander.vitals.hp };
      }
    },
  });
  assert.ok(result, `seed ${seed}: the barrage was cast and watched`);
  return result;
}

const skip = !existsSync(cacheZip) && `${cacheZip} is missing (npm run assets)`;

test("enough magic attack bonus: every barrage freezes every warbander, not always for a max hit", { skip }, async () => {
  const results = [];
  for (const seed of seeds) results.push(await barrage(seed, magicGear));
  const roles = new Set(results.map((result) => result.role));
  assert.deepEqual([...roles].sort(), ["archer", "berserker", "seer"], "the seeds give all three roles");
  for (const [index, result] of results.entries()) assert.ok(result.frozen, `seed ${seeds[index]}: the ${result.role} is frozen`);
  const berserkerDamages = new Set(results.filter((result) => result.role === "berserker").map((result) => result.damage));
  assert.ok(berserkerDamages.size > 1, `the berserker is not max hit every time: ${[...berserkerDamages]}`);
});

test("no magic attack bonus: a barrage can miss, the berserker too", { skip }, async () => {
  const results = [];
  for (const seed of seeds) results.push(await barrage(seed, rangedGear));
  const missedBerserker = results.some((result) => result.role === "berserker" && !result.frozen);
  assert.ok(missedBerserker, `a barrage misses a berserker: ${JSON.stringify(results)}`);
});
