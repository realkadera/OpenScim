// Araxxor's rules as the recorded kills, the wiki and tsps have them, asserted
// on the determinism harness's scenarios (tools/determinism/scenarios/araxxor.mjs).
// Their digests say that nothing changed; this says what it is.
import assert from "node:assert/strict";
import { runScenario } from "../tools/determinism/harness.mjs";
import { scenarios } from "../tools/determinism/scenarios/araxxor.mjs";

// Runs a scenario and gives each tick: his and the player's tiles, the clips that started, the acid, the messages ...
async function ticksOf(name, change = {}) {
  const ticks = [];
  await runScenario({ ...scenarios.find((scenario) => scenario.name === "araxxor/" + name), ...change }, {
    onTick(tick, engine) {
      const events = engine.getLastTickEvents(), { state } = engine.getEncounterSnapshot();
      const npcs = engine.worldState.getNpcs();
      const boss = engine.worldState.getNpc("araxxor");
      ticks[tick] = {
        boss: [...boss.position], bossTarget: boss.combat.targetId, player: [...engine.player().position], enraged: state.enraged, outcome: engine.getEncounterOutcome().phase,
        clips: events.filter((event) => event.type === "inferno_visual").flatMap((event) => event.animations.map(({ actorId, clipId }) => actorId + " " + clipId)),
        pools: state.pools.map(String), ids: npcs.map((npc) => npc.id),
        messages: events.filter((event) => event.type === "game_message").map((event) => event.segments.map(({ text }) => text).join("")),
        hits: events.filter((event) => event.type === "hit_applied").map(({ targetId, damage, attackKind }) => ({ targetId, damage, attackKind })),
        damage: engine.damageHistory.filter((hit) => hit.tick === tick).map(({ source, effectiveDamage }) => ({ source, effectiveDamage })),
        defenceDrain: boss.debuffs?.defenceDrain ?? 0, hp: boss.vitals.hp,
        npcs: new Map(npcs.map((npc) => [npc.id, { position: [...npc.position], alive: npc.alive, deathAnimationTick: npc.deathAnimationTick }])),
      };
    },
  });
  return ticks;
}
const first = (ticks, clip, from = 0) => ticks.findIndex((tick, n) => n >= from && tick?.clips.includes(clip));
const all = (ticks, clip) => ticks.flatMap((tick, n) => (tick?.clips.includes(clip) ? [n] : []));
const newPools = (ticks, n) => ticks[n].pools.filter((tile) => !ticks[n - 1].pools.includes(tile)).sort();

{
  // He attacks from where he stands as the tick begins, and steps in the same tick, straight.
  const ticks = await ticksOf("magic-and-step");
  const shot = ticks.findIndex((tick) => tick?.clips.some((clip) => ["araxxor magic", "araxxor ranged"].includes(clip)));
  assert.equal(shot, 55);
  assert.deepEqual([ticks[54].boss, ticks[55].boss], [[47, 22], [47, 23]]);
  assert.ok(!ticks[55].clips.includes("araxxor attack"));
}
{
  // The ball: from his edge in one of eight directions; at a player at 51,29 north, from 50,28.
  const ticks = await ticksOf("ball-north");
  const thrown = first(ticks, "araxxor ball");
  const path = [2, 3, 4, 5, 6, 7].map((n) => ticks[thrown + n].npcs.get("acid-ball-1")?.position.join());
  assert.deepEqual(path, ["49,27", "49,29", "49,31", "49,33", "49,34", "49,34"]);
  assert.deepEqual([0, 1, 2, 3, 4].map((n) => ticks[thrown + n].bossTarget), [null, null, null, null, "player"]);
}
{
  // The Mirrorback: no share for its first two ticks, then a fifth on the tick of the hit and half of that
  // back, rounded down; killed, it goes 3 ticks later, its death animation the tick after the hit.
  const ticks = await ticksOf("mirrorback");
  const hatched = ticks.findIndex((tick) => tick?.ids.includes("araxyte-0"));
  let shares = 0;
  for (let n = hatched; n < ticks.length; n++) {
    const taken = ticks[n].hits.find((hit) => hit.targetId === "araxxor" && hit.attackKind !== "typeless")?.damage ?? 0;
    const share = ticks[n].hits.find((hit) => hit.targetId === "araxyte-0" && hit.attackKind === "typeless")?.damage ?? 0;
    const recoil = ticks[n].damage.find((hit) => /reflection/.test(hit.source))?.effectiveDamage;
    if (n < hatched + 3) assert.equal(share, 0);
    else if (share > 0) {
      shares++;
      assert.equal(share, Math.floor((taken + share) / 5));
      assert.equal(recoil, Math.floor(share / 2));
    }
  }
  assert.ok(shares > 1);
  const killed = ticks.findIndex((tick, n) => n > hatched && tick.npcs.get("araxyte-0")?.alive === false);
  assert.equal(ticks[killed].npcs.get("araxyte-0").deathAnimationTick, killed + 1);
  assert.deepEqual([2, 3].map((n) => ticks[killed + n].ids.includes("araxyte-0")), [true, false]);
}
{
  // Off his corner, 2 tiles away: one pool. After the cleave he stands for 2 ticks, then comes.
  const ticks = await ticksOf("cleave-off-corner");
  const cleave = first(ticks, "araxxor cleave");
  assert.deepEqual([ticks[cleave - 1].boss, ticks[cleave - 1].player], [[47, 22], [45, 30]]);
  assert.deepEqual(newPools(ticks, cleave + 2), ["45,30"]);
  assert.deepEqual([0, 1, 2, 3].map((n) => ticks[cleave + n].boss.join()), ["47,22", "47,22", "47,22", "46,23"]);
}
{
  // The boots: a shot that would have hurt is negated, at most one in 8 ticks, with the message as he shoots;
  // a cleave, at most one in 20, with the message 2 ticks after the swing.
  const message = "Your Aranea boots let you avoid the spider-based attack.";
  const ticks = await ticksOf("aranea-boots");
  const said = ticks.flatMap((tick, n) => (tick?.messages.includes(message) ? [n] : []));
  const enraged = ticks.findIndex((tick) => tick?.enraged);
  const shots = said.filter((n) => n < enraged), cleaves = said.filter((n) => n >= enraged);
  assert.ok(shots.length > 1 && cleaves.length > 1, `${shots} / ${cleaves}`);
  const shotTicks = all(ticks, "araxxor ranged"), cleaveTicks = all(ticks, "araxxor cleave");
  shots.forEach((n, i) => {
    assert.ok(shotTicks.includes(n));
    if (i) assert.ok(n - shots[i - 1] >= 8);
    assert.deepEqual(ticks[n + 3].hits.filter((hit) => hit.attackKind === "range_arrow").map((hit) => hit.damage), [0]);
  });
  cleaves.forEach((n, i) => {
    assert.ok(cleaveTicks.includes(n - 2));
    if (i) assert.ok(n - cleaves[i - 1] >= 20);
    assert.ok(!ticks[n - 1].damage.some((hit) => /cleave/.test(hit.source)));
  });
  // Without them none is, and some hurt.
  const worn = scenarios.find(({ name }) => name === "araxxor/aranea-boots").equipment;
  const bare = await ticksOf("aranea-boots", { equipment: { ...worn, boots: undefined } });
  assert.ok(!bare.some((tick) => tick?.messages.includes(message)));
  assert.ok(bare.some((tick) => tick?.damage.some((hit) => /cleave/.test(hit.source) && hit.effectiveDamage > 0)));
}
{
  // His Defence goes down by 45 levels and no further, enraged too.
  const ticks = await ticksOf("defence-drain");
  const drains = ticks.map((tick) => tick.defenceDrain), enraged = ticks.findIndex((tick) => tick.enraged);
  assert.ok(Math.max(...drains.slice(0, enraged)) === 45, `${drains}`);
  assert.equal(Math.max(...drains), 45);
}
{
  // His death: the acid with the killing hit, his animation the tick after; the araxytes die with it and go 2
  // ticks later, the eggs crumble a tick after it and go 2 after that; won 5 ticks after it.
  const ticks = await ticksOf("enrage-and-kill");
  const killed = ticks.findIndex((tick) => tick?.hp === 0), animation = ticks[killed].npcs.get("araxxor").deathAnimationTick;
  const eggs = ticks[killed].ids.filter((id) => id.startsWith("araxxor-egg")), araxytes = ticks[killed].ids.filter((id) => id.startsWith("araxyte-"));
  assert.ok(eggs.length > 0 && araxytes.length > 0);
  assert.equal(animation, killed + 1);
  assert.deepEqual(ticks[killed].pools, []);
  assert.ok(ticks[animation].clips.some((clip) => /^araxyte-\d (explode|death)$/.test(clip)));
  for (const egg of eggs) assert.ok(ticks[animation + 1].clips.includes(egg + " crumble"));
  const here = (n, ids) => ticks[n].ids.filter((id) => ids.includes(id)).length;
  assert.deepEqual([1, 2].map((n) => here(animation + n, araxytes)), [araxytes.length, 0]);
  assert.deepEqual([2, 3].map((n) => here(animation + n, eggs)), [eggs.length, 0]);
  assert.deepEqual([4, 5].map((n) => ticks[animation + n].outcome), ["resolving", "victory"]);
}
console.log("Araxxor's rules are as recorded");
process.exit(0);
