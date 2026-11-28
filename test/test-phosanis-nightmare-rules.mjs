// Phosani's Nightmare's rules as the logs, the wiki and tsps have them
// (client/encounters/phosanis-nightmare/), asserted on the determinism
// harness's scenarios (tools/determinism/scenarios/phosanis-nightmare.mjs).
// Their digests say that nothing changed; this says what it is.
import assert from "node:assert/strict";
import { runScenario } from "../tools/determinism/harness.mjs";
import { scenarios } from "../tools/determinism/scenarios/phosanis-nightmare.mjs";
import { formCycle, surgeLanes, sleepwalkerTiles, sleepwalkerRings, walkerTiles, totems, totemSize, same, gapTo, bossSize, spotAnims } from "../client/encounters/phosanis-nightmare/ids.js";

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
        locked: boss?.lockedFacing, facing: boss?.facing, crawl: boss?.crawlMovement && structuredClone(boss.crawlMovement),
        clawGraphics: visuals.flatMap((event) => event.graphics.filter((graphic) => graphic.spotAnimId === spotAnims.claw)),
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
// The ticks a set of her claws opened: a set that comes up 4 ticks later appears in the snapshot (in a run, only the
// first two sets come with an animation of hers).
const clawSetTicks = (ticks) => ticks.flatMap((tick, n) => (tick?.state.claws.some((set) => set.at === n + 4) ? [n] : []));
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
// The totem a sleepwalker's tile is by: the nearest one's corner.
const totemBy = ([x, y]) => {
  const middle = ({ tile: [tx, ty] }) => [tx + (totemSize - 1) / 2, ty + (totemSize - 1) / 2];
  return totems.reduce((best, totem) => (Math.hypot(x - middle(totem)[0], y - middle(totem)[1]) < Math.hypot(x - middle(best)[0], y - middle(best)[1]) ? totem : best)).corner;
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
  // Asleep as the run starts; the countdown, her waking, her first form on tick 27 (the Outside recording).
  assert.equal(ticks[1].type, 9423);
  assert.equal(ticks[1].state.stage, "asleep");
  assert.deepEqual(messageTicks(ticks, "will awaken in 10 seconds"), [3]);
  assert.deepEqual(messageTicks(ticks, "will awaken in 5 seconds"), [12]);
  assert.deepEqual(messageTicks(ticks, "has awoken"), [19]);
  assert.deepEqual(clipTicks(ticks, "wake"), [19]);
  assert.equal(shields[0], 27);
  const herTurns = ticks.flatMap((tick, n) => (tick?.clips.some((clip) => [...standardClips, ...specialClips, "flowers", "clawRunStart"].includes(clip)) ? [n] : []));
  for (let phase = 0; phase < 3; phase++) {
    const from = shields[phase];
    assert.equal(ticks[from].type, forms[phase], name + " phase " + (phase + 1));
    // Her first turn 2 ticks after she wakes, 1 after she takes her form again after a blast (the Outside recording).
    assert.equal(herTurns.find((tick) => tick >= from) - from, phase === 0 ? 2 : 1, name + " phase " + (phase + 1));
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
    // Each by another totem, all on one ring; the first two across from each other (the Outside recordings).
    const tiles = risen.map((id) => ticks[form + 2].npcs.find((npc) => npc.id === id).position);
    assert.equal(new Set(tiles.map(totemBy)).size, tiles.length, name + " " + JSON.stringify(tiles));
    assert.ok(sleepwalkerRings.some((ring) => tiles.every((tile) => ring.some((each) => same(each, tile)))), name + " " + JSON.stringify(tiles));
    if (n === 0) assert.ok(same([tiles[0][0] + tiles[1][0], tiles[0][1] + tiles[1][1]], [64, 62]), name + " " + JSON.stringify(tiles));
    const hit = damageOf(ticks, "The Nightmare's blast").find((entry) => entry.tick > form);
    const absorbed = ticks.slice(form, hit.tick).flatMap((tick) => tick.others.filter(([, clip]) => clip === "absorb")).length;
    assert.equal(hit.baseDamage, 5 + Math.floor((144 * absorbed) / (n + 2)), name);
    // They walk from their fourth tick, after her last phase their seventh; her blast 2 ticks after the last is gone,
    // killed or taken in (the Outside recordings).
    const gone = [];
    for (const id of risen) {
      const from = ticks[form + 2].npcs.find((npc) => npc.id === id).position;
      const moved = ticks.findIndex((tick, t) => t > form + 2 && tick?.npcs.some((npc) => npc.id === id && !same(npc.position, from)));
      if (moved > 0) assert.equal(moved - (form + 2), n === 2 ? 7 : 4, name + " " + id);
      const takenIn = ticks.findIndex((tick, t) => t > form && tick?.others.some(([actor, clip]) => actor === id && clip === "absorb"));
      gone.push(takenIn > 0 ? takenIn : ticks.findIndex((tick, t) => t > form + 2 && !tick?.npcs.some((npc) => npc.id === id)));
    }
    const blastClip = clipTicks(ticks, "blast").find((tick) => tick > form);
    assert.equal(blastClip, Math.max(...gone) + 2, name + " blast at " + blastClip + ", gone " + gone);
  }

  // Her claws: 50 to 65 a time; her flowers' flies 1 to 20; a surge 43 to 85.
  for (const hit of damageOf(ticks, "Grasping Claws")) assert.ok(hit.baseDamage >= 50 && hit.baseDamage <= 65);
  for (const hit of damageOf(ticks, "Corpse flowers")) assert.ok(hit.baseDamage >= 1 && hit.baseDamage <= 20);
  for (const hit of damageOf(ticks, "Surge")) assert.ok(hit.baseDamage >= 43 && hit.baseDamage <= 85);
  // Her surge: she slides along the lane (the scene over 2 ticks), facing along it from her landing at its start to 3
  // ticks after (the Outside recordings).
  for (const cross of clipTicks(ticks, "surge")) {
    const from = ticks[cross - 1].boss;
    assert.deepEqual(ticks[cross].crawl, { from, to: ticks[cross].boss, startTick: cross }, name + " surge at " + cross);
    for (let n = cross - 4; n <= cross + 2; n++) assert.equal(ticks[n].locked, ticks[cross].facing, name + " surge facing at " + n);
  }
  // A surge crosses one of the lanes, end to end, 6 ticks after she leaves.
  for (const leave of clipTicks(ticks, "surge")) {
    const from = ticks[leave - 1].boss;
    const lane = surgeLanes.find(([a, b]) => same(a, from) || same(b, from));
    assert.ok(lane, name + " surge from " + from);
  }
  // Cursed, the icon over him is that of the style his protection stops now (the Outside recordings); else his own.
  const shuffled = { ProtectMagic: "ProtectRange", ProtectRange: "ProtectMelee", ProtectMelee: "ProtectMagic" };
  const cursed = ticks.filter((tick) => tick?.state.cursed);
  assert.ok(cursed.some((tick) => tick.prayer), name);
  for (const tick of cursed) assert.equal(tick.state.playerOverheadPrayer, tick.prayer ? shuffled[tick.prayer] : null);
  // As the curse lands, a pink glow over the scene for 2 ticks (the wiki; a player's video), not the whole curse; the
  // prayer markers only with their practice aid (off here).
  const cursings = messageTicks(ticks, "has cursed you");
  assert.ok(cursings.length > 0, name);
  for (const [n, tick] of ticks.entries()) {
    if (!tick) continue;
    const from = cursings.find((at) => n === at || n === at + 1);
    assert.equal(tick.state.screenTint?.since, from, name + " glow at " + n);
  }
  assert.ok(ticks.every((tick) => !tick || tick.state.prayerMarkers === undefined));
  assert.ok(ticks.every((tick) => !tick || tick.state.cursed || tick.state.playerOverheadPrayer === undefined));

  // Asleep she faces south and does not turn to the player (the Outside recordings).
  for (let n = 1; n < 27; n++) assert.equal(ticks[n].locked, 0, name + " asleep at " + n);
  assert.equal(ticks[28].locked, undefined, name + " awake");
  // After each animation she takes no step, and keeps her facing, for a while (the Outside recordings): her magic and
  // ranged 5 ticks, her melee 4, her claws 9, her curse, spores, husks and parasite 5.
  const root = { magic: 5, range: 5, melee: 4, claws: 9, curse: 5, spores: 5, husks: 5, parasite: 5 };
  let checked = 0;
  for (const [n, tick] of ticks.entries()) {
    const clip = tick?.clips.find((each) => root[each]);
    if (!clip || !["shield", "totems"].includes(tick.state.stage)) continue;
    const span = ticks.slice(n, n + root[clip]);
    if (span.some((later) => later.state.stage !== tick.state.stage || later.clips.includes("leave"))) continue;
    for (const later of span) assert.deepEqual(later.boss, tick.boss, name + " " + clip + " at " + n);
    for (const later of span.slice(0, -1)) assert.equal(later.locked, tick.facing, name + " " + clip + " facing at " + n);
    checked++;
  }
  assert.ok(checked > 40, name + " " + checked);
  // A run of her claws: the start with its first set; the run held from the start's end to the run's (the game loops
  // it; the scene plays a clip once, so it comes again every 4 ticks).
  for (const start of clipTicks(ticks, "clawRunStart")) {
    // To its end, or to her blast that cuts it short: the tick the snapshot no longer has it.
    const end = ticks.findIndex((tick, n) => n > start && !tick?.state.clawRun);
    const held = clipTicks(ticks, "clawRun").filter((tick) => tick > start && tick < end);
    assert.deepEqual(held, held.map((_, n) => start + 4 * (n + 1)), name + " run at " + start);
    assert.ok(held.length > 0 && end - held.at(-1) <= 4, name + " run at " + start + ": " + held + " to " + end);
  }
}

{
  // A charged totem keeps its "Charge" option; clicked, the game's message on that tick, and no attack on it (the
  // Outside recordings of the group fight). The one he was charging stops him, without the message.
  const ticks = [];
  const result = await runScenario(scenarios.find((scenario) => scenario.name === "phosanis-nightmare/charged-totem"), {
    onTick(tick, engine) {
      const events = engine.getLastTickEvents();
      ticks[tick] = {
        messages: events.filter((event) => event.type === "game_message").map((event) => event.segments.map(({ text }) => text).join("")),
        onTotems: events.filter((event) => event.type === "attack_started" && event.sourceId === "player" && event.targetId.startsWith("nightmare-totem")).map((event) => event.targetId),
        target: engine.player().attackTarget,
        totems: engine.getEncounterSnapshot().state.totems,
      };
    },
  });
  assert.ok(result.replayMatches);
  const refused = messageTicks(ticks, "That totem is already charged.");
  assert.ok(refused.length >= 3, "refused at " + refused);
  for (const tick of refused) {
    assert.equal(ticks[tick].target, null, "target at " + tick);
    assert.deepEqual(ticks[tick].onTotems, [], "attack at " + tick);
  }
  // Never refused without a click: once per "fully charged".
  assert.ok(refused.length <= messageTicks(ticks, "totem is fully charged.").length);
}

{
  // His hit breaks her shield on the tick she lands at her surge's lane: no surge (Don Danz's recording). She stands
  // at the lane's start, goes for him from the next tick, and attacks 9 ticks after her leave.
  const ticks = await ticksOf("surge-nulled");
  const leave = clipTicks(ticks, "leave").find((tick) => ticks[tick].state.surge);
  assert.equal(leave, 131);
  const fails = messageTicks(ticks, "As the Nightmare's shield fails")[0];
  assert.equal(fails, leave + 2);
  assert.ok(ticks[leave + 1].onBoss.length + ticks[leave + 2].onBoss.length > 0, "hit while she leaves");
  assert.ok(surgeLanes.some(([a, b]) => same(a, ticks[leave + 2].boss) || same(b, ticks[leave + 2].boss)), "at a lane's start");
  assert.deepEqual(clipTicks(ticks, "surge"), []);
  assert.deepEqual(damageOf(ticks, "Surge"), []);
  assert.equal(ticks[leave + 2].state.surge, null);
  assert.ok(ticks.slice(leave + 3, leave + 8).some((tick) => !same(tick.boss, ticks[leave + 2].boss)), "she walks");
  const next = ticks.findIndex((tick, n) => n > leave && tick?.clips.some((clip) => [...standardClips, ...specialClips].includes(clip)));
  assert.equal(next, leave + 9);
}

{
  // Broken on the tick she crosses, the surge goes on.
  const ticks = await ticksOf("surge-crosses");
  const leave = clipTicks(ticks, "leave").find((tick) => ticks[tick].state.surge);
  assert.equal(messageTicks(ticks, "As the Nightmare's shield fails")[0], leave + 6);
  assert.deepEqual(clipTicks(ticks, "surge"), [leave + 6]);
}

{
  // Standing still beside her: an attack every 6 ticks, a special one to five of them apart, the magic and ranged
  // landing 4 ticks after her animation, the melee 2; her claws 4 ticks after theirs.
  const ticks = await ticksOf("standing");
  const turns = ticks.flatMap((tick, n) => (tick?.clips.some((clip) => [...standardClips, ...specialClips, "clawRunStart", "flowers"].includes(clip)) ? [n] : []));
  const attacks = ticks.flatMap((tick, n) => (tick?.clips.some((clip) => standardClips.includes(clip)) ? [n] : []));
  assert.equal(attacks[0], stageTicks(ticks, "shield")[0] + 2);
  for (const tick of attacks.filter((tick) => tick + 4 < ticks.length)) {
    const style = ticks[tick].clips.find((clip) => standardClips.includes(clip));
    const lands = damageOf(ticks, "Phosani's Nightmare").find((hit) => hit.tick > tick);
    assert.equal(lands.tick - tick, style === "melee" ? 2 : 4, "attack at " + tick);
    assert.ok(lands.baseDamage <= (style === "melee" ? 73 : 80));
  }
  const gaps = attacks.slice(1).map((tick, n) => tick - attacks[n]);
  assert.ok(gaps.every((gap) => gap % 6 === 0 || gap > 6), gaps.join());
  // Her claws hurt only as they come up, 4 ticks after a set opens; a set always has a portal under the player unless
  // her husks hold him (the Outside recording).
  const sets = clawSetTicks(ticks);
  for (const hit of damageOf(ticks, "Grasping Claws")) assert.ok(sets.includes(hit.tick - 4), "claws at " + hit.tick);
  // None under her but her body's corners (the Outside recordings), where she stood still that tick.
  const corner = ([x, y], [bx, by]) => (x === bx || x === bx + bossSize - 1) && (y === by || y === by + bossSize - 1);
  for (const set of sets) {
    const opened = ticks[set].state.claws.find((claws) => claws.at === set + 4);
    const her = ticks[set].boss;
    if (!ticks[set].state.held && gapTo(ticks[set].player, her) > 0) assert.ok(opened.tiles.some((tile) => same(tile, ticks[set].player)), "claws at " + set);
    if (same(her, ticks[set - 1].boss)) assert.ok(opened.tiles.every((tile) => gapTo(tile, her) > 0 || corner(tile, her)), "claws under her at " + set);
  }
  assert.ok(turns.length > 30);
  // Her curse: the message 2 ticks after her animation; it wears off 5 ticks after her fifth turn from then.
  for (const curse of clipTicks(ticks, "curse")) {
    assert.deepEqual(messageTicks(ticks, "has cursed you").filter((tick) => tick > curse)[0], curse + 2);
    // Her turns: her attacks and specials (a run of claws her spores or flowers start is not one).
    const own = ticks.flatMap((tick, n) => (tick?.clips.some((clip) => [...standardClips, ...specialClips].includes(clip)) ? [n] : []));
    const fifth = own.filter((tick) => tick > curse)[4];
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
  // Her desperation: her claws in runs of five, a set every 5 ticks, without end; a sleepwalker 2 ticks in and every 8
  // after, each taken in a tick after it is beside her and hitting 15 4 ticks after that, 19 ticks after her form (the
  // Outside recording).
  const ticks = await ticksOf("desperation");
  const start = stageTicks(ticks, "desperate")[0];
  assert.equal(messageTicks(ticks, "lashes out to survive")[0], start);
  const rises = ticks.flatMap((tick, n) => (tick?.others.some(([actor, clip]) => actor.includes("sleepwalker") && clip === "rise") ? [n] : []));
  assert.equal(rises[0], start + 2);
  assert.ok(rises.slice(1).every((tick, n) => tick - rises[n] === 8));
  const hits = damageOf(ticks, "Sleepwalker");
  assert.equal(hits[0].tick, start + 19);
  assert.ok(hits.every((hit, n) => hit.baseDamage === 15 && (n === 0 || hit.tick - hits[n - 1].tick === 8)));
  const takenIn = ticks.flatMap((tick, n) => (tick?.others.some(([actor, clip]) => actor.includes("sleepwalker") && clip === "absorb") ? [n] : []));
  assert.deepEqual(hits.map((hit) => hit.tick), takenIn.slice(0, hits.length).map((tick) => tick + 4));
  const sets = clawSetTicks(ticks);
  assert.ok(sets.length >= 10);
  assert.ok(sets.slice(1).every((tick, n) => tick - sets[n] === 5), sets.join());
  // One run without end: her start animation once, her run's held from then on, no end, and she stands (the Outside
  // recordings).
  assert.deepEqual(clipTicks(ticks, "clawRunStart"), [sets[0]]);
  const held = clipTicks(ticks, "clawRun");
  assert.ok(held.length > 5 && held.every((tick, n) => tick === sets[0] + 4 * (n + 1)), held.join());
  assert.deepEqual(clipTicks(ticks, "clawRunEnd"), []);
  assert.ok(ticks.slice(start).every((tick) => same(tick.boss, ticks[start].boss)));
}

{
  // Where a blast's sleepwalkers rise, over every turn of the rings: never two by one totem; two across from each
  // other (her centre, 3872, 9951, between them: local 32, 31), three of a ring, all four.
  for (let n = 0; n < 8; n++) {
    const rolls = [Math.floor(n / 4) / 2, (n % 4) / 4];
    for (const count of [2, 3, 4]) {
      let roll = 0;
      const tiles = walkerTiles(count, () => rolls[roll++]);
      assert.equal(tiles.length, count);
      assert.equal(new Set(tiles.map(totemBy)).size, count, JSON.stringify(tiles));
      if (count === 2) assert.deepEqual([tiles[0][0] + tiles[1][0], tiles[0][1] + tiles[1][1]], [64, 62]);
    }
  }
}

{
  // Her claws' portals lie on the floor, drawn over it (onGround), as the other fights' tile graphics are.
  const ticks = await ticksOf("kill");
  const portals = ticks.flatMap((tick) => tick?.clawGraphics ?? []);
  assert.ok(portals.length > 20);
  assert.ok(portals.every((portal) => portal.onGround === true && portal.height === 0 && portal.target.kind === "tile"));
}

{
  // A parasite growing: the hitpoints orb pink from "impregnated" until a cure weakens it (varbit 10151 in the
  // Outside recordings) or, with none drunk here, until it bursts out fully grown; not before or after.
  const ticks = await ticksOf("parasite");
  const ends = [...messageTicks(ticks, "The parasite within you has been weakened."), ...messageTicks(ticks, "bursts out of you, fully grown")];
  const growing = messageTicks(ticks, "impregnated you with a deadly parasite").map((from) => [from, Math.min(...ends.filter((end) => end > from))]);
  assert.ok(growing.length > 0 && growing.every(([from, to]) => to > from && to < Infinity), JSON.stringify(growing));
  ticks.forEach((tick, n) => tick && assert.equal(tick.state.hitpointsOrb, growing.some(([from, to]) => n >= from && n < to) ? "parasite" : undefined, "orb at " + n));
}

console.log("Phosani's Nightmare: its rules hold on its scenarios");
