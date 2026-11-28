// Brutus's rules as the recorded kills (OBS) and the wiki have them, asserted on the determinism harness's scenarios
// (tools/determinism/scenarios/brutus.mjs). Their digests say that nothing changed; this says what it is.
import assert from "node:assert/strict";
import { runScenario } from "../tools/determinism/harness.mjs";
import { scenarios } from "../tools/determinism/scenarios/brutus.mjs";


// Each tick: his tile, his overhead texts, his clips, and the hits on the player.
async function ticksOf(name) {
  const ticks = [];
  await runScenario(scenarios.find((scenario) => scenario.name === "brutus/" + name), {
    onTick(tick, engine) {
      const events = engine.getLastTickEvents();
      const boss = engine.worldState.getNpc("brutus");
      ticks[tick] = {
        boss: boss ? [...boss.position] : null,
        alive: boss?.alive === true,
        texts: events.filter((event) => event.type === "overhead_text").map((event) => event.overheadText),
        butts: events.filter((event) => event.type === "hit_applied" && event.targetId === "player" && event.attackKind === "melee_crush").map((event) => event.damage),
        specials: events.filter((event) => event.type === "hit_applied" && event.targetId === "player" && event.attackKind === "typeless").map((event) => event.damage),
        outcome: engine.getEncounterOutcome().phase,
      };
    },
  });
  return ticks;
}
const when = (ticks, test) => ticks.flatMap((tick, n) => (tick && test(tick) ? [n] : []));
const gaps = (list) => list.slice(1).map((value, n) => value - list[n]);

{
  // The encounter's own helpers, loaded once the harness has run a scenario and installed its module hooks.
  await ticksOf("stomps-only");
  const { stompTiles, chargeDirection } = await import("../client/encounters/brutus/encounter.js");
  // The tiles of a stomp, as four recorded ones drew them (OBS, world tiles; WIKI: "3x1", "an L shape if diagonal"):
  // beside the middle of his south edge, the three there; at the end of an edge, or under him at his corner, an L of
  // five round that corner; under him at his east column, the line east. Each hits his own tiles beside those too
  // (WIKI: "adjacent tiles beneath Brutus"), where the two players under him were hit (OBS).
  const sorted = (tiles) => tiles.map(([x, y]) => x + "," + y).sort();
  assert.deepEqual(sorted(stompTiles([3259, 3290], [3260, 3289]).outside), sorted([[3259, 3289], [3260, 3289], [3261, 3289]]));
  assert.deepEqual(sorted(stompTiles([3256, 3285], [3258, 3288]).outside), sorted([[3257, 3288], [3258, 3288], [3259, 3288], [3259, 3287], [3259, 3286]]));
  const lShape = stompTiles([3258, 3289], [3260, 3289]);
  assert.deepEqual(sorted(lShape.outside), sorted([[3259, 3288], [3260, 3288], [3261, 3288], [3261, 3289], [3261, 3290]]));
  assert.deepEqual(sorted(lShape.all.slice(5)), sorted([[3259, 3289], [3260, 3289], [3260, 3290]]), "his corner's three");
  assert.ok(sorted(lShape.all).includes("3260,3289"), "OBS: a player there was hit");
  const east = stompTiles([3258, 3291], [3260, 3292]);
  assert.deepEqual(sorted(east.outside), sorted([[3261, 3291], [3261, 3292], [3261, 3293]]));
  assert.deepEqual(sorted(east.all.slice(3)), sorted([[3260, 3291], [3260, 3292], [3260, 3293]]), "his east column");
  assert.ok(!sorted(east.all).includes("3259,3292"), "not his middle tile");
  // The charge: toward the player on his furthest axis.
  assert.equal(chargeDirection([10, 10], [5, 11]), "W");
  assert.equal(chargeDirection([10, 10], [11, 20]), "N");
}
{
  // Standing still, undefended: his butts 5 ticks apart (TABLE, OBS), none above 3 (WIKI); his first special after two
  // butts, then four between (OBS); three snorts 8 ticks apart, each stomp landing 4 ticks on (OBS); a growl, his
  // charge landing 4 ticks on (OBS) after a dash of up to 7 tiles in two ticks (OBS); the specials in turn (WIKI, OBS); each
  // special 15 to 19 (WIKI).
  const ticks = await ticksOf("standing");
  const butts = when(ticks, (tick) => tick.butts.length > 0);
  assert.ok(butts.every((n) => ticks[n].butts.every((damage) => damage <= 3)));
  const snorts = when(ticks, (tick) => tick.texts.includes("*snorts*"));
  const growls = when(ticks, (tick) => tick.texts.includes("*growls*"));
  const specials = when(ticks, (tick) => tick.specials.length > 0);
  assert.ok(specials.every((n) => ticks[n].specials.every((damage) => damage >= 15 && damage <= 19)));
  assert.equal(butts.filter((n) => n < snorts[0]).length, 2, "two butts before his first special");
  assert.deepEqual(gaps(snorts.slice(0, 3)), [8, 8]);
  for (const snort of snorts) assert.ok(specials.includes(snort + 4), "a stomp lands 4 ticks after its snort: " + snort);
  assert.ok(growls.length >= 2);
  for (const growl of growls) {
    assert.ok(specials.includes(growl + 4), "a charge lands 4 ticks after its growl: " + growl);
    const [from, to] = [ticks[growl].boss, ticks[growl + 5].boss];
    const dash = Math.abs(to[0] - from[0]) + Math.abs(to[1] - from[1]);
    assert.ok(dash >= 4 && dash <= 7, `a dash of 4 to 7 tiles (OBS): ${dash}`);
    // His next butt no sooner than 8 ticks after the growl (OBS).
    assert.ok(butts.filter((n) => n > growl)[0] >= growl + 8, "his next butt 8 ticks after the growl or later: " + growl);
  }
  // In turn: a stomp's three snorts, then a growl, then three snorts...
  const order = [...snorts.map((n) => [n, "stomp"]), ...growls.map((n) => [n, "charge"])].sort((a, b) => a[0] - b[0]).map(([, name]) => name);
  const specialsInTurn = order.filter((name, n) => n === 0 || name !== order[n - 1]);
  assert.deepEqual(specialsInTurn.slice(0, 4), ["stomp", "charge", "stomp", "charge"]);
  // Four butts between one special's end and the next.
  const afterFirstStomp = butts.filter((n) => n > snorts[2] && n < growls[0]);
  assert.equal(afterFirstStomp.length, 4);
  assert.ok(gaps(afterFirstStomp).every((gap) => gap === 5));
}
{
  // Each stomp stepped back from, each charge stepped aside from, Protect from Melee on: nothing lands.
  const ticks = await ticksOf("dodged");
  assert.ok(when(ticks, (tick) => tick.texts.includes("*snorts*")).length >= 3);
  assert.ok(when(ticks, (tick) => tick.texts.includes("*growls*")).length >= 1);
  assert.deepEqual(when(ticks, (tick) => tick.specials.some((damage) => damage > 0) || tick.butts.some((damage) => damage > 0)), []);
}
{
  // The setup's switches: one special off, only the other.
  const stomps = await ticksOf("stomps-only");
  assert.ok(when(stomps, (tick) => tick.texts.includes("*snorts*")).length > 0);
  assert.equal(when(stomps, (tick) => tick.texts.includes("*growls*")).length, 0);
  const charges = await ticksOf("charges-only");
  assert.ok(when(charges, (tick) => tick.texts.includes("*growls*")).length > 0);
  assert.equal(when(charges, (tick) => tick.texts.includes("*snorts*")).length, 0);
}
{
  // The guide's free-to-play melee, his specials dodged: "m-moo..." as he dies (OBS), and the victory.
  const ticks = await ticksOf("f2p-kill");
  const death = ticks.findIndex((tick) => tick?.texts.includes("m-moo..."));
  assert.ok(death > 0 && !ticks[death].alive);
  assert.equal(ticks.at(-1).outcome, "victory");
}
console.log("Brutus: his butts, stomps and charge in turn, dodged, switched, and his death.");
