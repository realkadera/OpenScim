// Scurrius' sounds that the game's server sends (scurrius/audio.js): the rules
// answer his events and no others, and every sound they name is in the trimmed
// cache's list. One that is not in it throws nothing: it is silent
// (docs/ADDING-AN-ENCOUNTER.md, section 7).
import assert from "node:assert/strict";
import { register } from "node:module";
import { readCacheGroups } from "../tools/assets/cache-groups.mjs";

// encounter.js imports what Node loads only through the harness's hooks.
register(new URL("../tools/determinism/node-hooks.mjs", import.meta.url).href);
for (const name of ["self", "window"]) globalThis[name] ??= globalThis;
const { scurriusAudio } = await import("../client/encounters/scurrius/audio.js");

const { inferno_visual: visual, zuk_attack: attack } = scurriusAudio.rules;
const pass = { kind: "pass" };
const play = (...sound) => ({ kind: "play", sound });
const event = (fields) => ({ type: "inferno_visual", eventId: 1, tick: 9, animations: [], projectiles: [], graphics: [], ...fields });
const clip = (clipId, actorId = "scurrius") => [{ actorId, clipId, delayCycles: 0 }];
const onTile = (spotAnimId, x, y) => ({ spotAnimId, target: { kind: "tile", position: [x, y] }, height: 0, delayCycles: 60, onGround: true });
const onPlayer = (spotAnimId) => ({ spotAnimId, target: { kind: "actor", actorId: "player" }, height: 0, delayCycles: 0 });
const stomp = [7699, 7667].map((id) => ({ id, range: 9, position: [34, 11], channel: "area" }));
const brick = (x, y) => ({ id: 4175, range: 5, delayCycles: 240, channel: "area", position: [x, y] });

// A bolt (heard on through its flight) and a fur ball as he casts them; nothing for his swipe or another fight's attacks.
assert.deepEqual(attack.resolve({ type: "zuk_attack", attack: "scurrius_magic" }), play({ id: 7700, channel: "sfx" }));
assert.deepEqual(attack.resolve({ type: "zuk_attack", attack: "scurrius_ranged" }), play({ id: 7722, channel: "sfx" }));
for (const kind of ["scurrius_melee", "leviathan_magic", "leviathan_range", undefined]) assert.deepEqual(attack.resolve({ type: "zuk_attack", attack: kind }), pass, String(kind));

// His call of the rats, at a pile or in the middle: from the middle of the room, 90 cycles on.
for (const clipId of ["feedingSummon", "enragedSummon"]) {
  assert.deepEqual(visual.resolve(event({ animations: clip(clipId) })), play({ id: 7717, range: 9, position: [34, 11], delayCycles: 90, channel: "area" }), clipId);
}

// A stomp, at a pile or not: the two sounds from the middle, and a brick on each tile of rubble as it lands.
for (const clipId of ["stomp", "feedingStomp"]) {
  assert.deepEqual(visual.resolve(event({ animations: clip(clipId), graphics: [onTile(2644, 30, 8), onTile(2644, 40, 15)] })), play(...stomp, brick(30, 8), brick(40, 15)), clipId);
}
// A bolt that hits, one that splashes, a fur ball: as he marks them landing.
for (const [id, sound] of [[2641, 7670], [85, 227], [2643, 7696]]) {
  assert.deepEqual(visual.resolve(event({ graphics: [onPlayer(id)], scurriusLanding: true })), play({ id: sound, channel: "sfx" }), String(id));
}
// Not his: another fight's stomp or splash, rubble with no stomp of his, the casts themselves.
const silent = [
  { animations: clip("stomp", "zebak") },
  { animations: clip("enragedSummon", "zebak") },
  { graphics: [onPlayer(85)] },
  { graphics: [onTile(2644, 30, 8)] },
  { animations: clip("melee") },
  { graphics: [onPlayer(2639)], scurriusLanding: true },
  {},
];
for (const fields of silent) assert.deepEqual(visual.resolve(event(fields)), pass, JSON.stringify(fields));
assert.deepEqual(visual.resolve({ type: "inferno_visual" }), pass);

const listed = new Set(readCacheGroups()[4]);
const ids = Object.values(scurriusAudio.rules).flatMap((rule) => rule.preloadIds);
assert.deepEqual([...new Set(ids)].sort((a, b) => a - b), [227, 4175, 7667, 7670, 7696, 7699, 7700, 7717, 7722]);
for (const id of ids) assert.ok(listed.has(id), `sound ${id} is not under "4" in a list of tools/assets/cache-groups.mjs`);
console.log("Scurrius' 9 sounds answer his own events, and all are in the cache list");
