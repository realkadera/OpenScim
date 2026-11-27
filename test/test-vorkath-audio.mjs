// Vorkath's sounds that the game's server sends (vorkath/audio.js): the rules answer her events and no others, and
// every sound they name is in the trimmed cache's list. One that is not in it throws nothing: it is silent
// (docs/ADDING-AN-ENCOUNTER.md, section 7). Then a whole kill of the harness, heard through the rules.
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readCacheGroups } from "../tools/assets/cache-groups.mjs";
import { cacheZip, loadEnvironment, loadScenarios, runScenario } from "../tools/determinism/harness.mjs";
import { installHooks } from "../tools/determinism/node-hooks.mjs";

const fights = existsSync(cacheZip);
if (fights) await loadEnvironment();
else installHooks();
for (const name of ["self", "window"]) globalThis[name] ??= globalThis;
const { vorkathAudio } = await import("../client/encounters/vorkath/audio.js");

const { inferno_visual: visual, hit_applied: hit, zuk_attack: attack, actor_died: died } = vorkathAudio.rules;
const pass = { kind: "pass" };
const play = (...sound) => ({ kind: "play", sound });
const everywhere = (id, delayCycles) => ({ id, ...(delayCycles ? { delayCycles } : {}), channel: "sfx" });
const from = (id, range, position, delayCycles) => ({ id, range, channel: "area", ...(delayCycles ? { delayCycles } : {}), position });
const event = (fields) => ({ type: "inferno_visual", eventId: 1, tick: 9, animations: [], projectiles: [], graphics: [], ...fields });
const clip = (clipId, actorId = "vorkath") => ({ animations: [{ actorId, clipId, delayCycles: 0 }] });
const thrown = (spotAnimId, x, y, endDelayCycles) => ({ spotAnimId, target: { kind: "tile", position: [x, y] }, endDelayCycles });
const drawn = (spotAnimId, x, y) => ({ spotAnimId, target: { kind: "tile", position: [x, y] }, height: 0, delayCycles: 0 });

// A shot or a breath: its start, its launch, and its impact as the flight ends.
for (const [kind, start, launch, impact] of [
  ["vorkath_ranged", everywhere(408, 10), everywhere(1965, 20), 3403],
  ["vorkath_magic", everywhere(408, 10), everywhere(222, 20), 223],
  ["vorkath_dragonfire", everywhere(3750, 15), everywhere(585), 156],
  ["vorkath_venom", everywhere(3750, 15), everywhere(587), 129],
  ["vorkath_prayer", everywhere(3750, 15), everywhere(284), 135],
  ["vorkath_ice", everywhere(3750, 15), everywhere(586), 168],
]) {
  assert.deepEqual(attack.resolve({ type: "zuk_attack", attack: kind, projectileArrivalCycles: 85 }), play(start, launch, everywhere(impact, 85)), kind);
  assert.deepEqual(attack.resolve({ type: "zuk_attack", attack: kind }), play(start, launch, everywhere(impact, 80)), kind);
}
assert.deepEqual(attack.resolve({ type: "zuk_attack", attack: "vorkath_melee" }), play(everywhere(1521)));
for (const kind of ["leviathan_magic", "duke_magic", undefined]) assert.deepEqual(attack.resolve({ type: "zuk_attack", attack: kind }), pass);

for (const [clipId, ...sounds] of [["wake", everywhere(1522, 25), everywhere(1518, 115)], ["high", everywhere(1519, 20)], ["acid", everywhere(736, 20)]])
  assert.deepEqual(visual.resolve(event(clip(clipId))), play(...sounds), clipId);
// The spawn is thrown with the fireball's animation under a name of its own: not the fireball's sound.
assert.deepEqual(visual.resolve(event(clip("throw"))), pass);
assert.deepEqual(visual.resolve(event({ projectiles: [thrown(1484, 24, 20, 120)] })), play(everywhere(1784, 28), from(232, 16, [24, 20], 120)));
assert.deepEqual(visual.resolve(event(clip("explode", "vorkath-spawn"))), play(everywhere(232), everywhere(208, 22)));
// One shot of rapid fire, and its landing on its tile; each pool of acid as it lands; the fireball on its tile.
assert.deepEqual(visual.resolve(event({ projectiles: [thrown(1482, 31, 22, 30)] })), play(everywhere(3749, 2)));
assert.deepEqual(visual.resolve(event({ graphics: [drawn(131, 31, 22)] })), play(from(158, 12, [31, 22])));
assert.deepEqual(
  visual.resolve(event({ ...clip("acid"), projectiles: [thrown(1483, 23, 24, 90), thrown(1483, 40, 41, 90)] })),
  play(everywhere(736, 20), from(3308, 5, [23, 24], 90), from(3308, 5, [40, 41], 90)),
);
assert.deepEqual(visual.resolve(event({ graphics: [drawn(1466, 32, 22)] })), play(from(163, 12, [32, 22])));
// A breath's impact on the player is the same graphic, on an actor: no fireball's sound.
const silent = [
  { graphics: [{ spotAnimId: 1466, target: { kind: "actor", actorId: "player" }, height: 124, delayCycles: 80 }] },
  clip("breath"), clip("melee"), clip("land", "vorkath-spawn"), clip("wake", "zebak"), clip("high", "leviathan"), {},
  { projectiles: [thrown(1481, 32, 22, 120)] },
];
for (const fields of silent) assert.deepEqual(visual.resolve(event(fields)), pass, JSON.stringify(fields));
assert.deepEqual(visual.resolve({ type: "inferno_visual" }), pass);

// A hit on her, of 0 too; a hit that hurts the spawn, and its going from its tile 3 ticks on.
for (const damage of [0, 12]) assert.deepEqual(hit.resolve({ type: "hit_applied", targetId: "vorkath", targetPosition: [29, 30], damage }), play(everywhere(410)));
assert.deepEqual(hit.resolve({ type: "hit_applied", targetId: "vorkath-spawn", targetPosition: [26, 21], damage: 38 }), play(everywhere(231), from(230, 12, [26, 21], 90)));
for (const other of [{ targetId: "vorkath-spawn", damage: 0 }, { targetId: "player", damage: 9 }, { targetId: "zebak", damage: 9 }])
  assert.deepEqual(hit.resolve({ type: "hit_applied", targetPosition: [1, 1], ...other }), pass);
assert.deepEqual(died.resolve({ type: "actor_died", actorId: "vorkath" }), play(everywhere(1523)));
for (const actorId of ["player", "vorkath-spawn", "zebak"]) assert.deepEqual(died.resolve({ type: "actor_died", actorId }), pass);

const listed = new Set(readCacheGroups()[4]);
const ids = Object.values(vorkathAudio.rules).flatMap((rule) => rule.preloadIds);
assert.deepEqual(
  [...new Set(ids)].sort((a, b) => a - b),
  [129, 135, 156, 158, 163, 168, 208, 222, 223, 230, 231, 232, 284, 408, 410, 585, 586, 587, 736, 1518, 1519, 1521, 1522, 1523, 1784, 1965, 3308, 3403, 3749, 3750],
);
for (const id of ids) assert.ok(listed.has(id), `sound ${id} is not under "4" in a list of tools/assets/cache-groups.mjs`);
console.log("Vorkath's 30 sounds answer her own events, and all are in the cache list");

if (!fights) console.log(`skipped the fight: ${cacheZip} is missing (npm run assets)`);
else {
  // The harness's whole kill with the crossbow: what is heard, through the rules.
  const scenario = (await loadScenarios("vorkath")).find(({ name }) => name === "vorkath/crossbow-kill");
  const heard = new Map();
  await runScenario(scenario, {
    onTick(tick, engine) {
      for (const each of engine.getLastTickEvents()) {
        const answer = vorkathAudio.rules[each.type]?.resolve(each);
        for (const { id } of answer?.kind === "play" ? answer.sound : []) heard.set(id, [...(heard.get(id) ?? []), tick]);
      }
    },
  });
  const times = (id) => heard.get(id)?.length ?? 0;
  assert.deepEqual([times(1522), times(1518), times(1523)], [1, 1, 1], "she wakes and dies once");
  // Every acid phase: its shots of rapid fire, each with its landing.
  assert.ok(times(736) >= 1, "no acid phase");
  assert.ok(times(3749) > 0 && times(3749) <= 25 * times(736), `${times(3749)} shots in ${times(736)} acid phases`);
  assert.equal(times(158), times(3749));
  assert.ok(times(3308) >= 50, "the pools of an acid phase land");
  // Every spawn: an icy breath, thrown, landed.
  assert.ok(times(1784) >= 1, "no spawn");
  assert.equal(times(232), times(1784));
  assert.equal(times(586), times(1784), "an icy breath before each");
  assert.ok(times(231) >= 1 && times(230) === times(231), "the spawn's going is heard");
  // A shot starts with one sound and a breath with another; each fireball lands.
  assert.equal(times(408), times(1965) + times(222));
  assert.equal(times(3750), times(585) + times(587) + times(284) + times(586));
  assert.equal(times(163), times(1519));
  assert.ok(times(410) > 20, "her hits are heard");
  console.log(`In a kill: ${times(736)} acid phases, ${times(1784)} spawns, ${times(1519)} fireballs and ${times(408) + times(3750)} shots and breaths are heard`);
}
process.exit(0);
