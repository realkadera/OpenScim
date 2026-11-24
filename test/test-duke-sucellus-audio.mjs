// The gaze's sounds that the game's server sends (duke-sucellus/audio.js): the
// rules answer the gaze and no other event, and every sound they name is in the
// trimmed cache's list. One that is not in it throws nothing: it is silent
// (docs/ADDING-AN-ENCOUNTER.md, section 7).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dukeAudio } from "../client/encounters/duke-sucellus/audio.js";

const { resolve, preloadIds } = dukeAudio.rules.inferno_visual;
const visual = (animations, rest = {}) => ({ type: "inferno_visual", eventId: 1, tick: 9, animations, projectiles: [], graphics: [], ...rest });
const clip = (clipId, actorId = "duke-sucellus") => visual([{ actorId, clipId, delayCycles: 0 }]);
const sound = (id) => ({ kind: "play", sound: { id, channel: "sfx" } });

assert.deepEqual(resolve(clip("gaze")), sound(7215));
assert.deepEqual(resolve(visual([], { gazeAvoided: true })), sound(168));
for (const event of [clip("melee"), clip("gas"), clip("wake"), clip("gaze", "zebak"), visual([]), { type: "inferno_visual" }]) assert.deepEqual(resolve(event), { kind: "pass" });

const listed = new Set(JSON.parse(readFileSync(new URL("../tools/assets/cache-groups.json", import.meta.url), "utf8"))[4]);
assert.deepEqual(new Set(preloadIds), new Set([7215, 168]));
for (const id of preloadIds) assert.ok(listed.has(id), `sound ${id} is not under "4" in tools/assets/cache-groups.json`);
