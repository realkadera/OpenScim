// The sandbox's scenario format (client/encounters/sandbox/scenario.js):
// share codes and files read back what was written, bad input is refused
// with a message, and the twenty-six examples are valid. Plain Node, no browser.
import assert from "node:assert/strict";
import { loadEnvironment } from "../tools/determinism/harness.mjs";

// scenario.js takes pako from vendor.js, which Node loads through the harness's module hooks.
await loadEnvironment();
const scenario = await import("../client/encounters/sandbox/scenario.js");
const { sandboxExamples } = await import("../client/encounters/sandbox/examples.js");
const { sandboxArenas } = await import("../client/encounters/sandbox/arenas.js");

const { normalizeScenario, encodeShareCode, decodeShareCode, importScenarioText, scenarioToJson, ScenarioError } = scenario;

// Twenty-six examples, every one valid, in more than one arena: thirteen against the
// player and thirteen free-for-alls (the editor shows those of the mode chosen).
assert.equal(sandboxExamples.length, 26);
assert.equal(new Set(sandboxExamples.map((entry) => entry.key)).size, 26);
assert.ok(new Set(sandboxExamples.map((entry) => entry.scenario.arena)).size >= 6);
assert.equal(sandboxExamples.filter((entry) => entry.scenario.mode === "versus").length, 13);
assert.equal(sandboxExamples.filter((entry) => entry.scenario.mode === "ffa").length, 13);
// Few Sol Heredits and Yamas (their hitpoints make long fights); some with
// boulders, some with the arena's own boss, some with teams.
const using = (id) => sandboxExamples.filter((entry) => entry.scenario.npcs.some((npc) => npc.npc === id)).length;
assert.ok(using("sol_heredit") <= 2 && using("yama") <= 2);
assert.ok(sandboxExamples.filter((entry) => entry.scenario.obstacles).length >= 4);
assert.ok(sandboxExamples.filter((entry) => entry.scenario.options.bossMechanics).length >= 3);
assert.ok(sandboxExamples.filter((entry) => entry.scenario.npcs.some((npc) => npc.team)).length >= 5);
for (const { scenario: example } of sandboxExamples) assert.deepEqual(normalizeScenario(example), example);

// A share code, a link that carries one, and the JSON all read back the same scenario.
for (const { scenario: example } of sandboxExamples) {
  const code = encodeShareCode(example);
  assert.match(code, /^OSB1\.[\w-]+$/);
  assert.deepEqual(decodeShareCode(code), example);
  assert.deepEqual(importScenarioText(`https://openscim.dev/sandbox/${example.arena}#sbx=${code}`), example);
  assert.deepEqual(importScenarioText(scenarioToJson(example)), example);
}

// What is filled in, and what is dropped.
const minimal = normalizeScenario({ arena: "yama", npcs: [{ npc: "inferno.bat", position: [30, 30], hp: 5.5, team: "  red ", levels: { magic: 99, nonsense: 1 } }] });
assert.equal(minimal.format, "openscim-sandbox");
assert.equal(minimal.version, 1);
assert.equal(minimal.mode, "versus");
assert.equal(minimal.meta.name, "Untitled");
assert.deepEqual(minimal.options, { playerStart: null, ffaIncludesPlayer: true, bossMechanics: false, countdownTicks: 3 });
assert.deepEqual(minimal.npcs, [{ id: "npc-1", npc: "inferno.bat", position: [30, 30], team: "red", levels: { magic: 99 } }]);

// Refused, each with a message.
const refuses = (input, pattern) => assert.throws(() => normalizeScenario(input), (error) => error instanceof ScenarioError && pattern.test(error.message));
refuses(null, /JSON object/);
refuses({ arena: "nowhere" }, /Unknown arena/);
refuses({ arena: "yama", version: 99 }, /version 99/);
refuses({ arena: "yama", format: "other" }, /Not a sandbox scenario/);
refuses({ arena: "yama", npcs: [{ npc: "nobody", position: [1, 1] }] }, /unknown NPC/);
refuses({ arena: "yama", npcs: [{ npc: "inferno.bat", position: [1] }] }, /position/);
refuses({ arena: "yama", npcs: Array.from({ length: 41 }, () => ({ npc: "inferno.bat", position: [1, 1] })) }, /At most 40/);
refuses({ arena: "yama", obstacles: Array.from({ length: 61 }, () => [1, 1]) }, /At most 60/);
refuses({ arena: "yama", obstacles: [[1]] }, /Obstacle 1/);
// The countdown: 3 ticks unless said, 0 to 10.
assert.equal(normalizeScenario({ arena: "yama", options: { countdownTicks: 7 } }).options.countdownTicks, 7);
assert.equal(normalizeScenario({ arena: "yama", options: { countdownTicks: 99 } }).options.countdownTicks, 3);
assert.deepEqual(normalizeScenario({ arena: "yama", obstacles: [[30, 30]] }).obstacles, [[30, 30]]);
// A low obstacle keeps its kind; any other third value is a boulder.
assert.deepEqual(normalizeScenario({ arena: "yama", obstacles: [[30, 30, "low"], [31, 30, "tall"]] }).obstacles, [[30, 30, "low"], [31, 30]]);
assert.throws(() => decodeShareCode("OSB1.!!!"), ScenarioError);
assert.throws(() => decodeShareCode("OSB1.AAAA"), ScenarioError);
assert.throws(() => importScenarioText("{ not json"), /Not valid JSON/);

// A share code is refused past its limits before it can exhaust the page:
// longer than a scenario's code can be, or inflating past 64 KB (an 8 MB
// run of spaces deflates to a code under the length limit's reach).
const { pako } = await import("../client/assets/vendor.js");
const deflatedCode = (bytes) => "OSB1." + Buffer.from(pako.deflateRaw(bytes, { level: 9 })).toString("base64url");
assert.throws(() => decodeShareCode("OSB1." + "A".repeat(scenario.maxShareCodeLength)), /too long/);
const bomb = deflatedCode(new Uint8Array(8 * 1024 * 1024).fill(32));
assert.ok(bomb.length < scenario.maxShareCodeLength);
const bombStart = Date.now();
assert.throws(() => decodeShareCode(bomb), /more than a scenario/);
assert.ok(Date.now() - bombStart < 2000);
assert.throws(() => decodeShareCode(deflatedCode(new TextEncoder().encode(" ".repeat(scenario.maxScenarioJsonBytes + 1)))), /more than a scenario/);

// The import box goes by the first character: a JSON scenario whose texts
// mention a link is that scenario, not the linked one.
const mentionsLink = { ...minimal, meta: { ...minimal.meta, description: `Like ${"#sbx=" + encodeShareCode(sandboxExamples[0].scenario)}` } };
assert.deepEqual(importScenarioText(JSON.stringify(mentionsLink)), normalizeScenario(mentionsLink));
assert.throws(() => importScenarioText("hello"), ScenarioError);

// Gear supplies keep only what the application reads of them, as it parses them.
const supplied = normalizeScenario({
  arena: "yama",
  gear: {
    supplies: {
      equippedAmmo: { id: 11212, extra: true },
      quiverAmmo: "nonsense",
      runePouch: { kind: "standard", slots: [{ id: 560 }, null, { id: 565, junk: 1 }] },
      spellbook: "ancient",
      selectedSpell: "Ice Barrage",
      script: "<img src=x>",
      nested: { deep: [1, 2, 3] },
    },
  },
});
assert.deepEqual(supplied.gear.supplies, {
  equippedAmmo: { id: 11212 },
  runePouch: { kind: "standard", slots: [{ id: 560 }, null, { id: 565 }] },
  spellbook: "ancient",
  selectedSpell: "Ice Barrage",
});

// Every arena is a variant of the sandbox with a route.
assert.equal(sandboxArenas.length, new Set(sandboxArenas.map((arena) => arena.id)).size);

console.log("sandbox scenario format: ok");
process.exit(0);
