// Five rules of the Doom of Mokhaiotl's room from a tester's report, each on
// the encounter alone with a small stand-in for the engine's context:
// - delve 8: the second rock never marks a tile of the first's, even with the player on one;
// - a demonbane (or Eye of Ayak) hit takes 2 from a larva, so a giant takes two;
// - every hit on volatile earth lands, for at least 1;
// - a rock the car slam breaks still shelters the rocks behind it from that slam;
// - no melee charge while the volatile earth is up.
import assert from "node:assert/strict";
import { installHooks } from "../tools/determinism/node-hooks.mjs";

installHooks();
for (const name of ["self", "window"]) globalThis[name] ??= globalThis; // PicoGL reads `self` as it loads
const { doomDefinition, doomDeepKind } = await import("../client/encounters/doom-of-mokhaiotl/encounter.js");
const { spotAnims, bossStart, bossSize } = await import("../client/encounters/doom-of-mokhaiotl/delves.js");

const key = ([x, y]) => x + "," + y;
const scorchingBow = 29591; // demonbane
const eyeOfAyak = 31113;
const twistedBow = 20997;

// A delve's encounter with a context that keeps its NPCs and the visuals it emits.
function room(delve, seed) {
  const doom = doomDefinition.variantFactories[doomDeepKind]();
  doom.reset({ encounterSeed: seed });
  const npcs = new Map(doom.createNpcs().map((npc) => [npc.id, npc]));
  const player = { id: "player", kind: "player", alive: true, position: [31, 28] };
  const events = [];
  const context = {
    tick: 0,
    world: { getPlayer: () => player, getNpc: (id) => npcs.get(id), getNpcs: () => [...npcs.values()], actors: npcs },
    tickEvents: { emit: (event) => events.push(event) },
    spawnNpc: (npc) => npcs.set(npc.id, npc),
    despawnNpc: (id) => npcs.delete(id),
    teleportPlayer: (tile) => (player.position = [...tile]),
    queueNpcHit: () => {},
  };
  doom.configureRunStart({ doomDelve: String(delve) }, context);
  doom.now = 0;
  doom.world = context.world;
  return { doom, context, player, events, npcs };
}
const shadows = (events) =>
  events.flatMap((event) => (event.type === "inferno_visual" ? event.graphics : []))
    .filter((graphic) => graphic.spotAnimId === spotAnims.debrisShadow).map((graphic) => key(graphic.target.position));

// Delve 8. The first rock bursts on the player; then the player steps onto
// one of its shadows (too early) and the second bursts.
let steppedOn = 0;
for (let seed = 1; seed <= 200; seed++) {
  const { doom, context, player, events } = room(8, seed);
  const at = [31, 31];
  player.position = [31, 26];
  doom.rocks.burst(at, "range", context, 0);
  const first = new Set(shadows(events));
  const onto = [...first].find((tile) => tile !== key(player.position));
  if (!onto) continue;
  player.position = onto.split(",").map(Number);
  steppedOn++;
  events.length = 0;
  doom.rocks.burst(at, "range", context, 1);
  const second = shadows(events);
  assert.ok(second.length > 0, "the second rock bursts");
  assert.deepEqual(second.filter((tile) => first.has(tile)), [], `seed ${seed}: the second rock's tiles miss the first's`);
  assert.ok(!second.includes(onto), `seed ${seed}: standing on the first's shadow, the second does not mark the player`);
}
assert.ok(steppedOn > 150, "most seeds put the player on a first shadow");

// Larvae: 2 a hit from demonbane or the Eye, at most 1 from anything else.
{
  const { doom, context } = room(8, 7);
  doom.larvae.spawnOne(context, [24, 40], { npcTypeId: 14788, style: "range", giant: true });
  doom.larvae.spawnOne(context, [26, 44], { npcTypeId: 14712, style: "magic" });
  const [giant, magicLarva] = context.world.getNpcs().filter((npc) => doom.larvae.isLarva(npc));
  assert.equal(giant.vitals.hp, 4);
  assert.equal(giant.formulaStats.alwaysAccuratePlayerHit, true, "the player's hits on larvae land");
  const hit = (damage, target, attack) => doom.getEngineRules().playerDamageOnNpc(damage, { attacker: context.world.getPlayer(), target, attack });
  assert.equal(hit(30, giant, { style: "range", weaponId: scorchingBow }), 2, "a demonbane hit takes 2 of a giant's 4");
  assert.equal(hit(1, giant, { style: "range", weaponId: scorchingBow }), 2, "however low it rolled");
  assert.equal(hit(30, giant, { style: "range", weaponId: twistedBow }), 1, "another bow's, 1");
  assert.equal(hit(30, giant, { style: "magic", weaponId: scorchingBow }), 0, "the style it prays against, none");
  assert.equal(hit(30, magicLarva, { style: "magic", weaponId: eyeOfAyak }), 2, "the Eye of Ayak's, 2");
}

// Volatile earth: every hit lands, for at least its 1 hitpoint.
{
  const { doom, context } = room(5, 3);
  doom.shockwave.start(context);
  const earth = context.world.getNpcs().find((npc) => doom.shockwave.earth.has(npc.id));
  assert.ok(earth, "volatile earth comes up");
  assert.equal(earth.formulaStats.alwaysAccuratePlayerHit, true, "the player's hits on volatile earth land");
  const hit = (damage) => doom.getEngineRules().playerDamageOnNpc(damage, { attacker: context.world.getPlayer(), target: earth, attack: { style: "range", weaponId: twistedBow } });
  assert.equal(hit(0), 1, "a roll of 0 still breaks it");
  assert.equal(hit(25), 25);
}

// The car slam: a rock in front of another, as seen from his centre. The
// front one crumbles, the one behind it stands; one in the open crumbles.
{
  const { doom, context, npcs } = room(6, 11);
  doom.burrow.start(context);
  doom.burrow.burrow(context);
  const centre = [bossStart[0] + (bossSize >> 1), bossStart[1] + (bossSize >> 1)];
  for (const tile of doom.rocks.standing) doom.rocks.crumble(tile.split(",").map(Number), context);
  const front = [centre[0] + 4, centre[1]];
  const behind = [centre[0] + 7, centre[1]];
  const open = [centre[0], centre[1] + 6];
  for (const tile of [front, behind, open]) doom.rocks.place(tile);
  context.world.getPlayer().position = [centre[0] - 6, centre[1]];
  assert.equal(npcs.get("doom").npcTypeId, 14709, "he is burrowed");
  doom.burrow.slam(context);
  assert.deepEqual([doom.rocks.has(front), doom.rocks.has(behind), doom.rocks.has(open)], [false, true, false]);
}

// No melee charge while the volatile earth is up: from delve 5 a rock throw
// 5 ticks after he surfaces would charge as it comes up.
{
  const { doom, context } = room(5, 5);
  doom.phase = "attacks";
  doom.shockwave.start(context);
  doom.startCharge(context);
  assert.equal(doom.charge, null, "no charge with the earth up");
  doom.shockwave.reset();
  doom.startCharge(context);
  assert.notEqual(doom.charge, null, "a charge otherwise");
}

console.log(`Doom's room: delve 8's second rock missed the first's tiles in ${steppedOn} bursts with the player on one; demonbane takes 2 from larvae; volatile earth always breaks; a broken rock shelters the one behind; no melee charge with the earth up`);
