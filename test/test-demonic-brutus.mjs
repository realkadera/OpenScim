// Demonic Brutus's rules as the wiki and the video of a kill (OBS) have them, asserted on the determinism harness's
// scenarios (tools/determinism/scenarios/brutus-demonic.mjs). Their digests say that nothing changed; this says what it is.
import assert from "node:assert/strict";
import { runScenario } from "../tools/determinism/harness.mjs";
import { scenarios } from "../tools/determinism/scenarios/brutus-demonic.mjs";

// Each tick: his hitpoints and phase, the special running, the ghosts there, and the hits on the player.
async function ticksOf(name) {
  const ticks = [];
  await runScenario(scenarios.find((scenario) => scenario.name === "brutus_demonic/" + name), {
    onTick(tick, engine) {
      const events = engine.getLastTickEvents();
      const boss = engine.worldState.getNpc("brutus");
      const state = engine.getEncounterSnapshot().state;
      const now = engine.currentTick;
      ticks[tick] = {
        hp: boss?.vitals.hp,
        phase: state.phase,
        special: state.special,
        ghosts: [...engine.worldState.actors.values()].filter((actor) => actor.npcTypeId === 15629).length,
        player: [...engine.player().position],
        // The player at a corner of him (diagonal to his footprint), where he can't butt.
        atCorner: (() => {
          const [px, py] = engine.player().position;
          const [bx, by] = boss.position;
          return (px === bx - 1 || px === bx + 3) && (py === by - 1 || py === by + 3);
        })(),
        // Each bull's facing, and the way from its middle to the tile its special is round, in the game's 2048ths (0 south,
        // 512 west).
        facings: [...engine.worldState.actors.values()]
          .filter((actor) => actor.id === "brutus" || actor.npcTypeId === 15629)
          .map((actor) => {
            // Toward the tile the special is round (the player's as it was placed).
            const at = engine.getEncounterSnapshot().state.special?.at ?? engine.player().position;
            const dx = at[0] + 0.5 - actor.position[0] - actor.size / 2;
            const dy = at[1] + 0.5 - actor.position[1] - actor.size / 2;
            return { id: actor.id, facing: actor.lockedFacing ?? null, toPlayer: (Math.round(Math.atan2(-dx, -dy) * (2048 / (Math.PI * 2))) + 2048) % 2048 };
          }),
        texts: events.filter((event) => event.type === "overhead_text").map((event) => event.overheadText),
        heals: events.filter((event) => event.type === "hitsplat_spawned" && event.hitsplatType === "heal").map((event) => event.amount),
        butts: events.filter((event) => event.type === "hit_applied" && event.targetId === "player" && event.attackKind === "melee_crush").map((event) => event.damage),
        bulls: engine.damageHistory.filter((hit) => hit.tick === now && /slam|charge/.test(hit.source)).map((hit) => hit.effectiveDamage),
        orbs: engine.damageHistory.filter((hit) => hit.tick === now && /orb/.test(hit.source)).map((hit) => ({ type: hit.attackType, damage: hit.effectiveDamage, prayed: hit.prayedCorrectly })),
        outcome: engine.getEncounterOutcome().phase,
      };
    },
  });
  return ticks;
}
const when = (ticks, test) => ticks.flatMap((tick, n) => (tick && test(tick) ? [n] : []));
const gaps = (list) => list.slice(1).map((value, n) => value - list[n]);
// Each special once: its snapshot a tick after he fades (as he reappears, with his ghosts and any orbs), and his
// hitpoints as he fades.
const specials = (ticks) =>
  when(ticks, (tick) => tick.special)
    .filter((n) => !ticks[n - 1]?.special || ticks[n - 1].special.fadedAt !== ticks[n].special.fadedAt)
    .map((n) => ({ ...(ticks[n + 1]?.special ?? ticks[n].special), hp: ticks[n].hp, phase: ticks[n].phase }));

{
  // The encounter's own helpers, loaded once the harness has run a scenario and installed its module hooks.
  await ticksOf("slams-only");
  const { chargeStart, chargeLane, slamCorner, specialStarts } = await import("../client/encounters/brutus/demonic.js");
  // A charge from the west: two tiles off the player, the player in his north row (the row on his left as he faces
  // east; OBS); from the east, in his south row. Its lane is those three rows, across the player's tile.
  const west = chargeStart("W", [20, 20]);
  assert.deepEqual(west, { corner: [15, 18], direction: "E" });
  assert.deepEqual(chargeStart("E", [20, 20]), { corner: [23, 20], direction: "W" });
  const lane = chargeLane(west.corner, west.direction).lane;
  for (const tile of ["20,20", "20,19", "20,18", "15,20", "24,20"]) assert.ok(lane.has(tile), tile);
  for (const tile of ["20,21", "22,22", "18,17"]) assert.ok(!lane.has(tile), tile);
  // The four lanes round the player don't all cross the tiles diagonal to him: one clear of the first two bulls (from
  // the west, then the north), another of the last two (the east, then the south), two tiles apart.
  const lanes = ["W", "N", "E", "S"].map((side) => {
    const start = chargeStart(side, [20, 20]);
    return chargeLane(start.corner, start.direction).lane;
  });
  assert.ok(!lanes[0].has("21,21") && !lanes[1].has("21,21"), "21,21 clear of the first two");
  assert.ok(!lanes[2].has("19,19") && !lanes[3].has("19,19"), "19,19 clear of the last two");
  // A slam from the south-west: his north-east tile diagonal to the player's.
  assert.deepEqual(slamCorner("SW", [20, 20]), [17, 17]);
  assert.deepEqual(slamCorner("NE", [20, 20]), [21, 21]);
  // Round the player: clockwise, or counterclockwise from 250 (WIKI; OBS SW NW NE SE at 547, SW SE NE NW at 216).
  assert.deepEqual(specialStarts("slam", "SW", true), ["SW", "NW", "NE", "SE"]);
  assert.deepEqual(specialStarts("slam", "SW", false), ["SW", "SE", "NE", "NW"]);
  assert.deepEqual(specialStarts("charge", "E", true), ["E", "S", "W", "N"]);
}

{
  // Standing still: two or three butts 5 ticks apart, through prayer and up to 4; then a special; then two or three
  // more; the specials in turn, charge and slam.
  const ticks = await ticksOf("standing");
  const butts = when(ticks, (tick) => tick.butts.length);
  assert.ok(butts.flatMap((n) => ticks[n].butts).every((damage) => damage <= 4), "his butts up to 4 (WIKI)");
  const list = specials(ticks);
  assert.ok(list.length >= 4, `${list.length} specials`);
  for (let n = 1; n < list.length; n++) assert.notEqual(list[n].name, list[n - 1].name, "charge and slam in turn");
  assert.equal(list[0].afterStandards, 2, "two butts before his first special (OBS)");
  assert.ok(list.slice(1).some((special) => special.afterStandards === 3), "three before most later ones (OBS)");
  // Two or three butts before each special (WIKI, OBS), the special 5 ticks after the last (OBS).
  for (const special of list) {
    assert.ok([2, 3].includes(special.afterStandards), `${special.afterStandards} butts before the fade at ${special.fadedAt}`);
    const before = butts.filter((tick) => tick < special.fadedAt).slice(-special.afterStandards);
    assert.equal(before.length, special.afterStandards);
    assert.deepEqual(gaps([...before, special.fadedAt]), Array(special.afterStandards).fill(5), `butts ${before} before the fade at ${special.fadedAt}`);
    // A special the run ends in is checked no further.
    if (special.firstBullAt + 6 >= ticks.length) continue;
    // Above 500 hitpoints, his first bull 5 ticks after he fades (OBS), and the four a tick apart, each 45 to 56 through prayer.
    assert.equal(special.firstBullAt, special.fadedAt + 5);
    const bulls = when(ticks, (tick) => tick.bulls.length).filter((tick) => tick >= special.firstBullAt && tick < special.firstBullAt + 4);
    assert.deepEqual(bulls, [0, 1, 2, 3].map((n) => special.firstBullAt + n));
    for (const tick of bulls) for (const damage of ticks[tick].bulls) assert.ok(damage >= 45 && damage <= 56, `bull ${damage}`);
    // Three ghosts with him, each appearing as its animation needs to reach its hit (a slam 2 ticks before, a charge 1;
    // CACHE), so one a tick: all there 2 ticks after the first bull, gone once their bulls are done.
    const lead = special.name === "slam" ? 2 : 1;
    for (let n = 0; n < 3; n++) assert.equal(ticks[special.firstBullAt - lead + n].ghosts, n, `ghosts ${lead} ticks before bull ${n}`);
    assert.equal(ticks[special.firstBullAt + 2].ghosts, 3);
    // As they appear, slamming bulls face the player (OBS: every ghost turned to him); charging ones, the way they
    // dash (N, E, S, W round the player clockwise from the west: east, south, west, north).
    const dashFacings = { W: 1536, N: 0, E: 512, S: 1024 }; // by the side a bull comes from
    for (let n = 0; n < 4; n++) {
      const appeared = ticks[special.firstBullAt - lead + n].facings.filter((bull) => (n === 0 ? bull.id === "brutus" : bull.id !== "brutus"));
      const bull = n === 0 ? appeared[0] : appeared.at(-1);
      const from = special.bulls[n].from;
      const expected = special.name === "charge" ? dashFacings[from] : bull.toPlayer;
      assert.equal(bull.facing, expected, `bull ${n} (from ${from}) after the fade at ${special.fadedAt}`);
    }
    assert.equal(ticks[special.firstBullAt + 6]?.ghosts ?? 0, 0);
  }
}

{
  // Each special stepped out of, two tiles from where the player stood: no bull lands.
  const ticks = await ticksOf("dodged");
  assert.ok(specials(ticks).length >= 4);
  assert.deepEqual(when(ticks, (tick) => tick.bulls.length), []);
}

{
  // On the start tile: whenever a special leaves him at a corner of the player, he steps beside him
  // the next tick (inferred: he can't butt from a corner), so he never stands there, and he goes on butting.
  const ticks = await ticksOf("start-tile");
  const corners = when(ticks, (tick) => tick.atCorner && !tick.special);
  assert.ok(corners.every((tick) => !corners.includes(tick + 1)), `at a corner two ticks running: ${corners}`);
  assert.ok(when(ticks, (tick) => tick.butts.length).length >= 10);
}

{
  // Beside the east fence as his first special starts: pushed into open space as he fades, the special placed round
  // that tile, and a walk only (a tile a tick) till it ends, then running again (WIKI).
  const ticks = await ticksOf("pushed");
  const [first] = specials(ticks);
  assert.ok(first.pushedTo, "pushed");
  assert.deepEqual(ticks[first.fadedAt].player, first.pushedTo, "on the tile he is pushed to as he fades");
  assert.deepEqual(first.at, first.pushedTo, "the special is round it");
  const steps = (from, to) => ticks.slice(from, to).flatMap((tick, n) => (n && tick ? [Math.max(Math.abs(tick.player[0] - ticks[from + n - 1].player[0]), Math.abs(tick.player[1] - ticks[from + n - 1].player[1]))] : []));
  assert.ok(steps(first.fadedAt + 1, first.endsAt).every((step) => step <= 1), "walking during the special");
  assert.ok(steps(first.fadedAt + 1, first.endsAt).some((step) => step === 1), "and moving");
}

{
  // The charge's switch off: every special a slam.
  const ticks = await ticksOf("slams-only");
  assert.ok(specials(ticks).every((special) => special.name === "slam"));
}

{
  // A kill with the guide's melee setup, dodging and praying against each orb.
  const ticks = await ticksOf("kill");
  const list = specials(ticks);
  // From 500 his first bull 3 ticks after the fade; from 250 the ghosts counterclockwise (WIKI, OBS).
  for (const special of list) {
    assert.equal(special.firstBullAt - special.fadedAt, special.hp > 500 ? 5 : 3, `fade at ${special.fadedAt}, ${special.hp} hitpoints`);
    assert.equal(special.clockwise, special.hp > 250, `fade at ${special.fadedAt}, ${special.hp} hitpoints`);
  }
  // At 0 in phase 1: "moo moo!" and a heal of 487; then phase 2 (WIKI, OBS).
  const change = when(ticks, (tick) => tick.texts.includes("moo moo!"));
  assert.equal(change.length, 1);
  assert.deepEqual(ticks[change[0]].heals, [487]);
  assert.equal(ticks[change[0]].hp, 487);
  assert.equal(ticks[change[0]].phase, 2);
  // Phase 2's specials have four orbs: magic, melee and ranged first (OBS), each landing with a bull, each stopped by
  // its protection prayer.
  const phaseTwo = list.filter((special) => special.phase === 2);
  assert.ok(phaseTwo.length >= 2);
  for (const special of phaseTwo) assert.deepEqual(special.orbs.slice(0, 3), ["magic", "melee", "ranged"]);
  const orbs = ticks.flatMap((tick) => tick?.orbs ?? []);
  assert.equal(orbs.length, phaseTwo.length * 4);
  assert.ok(orbs.every((orb) => orb.prayed && orb.damage === 0), "every orb prayed against");
  assert.ok(list.filter((special) => special.phase === 1).every((special) => special.orbs.length === 0), "no orbs in phase 1");
  // No bull lands on a player who dodges; his death and the victory.
  assert.deepEqual(when(ticks, (tick) => tick.bulls.length), []);
  assert.ok(when(ticks, (tick) => tick.texts.includes("m-moo...")).length === 1);
  assert.equal(ticks.at(-1).outcome, "victory");
}
console.log("Demonic Brutus: two or three butts and a special, four bulls a tick apart; faster from 500, counterclockwise from 250; 487 back at 0, then orbs to pray against.");
