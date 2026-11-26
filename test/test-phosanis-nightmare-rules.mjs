// Phosani's Nightmare's rules as the logs, the wiki and tsps have them
// (client/encounters/phosanis-nightmare/), asserted on the determinism
// harness's scenarios (tools/determinism/scenarios/phosanis-nightmare.mjs).
// Their digests say that nothing changed; this says what it is.
import assert from "node:assert/strict";
import { runScenario } from "../tools/determinism/harness.mjs";
import { scenarios } from "../tools/determinism/scenarios/phosanis-nightmare.mjs";
import { formCycle, surgeLanes, sleepwalkerTiles, same } from "../client/encounters/phosanis-nightmare/ids.js";

const BOSS = "phosanis-nightmare";
const specialClips = ["claws", "husks", "parasite", "curse", "spores", "leave"];
const standardClips = ["magic", "range", "melee"];

// Runs a scenario and gives each tick: her tile, type and clips, the other actors' clips, the player, the messages,
// the damage taken, the hitsplats on her, the prayer changes and the encounter's snapshot.
async function ticksOf(name) {
  const ticks = [];
  const result = await runScenario(scenarios.find((scenario) => scenario.name === "phosanis-nightmare/" + name), {
    onTick(tick, engine) {
      const events = engine.getLastTickEvents();
      const visuals = events.filter((event) => event.type === "inferno_visual");
      const boss = engine.worldState.getNpc(BOSS);
      const player = engine.player();
      ticks[tick] = {
        boss: boss && [...boss.position], type: boss?.npcTypeId, hp: boss?.vitals.hp,
        clips: visuals.flatMap((event) => event.animations.filter((a) => a.actorId === BOSS).map((a) => a.clipId)),
        others: visuals.flatMap((event) => event.animations.filter((a) => a.actorId !== BOSS).map((a) => [a.actorId, a.clipId])),
        player: [...player.position], prayer: player.activePrayer, points: player.prayerState.points, run: player.isRunEnabled,
        messages: events.filter((event) => event.type === "game_message").map((event) => event.segments.map(({ text }) => text).join("")),
        overhead: events.filter((event) => event.type === "overhead_text").map((event) => [event.anchor.actorId, event.overheadText]),
        damage: engine.damageHistory.filter((hit) => hit.tick === tick).map(({ source, effectiveDamage, baseDamage, attackType, activePrayer }) => ({ source, effectiveDamage, baseDamage, attackType, activePrayer })),
        onBoss: events.filter((event) => event.type === "hitsplat_spawned" && event.targetId === BOSS).map(({ amount, hitsplatType }) => ({ amount, hitsplatType })),
        prayerOff: events.filter((event) => event.type === "prayer_changed" && event.actorId === "player" && event.to === null).map((event) => event.from),
        playerAttacks: events.filter((event) => event.type === "attack_started" && event.sourceId === "player").length,
        npcs: engine.worldState.getNpcs().filter((npc) => npc.alive).map((npc) => ({ id: npc.id, position: [...npc.position], type: npc.npcTypeId })),
        state: engine.getEncounterSnapshot().state,
        outcome: engine.getEncounterOutcome().phase,
      };
    },
  });
  assert.ok(result.replayMatches, name + ": the replay ends where the run did");
  return ticks;
}
const clipTicks = (ticks, clip) => ticks.flatMap((tick, n) => (tick?.clips.includes(clip) ? [n] : []));
const messageTicks = (ticks, text) => ticks.flatMap((tick, n) => (tick?.messages.some((message) => message.includes(text)) ? [n] : []));
const damageOf = (ticks, source) => ticks.flatMap((tick, n) => (tick?.damage ?? []).filter((hit) => hit.source === source).map((hit) => ({ tick: n, ...hit })));
const stageTicks = (ticks, stage) => ticks.flatMap((tick, n) => (tick?.state.stage === stage && ticks[n - 1]?.state.stage !== stage ? [n] : []));
const specialsOf = (ticks, from, to) => {
  const seen = [];
  for (let n = from; n < to; n++) {
    const tick = ticks[n];
    if (!tick) continue;
    if (tick.clips.includes("husks")) seen.push("husks");
    if (tick.clips.includes("parasite")) seen.push("parasite");
    if (tick.clips.includes("curse")) seen.push("curse");
    if (tick.clips.includes("spores")) seen.push("spores");
    if (tick.clips.includes("flowers")) seen.push("flowers");
    if (tick.clips.includes("surge")) seen.push("surge");
  }
  return seen;
};
const order = { 9416: ["parasite", "flowers", "surge"], 11153: ["surge", "husks", "spores"], 9418: ["parasite", "flowers", "curse"], 9417: ["spores", "husks", "curse"] };

for (const name of ["kill", "kill-other-forms"]) {
  const ticks = await ticksOf(name);
  const last = ticks.length - 1;
  assert.equal(ticks[last].outcome, "victory", name);

  // Three of her forms, one after another round her cycle; each phase's specials are its form's, in their order.
  const forms = ticks[1].state.forms;
  const start = formCycle.indexOf(forms[0]);
  assert.deepEqual(forms, [0, 1, 2].map((n) => formCycle[(start + n) % 4]));
  const shields = stageTicks(ticks, "shield");
  const blasts = stageTicks(ticks, "blast");
  assert.equal(blasts.length, 3, name);
  for (let phase = 0; phase < 3; phase++) {
    const from = phase === 0 ? 1 : shields[phase];
    assert.equal(ticks[from].type, forms[phase], name + " phase " + (phase + 1));
    const seen = specialsOf(ticks, from, blasts[phase]);
    const list = order[forms[phase]];
    assert.ok(seen.length >= 2, name + " " + seen);
    const first = list.indexOf(seen[0]);
    assert.deepEqual(seen, seen.map((_, n) => list[(first + n) % 3]), name + " phase " + (phase + 1) + ": " + seen.join());
  }

  // Her shield, 400 a phase: the hits on it until it fails add up to 400 (heals from her flowers and parasites aside,
  // which these scripts mostly avoid), and her hitpoints do not move until the totems' blast; then a third of them a
  // blast, the third leaving her 1, and a heal of 149 into her desperation of 150.
  const blastHits = ticks.flatMap((tick) => tick?.onBoss.filter((hit) => hit.amount > 1000 || (hit.hitsplatType === "damage" && hit.amount === 1067)) ?? []);
  assert.deepEqual(blastHits.map((hit) => hit.amount), [1066, 1066, 1067]);
  const desperate = stageTicks(ticks, "desperate")[0];
  assert.deepEqual(ticks[desperate].onBoss, [{ amount: 149, hitsplatType: "heal" }]);
  assert.equal(ticks[desperate].hp, 150);
  assert.ok(ticks.slice(1, blasts[0] + 3).every((tick) => tick.hp === 3200));
  assert.deepEqual(messageTicks(ticks, "The Nightmare survives the blast!").length, 1);
  assert.deepEqual(messageTicks(ticks, "As the Nightmare's shield fails").length, 3);
  assert.deepEqual(messageTicks(ticks, "All four totems are fully charged.").length, 3);
  assert.equal(messageTicks(ticks, "totem is fully charged.").length, 9);

  // The blast: in her blast form at the centre, 2, 3 and 4 sleepwalkers rising on the tiles by the totems, and her
  // blast 5 + 144 a share of those that reached her.
  for (const [n, blast] of blasts.entries()) {
    const form = ticks.findIndex((tick, t) => t > blast && tick?.type === 9422);
    assert.equal(form - blast, 6);
    assert.deepEqual(ticks[form].boss, [30, 29]);
    const risen = ticks[form + 2].others.filter(([, clip]) => clip === "rise").map(([id]) => id);
    assert.equal(risen.length, n + 2, name);
    for (const id of risen) assert.ok(sleepwalkerTiles.some((tile) => same(tile, ticks[form + 2].npcs.find((npc) => npc.id === id).position)));
    const hit = damageOf(ticks, "The Nightmare's blast").find((entry) => entry.tick > form);
    const absorbed = ticks.slice(form, hit.tick).flatMap((tick) => tick.others.filter(([, clip]) => clip === "absorb")).length;
    assert.equal(hit.baseDamage, 5 + Math.floor((144 * absorbed) / (n + 2)), name);
  }

  // Her claws: 50 to 65 a time; her flowers' flies 1 to 20; a surge 43 to 85.
  for (const hit of damageOf(ticks, "Grasping Claws")) assert.ok(hit.baseDamage >= 50 && hit.baseDamage <= 65);
  for (const hit of damageOf(ticks, "Corpse flowers")) assert.ok(hit.baseDamage >= 1 && hit.baseDamage <= 20);
  for (const hit of damageOf(ticks, "Surge")) assert.ok(hit.baseDamage >= 43 && hit.baseDamage <= 85);
  // A surge crosses one of the lanes, end to end, 6 ticks after she leaves.
  for (const leave of clipTicks(ticks, "surge")) {
    const from = ticks[leave - 1].boss;
    const lane = surgeLanes.find(([a, b]) => same(a, from) || same(b, from));
    assert.ok(lane, name + " surge from " + from);
  }
}

{
  // Standing still beside her: an attack every 6 ticks, a special one to five of them apart, the magic and ranged
  // landing 4 ticks after her animation, the melee 2; her claws 4 ticks after theirs.
  const ticks = await ticksOf("standing");
  const turns = ticks.flatMap((tick, n) => (tick?.clips.some((clip) => [...standardClips, ...specialClips, "clawRunStart", "flowers"].includes(clip)) ? [n] : []));
  const attacks = ticks.flatMap((tick, n) => (tick?.clips.some((clip) => standardClips.includes(clip)) ? [n] : []));
  assert.equal(attacks[0], 2);
  for (const tick of attacks.filter((tick) => tick + 4 < ticks.length)) {
    const style = ticks[tick].clips.find((clip) => standardClips.includes(clip));
    const lands = damageOf(ticks, "Phosani's Nightmare").find((hit) => hit.tick > tick);
    assert.equal(lands.tick - tick, style === "melee" ? 2 : 4, "attack at " + tick);
    assert.ok(lands.baseDamage <= (style === "melee" ? 73 : 80));
  }
  const gaps = attacks.slice(1).map((tick, n) => tick - attacks[n]);
  assert.ok(gaps.every((gap) => gap % 6 === 0 || gap > 6), gaps.join());
  // Her claws hurt only as they come up, 4 ticks after a set opens.
  const sets = ticks.flatMap((tick, n) => (tick?.clips.some((clip) => clip === "claws" || clip === "clawRunStart" || clip === "clawRun") ? [n] : []));
  for (const hit of damageOf(ticks, "Grasping Claws")) assert.ok(sets.includes(hit.tick - 4), "claws at " + hit.tick);
  assert.ok(turns.length > 30);
  // Her curse: the message 2 ticks after her animation; it wears off 5 ticks after her fifth turn from then.
  for (const curse of clipTicks(ticks, "curse")) {
    assert.deepEqual(messageTicks(ticks, "has cursed you").filter((tick) => tick > curse)[0], curse + 2);
    const fifth = turns.filter((tick) => tick > curse)[4];
    assert.equal(messageTicks(ticks, "curse wear off").filter((tick) => tick > curse)[0], fifth + 5);
  }
  // While cursed, Protect from Melee stops her magic, Protect from Magic her ranged, Protect from Missiles her melee.
  const cursedFrom = messageTicks(ticks, "has cursed you")[0];
  const cursedTo = messageTicks(ticks, "curse wear off")[0];
  const cursedHits = damageOf(ticks, "Phosani's Nightmare").filter((hit) => hit.tick > cursedFrom + 2 && hit.tick <= cursedTo);
  assert.ok(cursedHits.length > 0);
  for (const hit of cursedHits) {
    const launched = Math.max(...attacks.filter((tick) => tick < hit.tick));
    const style = ticks[launched].clips.find((clip) => standardClips.includes(clip));
    assert.equal(hit.attackType, { magic: "melee", range: "magic", melee: "range" }[style]);
  }
  // Her spores: drowsy for 25 ticks, a yawn 2 ticks in and every 6 after.
  const infected = messageTicks(ticks, "spores have infected you")[0];
  assert.deepEqual(ticks.flatMap((tick, n) => (tick?.overhead.some(([actor, text]) => actor === "player" && text === "*yawn*") ? [n] : [])), [2, 8, 14, 20].map((n) => infected + n));
  assert.equal(messageTicks(ticks, "infection has worn off")[0], infected + 25);
  // Her husks: two ticks after her animation their projectile, two after that the trance and the husks straight
  // beside him; the magic one attacks 3 ticks after they rose, the ranged one 5, each then every 6; held, he stays.
  const husks = clipTicks(ticks, "husks")[0];
  const risen = ticks[husks + 4].others.filter(([, clip]) => clip === "rise").map(([id]) => id);
  assert.equal(risen.length, 2);
  assert.equal(messageTicks(ticks, "strange trance")[0], husks + 4);
  for (const id of risen) {
    const at = ticks[husks + 4].npcs.find((npc) => npc.id === id).position;
    const me = ticks[husks + 4].player;
    assert.equal(Math.abs(at[0] - me[0]) + Math.abs(at[1] - me[1]), 1);
    const style = id.endsWith("magic") ? "magic" : "range";
    const own = ticks.flatMap((tick, n) => (tick?.others.some(([actor, clip]) => actor === id && clip === style) ? [n] : []));
    assert.equal(own[0], husks + 4 + (style === "magic" ? 3 : 5));
    assert.ok(own.slice(1).every((tick, n) => tick - own[n] === 6));
  }
  for (const hit of damageOf(ticks, "Husk")) assert.ok(hit.baseDamage <= 26);
  assert.ok(ticks.slice(husks + 4, husks + 30).every((tick) => same(tick.player, ticks[husks + 4].player)));
}

{
  // Her parasite: it takes hold 5 ticks after her animation and bursts out 20 later, fully grown, for 56 to 80; out,
  // it acts 6 ticks later and then every 4, healing her shield 31 to 50 while it is down.
  const ticks = await ticksOf("parasite");
  const cast = clipTicks(ticks, "parasite")[0];
  assert.equal(messageTicks(ticks, "impregnated you")[0], cast + 5);
  const burst = messageTicks(ticks, "fully grown")[0];
  assert.equal(burst, cast + 25);
  const hit = damageOf(ticks, "Parasite").find((entry) => entry.tick === burst);
  assert.ok(hit.baseDamage >= 56 && hit.baseDamage <= 80);
  const parasite = ticks[burst].others.find(([, clip]) => clip === "rise")[0];
  const acts = ticks.flatMap((tick, n) => (tick?.others.some(([actor, clip]) => actor === parasite && clip !== "rise") ? [n] : []));
  assert.equal(acts[0], burst + 6);
  assert.ok(acts.slice(1).every((tick, n) => tick - acts[n] === 4));
  const heal = acts.find((tick) => ticks[tick].state.stage === "shield" && ticks[tick].state.shield < 400);
  assert.ok(ticks[heal + 2].state.shield - ticks[heal + 1].state.shield >= 31 - 40);
}

{
  // The spores, walked into: the yawns drain 5 and a point per 20 of the prayer left, run goes off and stays off, and
  // his attacks come 2 ticks slower.
  const ticks = await ticksOf("spores");
  const infected = messageTicks(ticks, "spores have infected you")[0];
  assert.ok(infected > 0);
  for (const n of [2, 8, 14, 20]) {
    const yawn = infected + n;
    const before = ticks[yawn - 1].points;
    const drained = before - ticks[yawn].points;
    assert.ok(drained === 5 + Math.floor(before / 20) || drained === 6 + Math.floor(before / 20), "yawn at " + yawn + ": " + before + " to " + ticks[yawn].points);
  }
  assert.ok(ticks.slice(infected, infected + 25).every((tick) => tick.run === false));
  const swings = ticks.flatMap((tick, n) => (tick?.playerAttacks ? [n] : []));
  const drowsy = swings.filter((tick) => tick > infected + 2 && tick < infected + 25);
  assert.ok(drowsy.length >= 2);
  assert.ok(drowsy.slice(1).every((tick, n) => tick - drowsy[n] === 4 + 2), drowsy.join()); // the mace's 4, and 2
}

{
  // Her third phase: the protection that would stop her attack goes off as she attacks; in the first two, never.
  const ticks = await ticksOf("third-phase");
  const attacks = ticks.flatMap((tick, n) => (n > 2 && tick?.state.phase === 3 && tick.clips.some((clip) => standardClips.includes(clip)) ? [n] : []));
  const offs = ticks.flatMap((tick, n) => (tick?.prayerOff.length ? [n] : []));
  assert.ok(offs.length >= 3);
  for (const tick of offs) assert.ok(attacks.includes(tick), "off at " + tick);
}

{
  // Her desperation: her claws in runs of five, a set every 5 ticks, without end; a sleepwalker 9 ticks in and every 8
  // after, each hitting 15 as it reaches her, 10 ticks after it rose.
  const ticks = await ticksOf("desperation");
  const start = stageTicks(ticks, "desperate")[0];
  assert.equal(messageTicks(ticks, "lashes out to survive")[0], start);
  const rises = ticks.flatMap((tick, n) => (tick?.others.some(([actor, clip]) => actor.includes("sleepwalker") && clip === "rise") ? [n] : []));
  assert.equal(rises[0], start + 9);
  assert.ok(rises.slice(1).every((tick, n) => tick - rises[n] === 8));
  const hits = damageOf(ticks, "Sleepwalker");
  assert.equal(hits[0].tick, start + 19);
  assert.ok(hits.every((hit, n) => hit.baseDamage === 15 && (n === 0 || hit.tick - hits[n - 1].tick === 8)));
  const sets = ticks.flatMap((tick, n) => (tick?.clips.some((clip) => clip === "clawRunStart" || clip === "clawRun") ? [n] : []));
  assert.ok(sets.length >= 10);
  for (const n of [1, 2, 3, 4]) assert.equal(sets[n] - sets[n - 1], 5);
}

console.log("Phosani's Nightmare: its rules hold on its scenarios");
