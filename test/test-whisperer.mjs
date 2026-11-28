// The Whisperer's rules as the wiki and RSPSApp's recordings have them (client/encounters/whisperer/), asserted on the
// determinism harness's scenarios (tools/determinism/scenarios/whisperer.mjs). Their digests say that nothing changed;
// this says what it is.
import assert from "node:assert/strict";
import { runScenario } from "../tools/determinism/harness.mjs";
import { scenarios } from "../tools/determinism/scenarios/whisperer.mjs";
import { seedLayout } from "../client/encounters/whisperer/data.js";

const BOSS = "whisperer";
const spots = { ranged: 2444, magic: 2445, bind: 2467 };

// Each tick: her type, place and hitpoints, the player's tile and inventory, the snapshot, the shots she fired, the
// tentacles standing, the hits on the player, the messages.
async function ticksOf(name) {
  const ticks = [];
  await runScenario(scenarios.find((scenario) => scenario.name === "whisperer/" + name), {
    onTick(tick, engine) {
      const events = engine.getLastTickEvents();
      const visuals = events.filter((event) => event.type === "inferno_visual");
      const boss = engine.worldState.getNpc(BOSS);
      ticks[tick] = {
        type: boss?.npcTypeId, boss: boss && [...boss.position], hp: boss?.vitals.hp, maxHp: boss?.vitals.maxHp,
        player: [...engine.player().position], inventory: engine.player().inventory.map((item) => item?.id ?? null),
        state: structuredClone(engine.getEncounterSnapshot().state),
        shots: visuals.flatMap((event) => event.projectiles).filter((p) => p.spotAnimId === spots.ranged || p.spotAnimId === spots.magic).map((p) => (p.spotAnimId === spots.magic ? "magic" : "ranged")),
        binds: visuals.flatMap((event) => event.projectiles).filter((p) => p.spotAnimId === spots.bind).map((p) => p.endDelayCycles),
        tentacles: [...engine.worldState.actors.values()].filter((actor) => actor.id.startsWith("whisperer-tentacle-")).map((actor) => [actor.position[0] + 1, actor.position[1] + 1]),
        // Her own hits are typeless, as their kind says: a tentacle's 20, a screech's 45.
        hits: events.filter((event) => event.type === "hit_applied" && event.targetId === "player").map((event) => ({ kind: event.attackKind, damage: event.damage })),
        messages: events.filter((event) => event.type === "game_message").map((event) => event.segments.map((segment) => segment.text).join("")),
        heals: events.filter((event) => event.type === "hitsplat_spawned" && event.targetId === BOSS && event.hitsplatType === "heal").map((event) => event.amount),
      };
    },
  });
  return ticks;
}
const when = (ticks, test) => ticks.flatMap((tick, n) => (tick && test(tick, n) ? [n] : []));
const gaps = (list) => list.slice(1).map((value, n) => value - list[n]);

{
  // Disturbed from her north side: flung 3 tiles north; the Odd Figure for 4 ticks; her first shots 8, 9 and 10 ticks
  // after (RSPSApp), each landing 3 ticks after it is fired; then a volley every 10 ticks (WIKI), all of one style
  // before her first special, and four tentacles 5 ticks after each.
  const ticks = await ticksOf("standing");
  const disturbed = when(ticks, (tick) => tick.state.phase === "waking")[0];
  assert.ok(disturbed > 0, "she is disturbed");
  assert.deepEqual(ticks[disturbed].player, [32, 38], "flung 3 tiles north of her north side (35)");
  assert.equal(ticks[disturbed + 3].state.form, "figure", "the Odd Figure for 4 ticks");
  assert.equal(ticks[disturbed + 4].state.form, "boss");
  const shots = when(ticks, (tick) => tick.shots.length);
  assert.deepEqual(shots.slice(0, 3), [disturbed + 8, disturbed + 9, disturbed + 10]);
  assert.ok(gaps(shots.filter((_, n) => n % 3 === 0)).every((gap) => gap === 10), "a volley every 10 ticks");
  for (let n = 0; n + 2 < shots.length; n += 3) {
    const volley = [ticks[shots[n]].shots[0], ticks[shots[n + 1]].shots[0], ticks[shots[n + 2]].shots[0]];
    assert.equal(new Set(volley).size, 1, `before a special a volley is of one style (${volley})`);
  }
  // Tentacles: rise 5 ticks after the volley, at the four corners 4 tiles from the player (an X); hit 3 ticks after
  // they rise, once a wave, for 20; gone a tick later.
  const risen = when(ticks, (tick, n) => tick.tentacles.length && !ticks[n - 1].tentacles.length);
  assert.equal(risen[0], shots[0] - 1 + 5);
  const [px, py] = ticks[risen[0]].player;
  assert.deepEqual(ticks[risen[0]].tentacles.map(String).sort(), [[px - 4, py - 4], [px + 4, py - 4], [px - 4, py + 4], [px + 4, py + 4]].map(String).sort());
  // (While the player has sanity: standing in every wave, they lose it all, and insanity hurts them too.)
  for (const tick of risen.filter((n) => ticks[n + 3].state.sanity > 0)) {
    assert.deepEqual(ticks[tick + 3].hits.filter((hit) => hit.kind === "typeless").map((hit) => hit.damage), [20], "the wave hits once, for 20");
    assert.equal(ticks[tick + 4].tentacles.length, 0);
  }
  // WIKI: 20 sanity a hit, and 1 back every 4 ticks outside the Shadow Realm (which may fall on the same tick).
  assert.ok([-20, -19].includes(ticks[risen[0] + 3].state.sanity - ticks[risen[0] + 2].state.sanity));
}

{
  // The whole fight: her three specials at 720, 495 and 270 in one of two orders (WIKI), each met in the Shadow
  // Realm while the fragment glows; a bind after each; the enrage at 0, and the kill.
  const ticks = await ticksOf("kill");
  const starts = when(ticks, (tick, n) => tick.state.special && !ticks[n - 1].state.special);
  const kinds = starts.map((n) => ticks[n].state.special.kind);
  assert.ok(["seeds,screech,souls", "screech,souls,seeds"].includes(String(kinds)), String(kinds));
  starts.forEach((n, index) => assert.ok(ticks[n].hp <= [720, 495, 270][index], `special ${index + 1} at ${ticks[n].hp}`));
  for (const n of starts) {
    const { kind } = ticks[n].state.special;
    // RSPSApp (3281): the fragment pulses 6 ticks after the teleport for the seeds, 5 for the screech, 3 for the souls.
    const pulse = when(ticks, (tick, m) => m > n && tick.state.special?.switchAllowed)[0];
    assert.equal(pulse - n, { seeds: 6, screech: 5, souls: 3 }[kind], kind);
    assert.ok(ticks[pulse].inventory.includes(28356), "the fragment glows");
    assert.ok(ticks[n].inventory.includes(28357), "and not before");
    assert.ok(ticks[pulse].messages.includes("Your blackstone fragment pulses with dark energy..."));
  }
  // The seeds: one of the four layouts, all their light seeds stomped.
  const seeds = starts.find((n) => ticks[n].state.special.kind === "seeds");
  const seedsOut = when(ticks, (tick, m) => m > seeds && tick.state.special?.active)[0];
  assert.ok([0, 1, 2, 3].map((pattern) => seedLayout(pattern).length).includes(ticks[seedsOut].state.special.seeds.length));
  assert.ok(when(ticks, (tick) => tick.messages.some((text) => text.startsWith("You manage to deter all of the shadow leeches"))).length === 1);
  // The screech: eight columns, one of 60 beside one of 40, the rest 20 or 40; three blasts 6 ticks apart, each
  // taking 20 from every column; the player behind a column each time takes none.
  const screech = starts.find((n) => ticks[n].state.special.kind === "screech");
  const columns = ticks[screech + 5].state.special.columns.map((column) => column.hp);
  assert.equal(columns.length, 8);
  assert.equal(columns.filter((hp) => hp === 60).length, 1);
  assert.equal(columns[(columns.indexOf(60) + 1) % 8], 40);
  assert.ok(columns.every((hp) => [20, 40, 60].includes(hp)) && columns.filter((hp) => hp === 40).length <= 3);
  const screechEnd = when(ticks, (tick, m) => m > screech && !tick.state.special)[0];
  assert.equal(ticks.slice(screech, screechEnd + 1).flatMap((tick) => tick.hits).filter((hit) => hit.kind === "typeless" && hit.damage === 45).length, 0, "hidden from all three");
  // The souls: twelve, in sets of 2, 3, 3 and 4; not all killed, so she heals 100 and the player takes 50 (WIKI).
  const souls = starts.find((n) => ticks[n].state.special.kind === "souls");
  const soulsEnd = when(ticks, (tick, m) => m > souls && !tick.state.special)[0];
  assert.ok(ticks[soulsEnd].heals.includes(100), "she heals 100 from the chant");
  // A bind after each special that leaves her above the next one's threshold: its projectile arrives after 170 to
  // 200 cycles by how far the player is (RSPSApp), and holds them on the tick it lands.
  const binds = when(ticks, (tick) => tick.binds.length);
  assert.ok(binds.length >= 2);
  for (const n of binds) {
    const cycles = ticks[n].binds[0];
    assert.ok([170, 180, 200].includes(cycles), String(cycles));
    const lands = n + Math.ceil(cycles / 30);
    assert.ok(ticks[lands].messages.includes("The Whisperer binds you in place!"), `the bind cast on ${n} lands on ${lands}`);
    assert.equal(ticks[n].state.form, "binding", "her binding form");
  }
  // The enrage: at 0 she heals to 140, pulls the player into the Shadow Realm 5 ticks later (RSPSApp), and fires
  // a shot every 2 ticks until she dies.
  const enraged = when(ticks, (tick) => tick.state.phase === "enraged")[0];
  assert.deepEqual([ticks[enraged].hp, ticks[enraged].maxHp, ticks[enraged].heals], [140, 140, [140]]);
  const pulled = when(ticks, (tick, m) => m > enraged && tick.state.shadow)[0];
  assert.equal(pulled - enraged, 5);
  assert.ok(ticks[pulled].messages.includes("The Whisperer pulls you into the Shadow Realm..."));
  const enragedShots = when(ticks, (tick, m) => m > enraged && tick.shots.length && tick.state.phase === "enraged");
  assert.equal(enragedShots[0] - enraged, 7);
  assert.ok(gaps(enragedShots).every((gap) => gap === 2), String(gaps(enragedShots)));
  const dead = when(ticks, (tick) => tick.state.phase === "dead")[0];
  assert.ok(dead && ticks[dead].state.sanity === 100 && !ticks[dead].state.shadow, "sanity back as she dies, and out of the Shadow Realm");
}

{
  // Awakened: five shots a volley, two of one style and three of the other before her second special (WIKI).
  const ticks = await ticksOf("awakened-volleys");
  const shots = when(ticks, (tick) => tick.shots.length).slice(0, 5).map((n) => ticks[n].shots[0]);
  assert.equal(shots.length, 5);
  assert.deepEqual([...new Set(shots)].map((style) => shots.filter((s) => s === style).length).sort(), [2, 3]);
  assert.equal(shots[0], shots[1]);
}

console.log("Whisperer: volleys and tentacles, three specials in the Shadow Realm, binds, the enrage and the kill; awakened volleys of five.");
