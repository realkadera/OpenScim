// The Mad Angel's foundation (client/encounters/mad-angel/), asserted on the
// determinism harness's scenarios (tools/determinism/scenarios/mad-angel.mjs)
// against the recorded kill (OBS, 2026-11-26) and the wiki: her waking, her
// standard attack every 6 ticks, three of them between her specials in the
// order blast, sweep, smite, each special's timing, the blast letting her
// standard attacks go on, her enrage at 350 and her death; the blast's ball
// bounced back to her from its tile or exploding over the nave, and the
// sweep's cleaves over the half of the nave in front of her and on her
// sword's side. The recording's
// ticks are one later than the harness's: it began a tick before the fight.
import assert from "node:assert/strict";
import { runScenario, loadEnvironment } from "../tools/determinism/harness.mjs";
import { scenarios } from "../tools/determinism/scenarios/mad-angel.mjs";

await loadEnvironment();
const BOSS = "mad-angel";

// Each tick: her animations, the projectiles and graphics, what she says, the hits on the player, her hitpoints and
// the snapshot.
async function ticksOf(name) {
  const ticks = [];
  await runScenario(scenarios.find((scenario) => scenario.name === "mad-angel/" + name), {
    onTick(tick, engine) {
      const events = engine.getLastTickEvents();
      const visuals = events.filter((event) => event.type === "inferno_visual");
      ticks[tick] = {
        clips: visuals.flatMap((event) => (event.animations ?? []).filter((a) => a.actorId === BOSS).map((a) => a.clipId)),
        projectiles: visuals.flatMap((event) => (event.projectiles ?? []).map((p) => p.spotAnimId)),
        graphics: visuals.flatMap((event) => (event.graphics ?? []).map((g) => g.spotAnimId)),
        sounds: visuals.flatMap((event) => event.madAngelSounds ?? []),
        said: events.filter((event) => event.type === "overhead_text").map((event) => event.overheadText),
        hits: events.filter((event) => event.type === "hit_applied" && event.targetId === "player").map((event) => event.damage),
        bossHits: events.filter((event) => event.type === "hit_applied" && event.targetId === BOSS).map((event) => event.damage),
        tiles: visuals.flatMap((event) => (event.graphics ?? []).filter((g) => g.target?.kind === "tile").map((g) => [g.spotAnimId, g.target.position])),
        player: [...engine.player().position],
        facing: engine.worldState.getNpc(BOSS)?.facing,
        prayer: engine.player().activePrayer,
        hp: engine.worldState.getNpc(BOSS)?.vitals.hp,
        state: engine.getEncounterSnapshot().state,
        outcome: engine.getEncounterOutcome().phase,
      };
    },
  });
  return ticks;
}
const ticksWith = (ticks, test) => ticks.flatMap((tick, n) => (tick && test(tick) ? [n] : []));
const clipTicks = (ticks, clip) => ticksWith(ticks, (tick) => tick.clips.includes(clip));

{
  const ticks = await ticksOf("obligator-kill");
  // OBS: she wakes (spawn graphic 4010) and swings 4 ticks later, then every 6.
  assert.deepEqual(clipTicks(ticks, "wake"), [1]);
  assert.ok(ticks[1].graphics.includes(4010));
  const swings = clipTicks(ticks, "melee");
  assert.deepEqual(swings.slice(0, 3), [5, 11, 17]);
  // OBS: three standard attacks, then the blast; its ball leaves a tick after the throw, its shadow on its tile, and
  // lands 5 ticks on. He stands his ground: it explodes over the whole nave (102 tiles) for 30 to 35 (WIKI "30+", OBS 33,
  // 32), Protect from Melee no help, and nothing is thrown after it.
  assert.deepEqual(clipTicks(ticks, "blast")[0], 23);
  assert.deepEqual(ticksWith(ticks, (tick) => tick.projectiles.includes(4015)).slice(0, 1), [24]);
  assert.ok(ticks[24].tiles.some(([id]) => id === 1448), "the shadow on the ball's tile");
  assert.equal(ticks[29].tiles.filter(([id]) => id === 4016).length, 102);
  assert.deepEqual(ticks[29].sounds.map((sound) => sound.id), [12054], "the explosion heard (OBS)");
  assert.ok(ticks[29].hits.length === 1 && ticks[29].hits[0] >= 30 && ticks[29].hits[0] <= 35);
  assert.ok(!ticks.slice(25, 40).some((tick) => tick?.projectiles.includes(4015)));
  // OBS: her standard attacks go on through the blast and are not counted: three more after it, then the sweep.
  assert.deepEqual(swings.slice(3, 7), [29, 35, 41, 47]);
  const firstSweep = ticksWith(ticks, (tick) => tick.clips.some((clip) => /_draw$/.test(clip)))[0];
  assert.equal(firstSweep, 53);
  // OBS, WIKI: four cleaves 6 ticks apart, each with its tiles; standing in the half, he is caught by each: 22 to 28,
  // halved by Protect from Melee (OBS 11 to 14). No standard attack while she sweeps.
  const cleaves = ticksWith(ticks, (tick) => tick.tiles.some(([id]) => id === 2184)).filter((tick) => tick < firstSweep + 30);
  assert.deepEqual(cleaves, [59, 65, 71, 77]);
  for (const tick of cleaves) assert.ok(ticks[tick].hits.some((damage) => damage >= 11 && damage <= 14), "caught at " + tick);
  assert.ok(!swings.some((tick) => tick > firstSweep && tick <= 77));
  // Protect from Melee: what is left of a standard attack is up to 5 (WIKI: "from 31 to 5").
  assert.ok(swings.every((tick) => ticks[tick + 2].hits.every((damage) => damage <= 5)));
  // WIKI: at 350 she enrages at her next turn, "...!"; OBS: the blast 4 ticks after it, and the specials one after another.
  const enragedAt = ticksWith(ticks, (tick) => tick.said.includes("...!"));
  assert.equal(enragedAt.length, 1);
  assert.ok(ticks[enragedAt[0]].hp <= 350);
  assert.equal(clipTicks(ticks, "blast")[1], enragedAt[0] + 4);
  // OBS: enraged, the ball lands 4 ticks after it leaves, and the sweep's cleaves are 4 ticks apart.
  const enragedBall = ticksWith(ticks, (tick) => tick.projectiles.includes(4015)).find((tick) => tick > enragedAt[0]);
  assert.ok(ticks[enragedBall + 4].tiles.some(([id]) => id === 4016), "it explodes 4 ticks after it leaves");
  const enragedSweep = ticksWith(ticks, (tick) => tick.clips.some((clip) => /Enraged_cleave$/.test(clip)));
  assert.ok(enragedSweep.length >= 2 && enragedSweep.slice(1).every((tick, n) => tick - enragedSweep[n] === 4));
  // She dies, and the fight is won.
  assert.equal(ticks.at(-1).outcome, "victory");
}

{
  const ticks = await ticksOf("countered");
  // On the ball's tile as it lands: it goes back to her (the bounce graphic on her), she takes 18 to 22 two ticks on
  // (OBS 19, 20, 18), and it is thrown again the next tick; three times, 6 ticks apart (OBS: landed t30, t36, t42).
  const bounces = ticksWith(ticks, (tick) => tick.graphics.includes(4017)).filter((tick) => tick < 60);
  assert.deepEqual(bounces, [29, 35, 41]);
  for (const tick of bounces) assert.ok(ticks[tick + 2].bossHits.some((damage) => damage >= 18 && damage <= 22), "bounce hit at " + (tick + 2));
  // OBS: the bounce heard on the ball's tile as it lands (12056), her hit by it from her with her hitsplat (12055).
  for (const tick of bounces) {
    assert.deepEqual(ticks[tick].sounds.map((sound) => [sound.id, sound.position.join()]), [[12056, ticks[tick].player.join()]]);
    assert.deepEqual(ticks[tick + 2].sounds.map((sound) => sound.id), [12055]);
  }
  assert.ok(!ticks.some((tick) => tick?.tiles.some(([id]) => id === 4016)), "no ball explodes");
  // Out of the half each cleave sweeps (the side opposite the sword, or behind her): never caught, and never on a
  // swept tile.
  const cleaves = ticksWith(ticks, (tick) => tick.tiles.some(([id]) => id === 2184));
  assert.ok(cleaves.length >= 4);
  for (const tick of cleaves) {
    const swept = ticks[tick].tiles.filter(([id]) => id === 2184).map(([, tile]) => tile.join());
    assert.ok(!swept.includes(ticks[tick].player.join()), "out of the cleave at " + tick);
    assert.equal(ticks[tick].hits.length, 0);
  }
  // OBS: through a sweep she holds one of the four ways, turning only on the tick of a cleave, whatever the player does.
  const firstDraw = ticksWith(ticks, (tick) => tick.clips.some((clip) => /_draw$/.test(clip)))[0];
  const sweepTicks = ticks.slice(firstDraw, firstDraw + 25).map((tick) => tick.facing);
  assert.ok(sweepTicks.every((facing) => [0, 512, 1024, 1536].includes(facing)), "a straight way");
  sweepTicks.forEach((facing, n) => {
    if (n > 0 && facing !== sweepTicks[n - 1]) assert.ok(cleaves.includes(firstDraw + n), "turned at " + (firstDraw + n) + ", not on a cleave");
  });
  // WIKI: a cleave dodged to her side makes the player's next attack on her sure to hit, and at least half his maximum;
  // spent as that attack starts.
  const dodged = ticksWith(ticks, (tick) => tick.state.sideDodged);
  assert.ok(dodged.length > 0 && cleaves.includes(dodged[0]), "earned on a cleave");
  const spentAt = dodged.find((tick, n) => dodged[n + 1] !== tick + 1);
  const rewarded = ticks.slice(spentAt + 1).find((tick) => tick?.bossHits.length)?.bossHits ?? [];
  const best = Math.max(...ticks.flatMap((tick) => tick?.bossHits ?? []));
  assert.ok(rewarded.some((damage) => damage >= Math.floor(best / 2)), "a sure hit of at least half the maximum: " + rewarded);
  // WIKI: Protect from Magic switched on on the very tick a smite strikes negates it (OBS: the strike and its hitsplat
  // the tick after the impact graphic), and the player's next attack is a maximum hit: the largest of his whole fight.
  const strikes = ticksWith(ticks, (tick) => tick.graphics.includes(4013)).map((tick) => tick + 1);
  assert.ok(strikes.length >= 1);
  const maxHit = Math.max(...ticks.flatMap((tick) => tick?.bossHits ?? []));
  for (const tick of strikes) {
    assert.equal(ticks[tick].prayer, "ProtectMagic");
    assert.notEqual(ticks[tick - 1].prayer, "ProtectMagic");
    assert.deepEqual(ticks[tick].hits, [0], "negated at " + tick);
  }
  // The attack that spends it (the tick the reward is gone) lands for the maximum.
  const earned = ticks.findIndex((tick, n) => n >= strikes[0] && tick?.state.maxHitEarned);
  const spent = ticks.findIndex((tick, n) => n > earned && tick && !tick.state.maxHitEarned);
  assert.ok(earned > 0 && spent > earned);
  assert.ok(ticks.slice(spent, spent + 3).some((tick) => tick?.bossHits.includes(maxHit)), "the next attack is a maximum hit");
  // OBS: her next standard attack 6 ticks after the last cleave (t90 -> t96).
  const lastCleave = cleaves.filter((tick) => tick <= cleaves[0] + 18).at(-1); // the first sweep's fourth
  assert.equal(clipTicks(ticks, "melee").find((tick) => tick > lastCleave), lastCleave + 6);
  assert.equal(ticks.at(-1).outcome, "victory");
}

{
  const ticks = await ticksOf("granite-hammer");
  // Unprayed, her standard attacks hit up to 31 (WIKI).
  const hits = clipTicks(ticks, "melee").flatMap((tick) => ticks[tick + 2]?.hits ?? []);
  assert.ok(hits.some((damage) => damage > 5) && hits.every((damage) => damage <= 31));
  // OBS: the smite after the sweep, its impact on the player 5 ticks in (smite graphic 4011, impact 4013).
  const smite = clipTicks(ticks, "smite")[0];
  assert.ok(smite > 0);
  assert.ok(ticks[smite].graphics.includes(4011));
  assert.ok(ticks[smite + 5].graphics.includes(4013));
  // Unprayed it lands whole, 28 to 32 (OBS 29 to 32), the tick after its impact.
  assert.ok(ticks[smite + 6].hits.some((damage) => damage >= 28 && damage <= 32));
}

{
  // Protect from Magic already on: ~75% off (WIKI), not negated (it was on before the strike), and no maximum hit.
  const ticks = await ticksOf("magic-prayer");
  const smite = clipTicks(ticks, "smite")[0];
  assert.ok(smite > 0, "a smite within the scenario");
  const hit = ticks[smite + 6].hits.filter((damage) => damage <= 8);
  assert.equal(hit.length, 1);
  assert.ok(hit[0] >= 7 && hit[0] <= 8, "a quarter of 28 to 32");
  assert.ok(ticks.slice(smite).every((tick) => !tick || !tick.state.maxHitEarned));
}

{
  // The setup's switches: with the blast and the smite off she sweeps after every three standard attacks, and nothing else.
  const ticks = await ticksOf("sweep-only");
  assert.deepEqual(clipTicks(ticks, "blast").concat(clipTicks(ticks, "smite")), []);
  const draws = ticksWith(ticks, (tick) => tick.clips.some((clip) => /_draw$/.test(clip)));
  assert.equal(draws[0], 23, "her first special, after three standard attacks");
  assert.ok(draws.length >= 2, "and the next sweep after three more");
  assert.equal(ticks[draws[0] + 1].state.nextSpecial, "sweep");
}

{
  // Untouchable while she wakes; the snapshot says so.
  const ticks = await ticksOf("start");
  assert.equal(ticks[1].state.phase, "waking");
  assert.equal(ticks[4].state.phase, "fighting");
  assert.equal(ticks[4].state.nextSpecial, "blast");
}

{
  // Her audio layer plays what the encounter attaches, on its tile, heard to 20 (OBS); it passes on every other event.
  const { madAngelAudio } = await import("../client/encounters/mad-angel/audio.js");
  const rule = madAngelAudio.rules.inferno_visual;
  assert.deepEqual(rule.preloadIds.sort(), [12054, 12055, 12056]);
  assert.deepEqual(rule.resolve({ madAngelSounds: [{ id: 12054, position: [36, 37] }] }), {
    kind: "play",
    sound: [{ id: 12054, delayCycles: 0, range: 20, position: [36, 37], channel: "area" }],
  });
  assert.deepEqual(rule.resolve({ hydraSounds: [{ id: 4106 }] }), { kind: "pass" });
}

console.log("The Mad Angel wakes, swings every 6 ticks, and runs her blast, sweep and smite in turn as recorded; she enrages at 350.");
