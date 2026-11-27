// Nex's rules as the recordings and the wiki have them (client/encounters/nex/),
// asserted on the determinism harness's scenarios
// (tools/determinism/scenarios/nex.mjs). Their digests say that nothing
// changed; this says what it is.
import assert from "node:assert/strict";
import { runScenario } from "../tools/determinism/harness.mjs";
import { scenarios } from "../tools/determinism/scenarios/nex.mjs";
import { chebyshev } from "../client/encounters/nex/ids.js";

const BOSS = "nex";
const standardClips = ["melee", "magic", "cast"];
const specialWords = {
  "Let the virus flow through you!": "choke", "There is...": "dash", "Embrace darkness!": "darkness", "Fear the shadow!": "smash",
  "A siphon will solve this!": "siphon", "I demand a blood sacrifice!": "sacrifice", "Contain this!": "containment", "Die now, in a prison of ice!": "prison",
};

// Runs a scenario and gives each tick: her tile and hitpoints, her clips, her words, the hitsplats on her, the
// damage the player took, the NPCs, the party and the encounter's snapshot.
async function ticksOf(name) {
  const ticks = [];
  const result = await runScenario(scenarios.find((scenario) => scenario.name === "nex/" + name), {
    onTick(tick, engine) {
      const events = engine.getLastTickEvents();
      const visuals = events.filter((event) => event.type === "inferno_visual");
      const boss = engine.worldState.getNpc(BOSS);
      ticks[tick] = {
        boss: boss && [...boss.position], hp: boss?.vitals.hp, type: boss?.npcTypeId,
        clips: visuals.flatMap((event) => event.animations.filter((a) => a.actorId === BOSS).map((a) => a.clipId)),
        words: events.filter((event) => event.type === "overhead_text" && event.anchor.actorId === BOSS).map((event) => event.overheadText),
        coughs: events.filter((event) => event.type === "overhead_text" && event.overheadText === "*Cough*").map((event) => event.anchor.actorId),
        messages: events.filter((event) => event.type === "game_message").map((event) => event.segments.map(({ text }) => text).join("")),
        onBoss: events.filter((event) => event.type === "hitsplat_spawned" && event.targetId === BOSS).map(({ amount, hitsplatType }) => ({ amount, hitsplatType })),
        damage: engine.damageHistory.filter((hit) => hit.tick === tick && hit.targetId === "player").map(({ source, baseDamage, effectiveDamage, attackType }) => ({ source, baseDamage, effectiveDamage, attackType })),
        npcs: engine.worldState.getNpcs().filter((npc) => npc.alive).map((npc) => ({ id: npc.id, position: [...npc.position], hp: npc.vitals.hp, type: npc.npcTypeId })),
        player: [...engine.player().position],
        state: engine.getEncounterSnapshot().state,
        outcome: engine.getEncounterOutcome().phase,
      };
    },
  });
  assert.ok(result.replayMatches, name + ": the replay ends where the run did");
  return ticks;
}
const wordTicks = (ticks, words) => ticks.flatMap((tick, n) => (tick?.words.includes(words) ? [n] : []));
const phaseStarts = (ticks) => ticks.flatMap((tick, n) => (tick && n > 0 && tick.state.stage === "fight" && (ticks[n - 1]?.state.phase !== tick.state.phase || ticks[n - 1]?.state.stage !== "fight") ? [[n, tick.state.phase]] : []));

// --- the kill, a team of four ------------------------------------------------
{
  const ticks = await ticksOf("kill");
  const last = ticks.length - 1;
  assert.equal(ticks[last].outcome, "victory", "kill: she dies");
  assert.equal(ticks[1].state.party.length, 4, "a team of four by default: the player and three teammates");

  // OBS: her intro, 4 ticks between her calls; then her five phases in their order.
  assert.deepEqual(["AT LAST!", "Fumus!", "Umbra!", "Cruor!", "Glacies!", "Fill my soul with smoke!"].map((words) => wordTicks(ticks, words)[0]), [1, 5, 9, 13, 17, 21]);
  assert.deepEqual(phaseStarts(ticks).map(([, phase]) => phase), ["smoke", "shadow", "blood", "ice", "zaros"]);

  // OBS: 4 ticks between her attacks; a special after five of them, the phase's two taking turns, her virus first.
  for (const [start, phase] of phaseStarts(ticks)) {
    const end = phaseStarts(ticks).find(([n]) => n > start)?.[0] ?? last;
    const actions = [];
    for (let n = start; n < end; n++) {
      const special = ticks[n].words.map((words) => specialWords[words]).find(Boolean);
      if (special) actions.push({ n, special });
      // (her blood sacrifice, unleashed, casts too: part of the special)
      else if (ticks[n].clips.some((clip) => standardClips.includes(clip)) && !ticks[n].words.length && !ticks[n].messages.some((m) => m.includes("unleashes"))) actions.push({ n, special: null });
    }
    if (phase === "zaros") {
      assert.ok(actions.every((action) => action.special === null), "zaros: no specials");
      continue;
    }
    const specials = actions.filter((action) => action.special);
    assert.ok(specials.length >= 2, `${phase}: both specials (${specials.map((s) => s.special)})`);
    if (phase === "smoke") assert.equal(specials[0].special, "choke", "smoke: her virus first");
    for (let index = 1; index < specials.length; index++) {
      assert.notEqual(specials[index].special, specials[index - 1].special, `${phase}: her two specials take turns`);
      const between = actions.filter((action) => !action.special && action.n > specials[index - 1].n && action.n < specials[index].n);
      assert.equal(between.length, 5, `${phase}: five attacks between specials (ticks ${specials[index - 1].n}-${specials[index].n})`);
    }
    const standard = actions.filter((action) => !action.special);
    for (let index = 1; index < standard.length; index++) {
      const gap = standard[index].n - standard[index - 1].n;
      const special = specials.some((s) => s.n > standard[index - 1].n && s.n < standard[index].n);
      if (!special) assert.ok(gap === 4 || gap === 2 || gap > 8, `${phase}: 4 ticks between her attacks (${standard[index - 1].n}-${standard[index].n})`);
    }
  }

  // WIKI, OBS: the mage called at each fifth of her hitpoints; 170 more, then she is immune until it dies.
  for (const [name, threshold] of [["Fumus", 2720], ["Umbra", 2040], ["Cruor", 1360], ["Glacies", 680]]) {
    const called = wordTicks(ticks, `${name}, don't fail me!`)[0];
    assert.ok(called, `${name} called`);
    assert.ok(ticks[called].hp <= threshold && ticks[called - 1].hp > threshold - 400, `${name}: called as she fell to ${threshold} (${ticks[called].hp})`);
    const dead = ticks.findIndex((tick, n) => n > called && tick && !tick.npcs.some((npc) => npc.id === `nex-${name.toLowerCase()}`));
    for (let n = called; n < dead; n++) assert.ok(ticks[n].hp >= threshold - 170, `${name}: no lower than ${threshold - 170} while it lives (tick ${n}: ${ticks[n].hp})`);
  }

  // OBS: the damage less her heals is her 3,400; she heals 500 as her Zaros phase starts.
  const dealt = ticks.reduce((sum, tick) => sum + (tick?.onBoss ?? []).filter((hit) => hit.hitsplatType !== "heal").reduce((s, hit) => s + hit.amount, 0), 0);
  const healed = ticks.reduce((sum, tick) => sum + (tick?.onBoss ?? []).filter((hit) => hit.hitsplatType === "heal").reduce((s, hit) => s + hit.amount, 0), 0);
  assert.ok(dealt - healed >= 3400 && dealt - healed <= 3400 + 4 * 170, `3,400 dealt net of her heals, the transitions' overflow aside (${dealt} - ${healed})`);
  const zaros = phaseStarts(ticks).find(([, phase]) => phase === "zaros")[0];
  assert.ok(ticks[zaros].onBoss.some((hit) => hit.hitsplatType === "heal" && hit.amount === 500), "zaros: she heals 500");

  // OBS: her siphon brings two reavers for four; the reavers die as her ice phase starts.
  const siphons = wordTicks(ticks, "A siphon will solve this!");
  assert.ok(siphons.length >= 1, "a siphon");
  for (const n of siphons) {
    const reavers = ticks[n + 1].npcs.filter((npc) => npc.id.startsWith("nex-reaver") && !ticks[n - 1].npcs.some((other) => other.id === npc.id));
    assert.ok(reavers.length >= 1 && reavers.length <= 2, `siphon at ${n}: 1 or 2 reavers for four (${reavers.length})`);
  }
  const ice = phaseStarts(ticks).find(([, phase]) => phase === "ice")[0];
  assert.ok(!ticks[ice + 1].npcs.some((npc) => npc.id.startsWith("nex-reaver")), "no reavers into her ice phase");

  // OBS: her smoke dash: at the far end of an aisle 5 ticks after "There is...", back the next tick.
  for (const n of wordTicks(ticks, "There is...")) {
    const at = ticks[n + 5].boss;
    assert.equal(chebyshev(at, ticks[n].boss), 10, `dash at ${n}: at an aisle's end, 10 tiles off (${at})`);
    assert.deepEqual(ticks[n + 6].boss, ticks[n].boss, `dash at ${n}: back where she was`);
  }
  // OBS (27th): a member's coughs 3 ticks apart.
  const coughs = ticks.flatMap((tick, n) => (tick?.coughs.length ? [n] : []));
  assert.ok(coughs.length > 10, "coughing");
  const byMember = new Map();
  ticks.forEach((tick, n) => tick?.coughs.forEach((id) => byMember.set(id, [...(byMember.get(id) ?? []), n])));
  for (const [id, at] of byMember) for (let index = 1; index < at.length; index++) {
    const gap = at[index] - at[index - 1];
    assert.ok(gap === 3 || gap > 5, `${id} coughs 3 ticks apart (${at[index - 1]}-${at[index]})`);
  }

  // OBS (27th): her Zaros forms: none until her first attack, then Soul Split (11280), Deflect Melee (11281), none
  // (11278), four of her attacks each; 11282 as she dies.
  const wrath = wordTicks(ticks, "Taste my wrath!")[0];
  const forms = ticks.slice(zaros, wrath).map((tick) => tick?.type).filter((type, index, all) => type !== all[index - 1]);
  assert.deepEqual(forms.slice(0, 4), [11278, 11280, 11281, 11278], `zaros: her forms in turn (${forms})`);
  const firstAttack = ticks.findIndex((tick, n) => n > zaros && tick?.clips.some((clip) => standardClips.includes(clip)));
  assert.equal(ticks[firstAttack].type, 11280, "zaros: Soul Split with her first attack");
  assert.equal(ticks[wrath + 1].type, 11282, "her dying form");
  // OBS (27th): under Soul Split she heals by her hits.
  const soulHeals = ticks.slice(zaros + 1, wrath).flatMap((tick) => (tick?.onBoss ?? []).filter((hit) => hit.hitsplatType === "heal"));
  assert.ok(soulHeals.length >= 1, "zaros: Soul Split heals her");
  // As she dies, her wrath; then the MVP (WIKI: the most damage; OBS (27th): the game's words).
  assert.ok(wordTicks(ticks, "Taste my wrath!").length === 1, "her wrath");
  const mvp = ticks.flatMap((tick) => (tick?.messages ?? []).filter((text) => /MVP for this fight/.test(text)));
  assert.equal(mvp.length, 1, `the MVP, once (${mvp})`);
}

// --- alone ---------------------------------------------------------------------
{
  const ticks = await ticksOf("solo");
  assert.equal(ticks[1].state.party.length, 1, "solo: the player alone");
  assert.ok(!ticks[1].npcs.some((npc) => npc.id.startsWith("nex-mate")), "solo: no teammates");
  // Her virus has no one else to go to.
  const choke = wordTicks(ticks, "Let the virus flow through you!")[0];
  assert.ok(ticks.slice(choke + 1, choke + 6).some((tick) => tick.coughs.includes("player")), "solo: the player coughs");
  // OBS (27th): it catches a tick after her words, the first cough a tick later, gone 15 ticks after it caught.
  assert.ok(ticks[choke + 1].messages.includes("You become surrounded by smoke clouds!"), "solo: the virus catches a tick after her words");
  assert.ok(ticks[choke + 2].coughs.includes("player"), "solo: the first cough a tick after");
  assert.ok(ticks[choke + 16].messages.includes("The smoke clouds around you dissipate."), "solo: gone 15 ticks after it caught");
}

// --- standing in it, a team of five ----------------------------------------------
{
  const ticks = await ticksOf("standing");
  assert.equal(ticks[1].state.party.length, 5, "a team of five");
  const sources = new Set(ticks.flatMap((tick) => (tick?.damage ?? []).filter((hit) => hit.baseDamage > 0).map((hit) => hit.source)));
  for (const source of ["Nex", "Shadow Smash"]) assert.ok(sources.has(source), `standing: hit by ${source} (${[...sources]})`);
  // OBS: her shadows strike 4 ticks after "Fear the shadow!".
  for (const n of wordTicks(ticks, "Fear the shadow!")) {
    const struck = ticks[n + 4].damage.filter((hit) => hit.source === "Shadow Smash");
    const before = ticks.slice(n, n + 4).flatMap((tick) => tick.damage.filter((hit) => hit.source === "Shadow Smash"));
    assert.equal(before.length, 0, `shadows at ${n}: nothing before they strike`);
    assert.ok(struck.length <= 1, `shadows at ${n}: one hit on the player at most`);
    // OBS (27th): the game's words to whoever a shadow strikes.
    assert.equal(ticks[n + 4].messages.includes("Nex's shadow consumes you!"), struck.length === 1, `shadows at ${n}: "Nex's shadow consumes you!" with the hit`);
  }
  // OBS (27th): her darkness, 31 ticks from her words to "The darkness recedes." (unless her phase ends first).
  for (const n of wordTicks(ticks, "Embrace darkness!")) {
    assert.ok(ticks[n].messages.includes("Darkness begins to surround Nex."), `darkness at ${n}: begins with her words`);
    const end = ticks.findIndex((tick, at) => at > n && tick?.messages.includes("The darkness recedes."));
    if (end > 0) assert.equal(end - n, 31, `darkness at ${n}: recedes 31 ticks later`);
  }
}
console.log("nex rules ok");
