// Combat achievements (client/combatAchievements/): the tracker reads a fight
// tick by tick and judges a kill against its boss's tasks; the store keeps the
// progress. Run on the Alchemical Hydra's scenarios
// (tools/determinism/scenarios/alchemical-hydra.mjs), its tasks being the first
// written (client/encounters/alchemical-hydra/combatAchievements.js).
import assert from "node:assert/strict";
import { runScenario, loadEnvironment } from "../tools/determinism/harness.mjs";
import { scenarios } from "../tools/determinism/scenarios/alchemical-hydra.mjs";

await loadEnvironment(); // its module hooks resolve the client's web-root imports
const { createCombatAchievementsTracker, getCombatAchievements, judgeKill, ticksUnder, formatTicks, tierPoints, killTicks, runSummary } = await import(
  "../client/combatAchievements/tracker.js"
);
const { createCombatAchievementsStore } = await import("../client/combatAchievements/store.js");
const { mergeChatMessages, tellCompleted, tellFailed, getChatMessages, clearChat } = await import("../client/combatAchievements/chat.js");

const memoryStorage = () => {
  const items = new Map();
  return { getItem: (key) => items.get(key) ?? null, setItem: (key, value) => items.set(key, String(value)) };
};
const scenario = (name) => scenarios.find((s) => s.name === "alchemical-hydra/" + name);

// Runs a scenario with a tracker reading each tick; its last run, and the tasks it completed.
async function track(name, storage = memoryStorage()) {
  return trackScenario(scenario(name), storage);
}
async function trackScenario(script, storage = memoryStorage()) {
  const store = createCombatAchievementsStore(storage);
  const completed = [];
  const failed = [];
  const aids = [];
  const tracker = createCombatAchievementsTracker({
    store,
    onComplete: (kind, tasks) => completed.push(...tasks.map((task) => task.id)),
    onFail: (kind, failures, tick) => failed.push(...failures.map(({ task, reason, repeat }) => [task.id, tick, reason, repeat])),
    onAssisted: (reasons, tick) => aids.push([reasons, tick]),
  });
  await runScenario(script, {
    onTick(tick, engine) {
      tracker.observe(engine, engine.getLastTickEvents());
    },
  });
  return { run: tracker.currentRun(), store, completed, failed, aids };
}

{
  // WIKI: Combat Achievements, its points; a speed task's "less than" as the most ticks under it.
  assert.deepEqual(tierPoints, { easy: 1, medium: 2, hard: 3, elite: 4, master: 5, grandmaster: 6 });
  assert.equal(ticksUnder(105), 174); // 174 ticks are 104.4 s, 175 are 105 s
  assert.equal(ticksUnder(80), 133); // 133 ticks are 79.8 s, 134 are 80.4 s
  assert.equal(formatTicks(174), "1:44.4");
}

{
  // The Hydra's twelve tasks, 61 points (WIKI: Combat Achievements/Tasks by boss).
  const { tasks } = getCombatAchievements("alchemical_hydra");
  assert.equal(tasks.length, 12);
  assert.equal(tasks.reduce((sum, task) => sum + tierPoints[task.tier], 0), 61);
  assert.equal(new Set(tasks.map((task) => task.id)).size, 12);
  assert.ok(tasks.every((task) => task.tracked), "all twelve judged: six by its own judges, six by the shared ones");
  assert.equal(getCombatAchievements("lobby"), null);
  // The Inferno is a part of the whole here: its tasks are listed, none judged.
  assert.ok(getCombatAchievements("inferno").tasks.length > 0 && getCombatAchievements("inferno").tasks.every((task) => !task.tracked));
  // A variant is kept under its boss: the awakened Duke's tasks are the Duke's.
  assert.equal(getCombatAchievements("duke_sucellus_awakened"), getCombatAchievements("duke_sucellus"));
}

{
  // The shared judges read the wiki's wording.
  const { sharedJudge } = await import("../client/combatAchievements/judges.js");
  const { combatAchievementTasks } = await import("../client/combatAchievements/tasks.js");
  const vorkath = { monster: "Vorkath", kinds: ["vorkath"] };
  const task = (description, monster = "Vorkath") => ({ monster, description });
  const limit = (judge) => {
    let ticks = 0;
    while (!judge.failed({ startTick: 0, killTick: null, lastTick: ticks })) ticks++;
    return ticks - 1;
  };
  // "less than" leaves the time out; "within" lets it in (inferred).
  assert.equal(limit(sharedJudge(task("Kill Vorkath in less than 54 seconds."), vorkath)), 89);
  assert.equal(limit(sharedJudge(task("Kill Vorkath in less than 1 minute and 15 seconds."), vorkath)), 124);
  assert.equal(limit(sharedJudge(task("Kill the Alchemical Hydra in less than 1 minute 20 seconds.", "Alchemical Hydra"), vorkath)), 133);
  assert.equal(limit(sharedJudge(task("Kill the Leviathan in less than 1:50 without a slayer task.", "Leviathan"), vorkath)), 183);
  assert.equal(limit(sharedJudge(task("Kill Phosani's Nightmare within 6 minutes.", "Phosani's Nightmare"), vorkath)), 600);
  assert.equal(sharedJudge(task("Kill Vorkath 50 times."), vorkath).target({ kills: 7 }).of, 50);
  assert.equal(sharedJudge(task("Kill the Maggot King.", "Maggot King"), vorkath).target({ kills: 0 }).of, 1);
  assert.equal(sharedJudge(task("Kill Vorkath 10 times without leaving his area."), vorkath).check({}, { kills: 99, streak: 9 }), false);
  const awakened = sharedJudge(task("Kill Awakened Duke Sucellus.", "Duke Sucellus"), { monster: "Duke Sucellus", awakened: "duke_sucellus_awakened" });
  assert.equal(awakened.check({ variant: "duke_sucellus_awakened" }), true);
  assert.equal(awakened.check({ variant: "duke_sucellus" }), false);
  // Worded otherwise: left to the boss's own judges.
  for (const description of ["Kill Vorkath with only your fists.", "Kill Araxxor 4 times in 10:00.", "Kill Vorkath's zombified spawn without using crumble undead."])
    assert.equal(sharedJudge(task(description), vorkath), null, description);
  // The data: a name once a monster, every tier one with points.
  const seen = new Set();
  for (const { monster, name, tier } of combatAchievementTasks) {
    assert.ok(!seen.has(monster + ":" + name), name);
    seen.add(monster + ":" + name);
    assert.ok(tierPoints[tier], tier);
  }
}

{
  // The whole fight: a kill, but with infinite health, so it does not count and completes nothing.
  const { run, store, completed, failed, aids } = await track("kill");
  assert.equal(run.ended, "kill");
  assert.deepEqual([...run.assisted], ["infinite health"]);
  assert.deepEqual(completed, []);
  assert.deepEqual(store.getState().kills, {});
  // Counted all the same among the boss's fights: one kill, no death.
  assert.deepEqual(store.fightsOf("alchemical_hydra"), { kills: 1, deaths: 0 });
  // What it kept of the fight: its time, the damage the player took, the hits its encounter named and the weapon.
  assert.ok(killTicks(run) > 0 && killTicks(run) === run.killTick - run.startTick);
  // Its script prays every attack and steps off every mechanic: 54 hits on the player, all blocked.
  assert.equal(run.damageTaken, 0);
  assert.equal(run.hits["Alchemical Hydra"].count, 54);
  assert.equal(run.hits["Alchemical Hydra"].damage, 0);
  assert.ok(run.weapons.has(20997)); // the twisted bow of its setup
  assert.ok(run.facts.flameWall, "the whole fight sees its flame special");
  // Judged as a clean kill, the same fight completes what it did without: each task's answer from what it kept.
  const clean = { ...run, assisted: new Set() };
  const done = judgeKill(clean, getCombatAchievements("alchemical_hydra"), { kills: 1, streak: 1 }, new Set()).map((task) => task.id);
  const expect = (id, answer) => assert.equal(done.includes(id), answer, id);
  expect("alcleanical_hydra", true);
  expect("the_flame_skipper", false);
  expect("lightning_lure", (run.hits.Lightning?.count ?? 0) === 0);
  expect("dont_flame_me", (run.hits.Fire?.count ?? 0) === 0);
  expect("unrequired_antipoisons", (run.hits["Poison pool"]?.count ?? 0) === 0);
  expect("mixing_correctly", !run.facts.empowered);
  expect("alchemical_speed_chaser", killTicks(run) <= 174);
  expect("no_pressure", false);
  expect("alchemical_veteran", false);
  expect("working_overtime", false);
  // As it ran: told once that it would not count, on its first tick (the harness shows tick 0); each task told failed once, the tick it could no
  // longer be met. The flame special on the tick its breath starts; the speed tasks on the first tick past their time.
  assert.deepEqual(aids, [[["infinite health"], 0]]);
  const failedAt = Object.fromEntries(failed.map(([id, tick]) => [id, tick]));
  const reasonOf = Object.fromEntries(failed.map(([id, , reason]) => [id, reason]));
  assert.ok(failed.every(([, , , repeat]) => repeat === false), "none completed before");
  assert.equal(reasonOf.the_flame_skipper, "The Alchemical Hydra spawned a flame wall attack.");
  assert.equal(reasonOf.no_pressure, "You used a weapon other than Dharok's greataxe.");
  assert.equal(reasonOf.alchemical_speed_runner, "You did not kill the Alchemical Hydra in time.");
  assert.equal(failed.length, Object.keys(failedAt).length);
  assert.equal(failedAt.alchemical_speed_runner, 134);
  assert.equal(failedAt.alchemical_speed_chaser, 175);
  assert.ok(failedAt.the_flame_skipper > 0);
  assert.equal(failedAt.no_pressure, 0, "the twisted bow and 99 hitpoints from the first tick");
  for (const id of ["alcleanical_hydra", "lightning_lure", "dont_flame_me", "unrequired_antipoisons", "alchemical_veteran", "alchemical_master", "working_overtime"]) {
    assert.equal(failedAt[id], undefined, id);
  }
  assert.equal(failedAt.mixing_correctly === undefined, !run.facts.empowered);
  // The victory screen's summary (runSummary). The kill did not count: said once, from the tick the aid was first
  // seen. The tasks chosen to go for, in the boss's order: one failed in the fight, with its reason and tick; the
  // others failed as the kill did not count.
  const hydra = getCombatAchievements("alchemical_hydra");
  const rowsOf = (summary) => summary.rows.map(({ task, status, reason, tick }) => [task.id, status, reason, tick]);
  const chosen = ["the_flame_skipper", "alcleanical_hydra", "alchemical_veteran"];
  const assisted = runSummary(run, hydra, chosen);
  assert.deepEqual(assisted.notCounted, { reasons: ["infinite health"], tick: 0 });
  assert.equal(assisted.chosen, true);
  assert.deepEqual(rowsOf(assisted), [
    ["alchemical_veteran", "failed", "The kill did not count.", 0],
    ["the_flame_skipper", "failed", "The Alchemical Hydra spawned a flame wall attack.", failedAt.the_flame_skipper],
    ["alcleanical_hydra", "failed", "The kill did not count.", 0],
  ]);
  // None chosen: every task the fight failed on its own, and none it did not.
  const all = runSummary(run, hydra, []);
  assert.equal(all.chosen, false);
  assert.deepEqual(all.rows.map((row) => row.status), failed.map(() => "failed"));
  assert.deepEqual(all.rows.map((row) => row.task.id).sort(), failed.map(([id]) => id).sort());
  // The same fight as a clean kill: completed on the kill's tick, or a kill count still short; with none chosen,
  // what it completed and what failed.
  const cleanRun = { ...run, assisted: new Set(), aids: {} };
  const cleanSummary = runSummary(cleanRun, hydra, chosen, { kills: 1, streak: 1 });
  assert.equal(cleanSummary.notCounted, null);
  assert.deepEqual(rowsOf(cleanSummary), [
    ["alchemical_veteran", "not completed", "1/75 so far.", undefined],
    ["the_flame_skipper", "failed", "The Alchemical Hydra spawned a flame wall attack.", failedAt.the_flame_skipper],
    ["alcleanical_hydra", "completed", undefined, run.killTick],
  ]);
  const cleanAll = runSummary(cleanRun, hydra, [], { kills: 1, streak: 1 });
  assert.ok(cleanAll.rows.some((row) => row.task.id === "alcleanical_hydra" && row.status === "completed"));
  assert.ok(!cleanAll.rows.some((row) => row.task.id === "alchemical_veteran"), "a kill count not reached is neither");
}

{
  // The vents scenario draws it over the green vent first: empowered, so Mixing Correctly would fail.
  const { run } = await track("vents");
  assert.equal(run.facts.empowered, true);
  assert.equal(run.ended, null);
}

{
  // The store: kills and tasks kept in storage, read back by a new store; a boss's own reset.
  const storage = memoryStorage();
  const store = createCombatAchievementsStore(storage);
  assert.equal(store.recordKill("alchemical_hydra"), 1);
  assert.equal(store.recordKill("alchemical_hydra"), 2);
  store.complete(["alchemical_hydra:lightning_lure"]);
  const again = createCombatAchievementsStore(storage);
  assert.equal(again.getState().kills.alchemical_hydra, 2);
  assert.ok(again.completedKeys().has("alchemical_hydra:lightning_lure"));
  // The tasks chosen to go for: kept, read back, and kept through a boss's reset.
  again.setSelected("alchemical_hydra", ["lightning_lure", "dont_flame_me", "lightning_lure"]);
  assert.deepEqual(createCombatAchievementsStore(storage).selectedFor("alchemical_hydra"), ["lightning_lure", "dont_flame_me"]);
  assert.deepEqual(again.selectedFor("vorkath"), []);
  again.reset("alchemical_hydra");
  assert.deepEqual(again.getState(), { completed: {}, kills: {}, fights: {}, selected: { alchemical_hydra: ["lightning_lure", "dont_flame_me"] }, settings: { failureMessages: true, repeatFailureMessages: false, showRecord: true } });
  // Every fight that ended: kills and deaths, kept, and forgotten with the boss.
  again.recordFight("alchemical_hydra", "kill");
  again.recordFight("alchemical_hydra", "death");
  again.recordFight("alchemical_hydra", "death");
  assert.deepEqual(createCombatAchievementsStore(storage).fightsOf("alchemical_hydra"), { kills: 1, deaths: 2 });
  assert.deepEqual(again.fightsOf("vorkath"), { kills: 0, deaths: 0 });
  again.reset("alchemical_hydra");
  assert.deepEqual(again.fightsOf("alchemical_hydra"), { kills: 0, deaths: 0 });
  // Storage that refuses: the progress stays for the visit.
  const refusing = createCombatAchievementsStore({ getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } });
  assert.equal(refusing.recordKill("alchemical_hydra"), 1);
  // The setting: a failure in the chat, on unless turned off; kept, and kept through a reset.
  assert.equal(again.getState().settings.failureMessages, true);
  again.setSetting("failureMessages", false);
  again.reset();
  assert.equal(createCombatAchievementsStore(storage).getState().settings.failureMessages, false);
}

{
  // The chat: a line of the combat achievements after the fight's own lines of its tick.
  const line = (key, tick) => ({ key, tick });
  const merged = mergeChatMessages([line("a", 1), line("b", 5), line("c", 6)], [line("x", 5), line("y", 9)]);
  assert.deepEqual(merged.map((m) => m.key), ["a", "b", "x", "c", "y"]);
  const recorded = [line("a", 1)];
  assert.equal(mergeChatMessages(recorded, []), recorded);
  // The lines as the game words them (OBS, rsprox): the task's name in <col=0cc919>, the rest in the chat's colour;
  // tasks failed together for one reason named in one line.
  const text = (message) => message.segments.map(({ text, color }) => (color ? `<col=${color.slice(1)}>${text}</col>` : text)).join("");
  clearChat();
  const task = (name, tier) => ({ name, tier });
  tellCompleted(task("Lightning Lure", "master"), 7);
  tellCompleted(task("Alchemical Veteran", "elite"), 7);
  tellFailed([{ task: task("Lightning Lure"), reason: "You were hit by the lightning attack." }, { task: task("Alcleanical Hydra"), reason: "You took damage." }, { task: task("Speedy"), reason: "You took damage." }], 9);
  assert.deepEqual(getChatMessages().map(text), [
    "Congratulations, you've completed a master combat task: <col=0cc919>Lightning Lure</col> (5 points).",
    "Congratulations, you've completed an elite combat task: <col=0cc919>Alchemical Veteran</col> (4 points).",
    "You have failed <col=0cc919>Lightning Lure</col>: You were hit by the lightning attack.",
    "You have failed <col=0cc919>Alcleanical Hydra</col> / <col=0cc919>Speedy</col>: You took damage.",
  ]);
  clearChat();
}

{
  // A tracker on an engine: a clean kill counts and completes; a second kill of the same boss adds to the streak.
  // A fake engine, the least the tracker reads, its tick and outcome set by hand.
  let now = { tick: 1, phase: "active" };
  const engine = {
    getEncounterKind: () => "alchemical_hydra",
    getState: () => ({ currentTick: now.tick }),
    mechanicsConfig: {},
    damageHistory: [],
    player: () => ({ alive: true, equipment: { weapon: 4718 }, vitals: { hp: 10 } }),
    getEncounterSnapshot: () => ({ state: {} }),
    getEncounterOutcome: () => ({ phase: now.phase }),
    executeEncounterCommand: () => true,
  };
  const store = createCombatAchievementsStore(memoryStorage());
  const completed = [];
  const tracker = createCombatAchievementsTracker({ store, onComplete: (kind, tasks) => completed.push(...tasks.map((task) => task.id)) });
  tracker.observe(engine, []);
  now = { tick: 2, phase: "resolving" };
  tracker.observe(engine, []);
  assert.equal(store.getState().kills.alchemical_hydra, 1);
  // Two ticks, no damage, no mechanic, only Dharok's greataxe at 10 hitpoints: everything but the kill counts and the streak.
  assert.deepEqual(completed.sort(), [
    "alchemical_speed_chaser", "alchemical_speed_runner", "alcleanical_hydra", "dont_flame_me", "lightning_lure",
    "mixing_correctly", "no_pressure", "the_flame_skipper", "unrequired_antipoisons",
  ]);
  // A restart (the tick goes back) is a new run; an encounter command marks it, and its kill does not count.
  now = { tick: 1, phase: "active" };
  tracker.observe(engine, []);
  engine.executeEncounterCommand("anything");
  now = { tick: 2, phase: "resolving" };
  tracker.observe(engine, []);
  assert.deepEqual([...tracker.currentRun().assisted], ["an encounter command"]);
  assert.equal(store.getState().kills.alchemical_hydra, 1);
  assert.equal(tracker.streak(), 1);
}

{
  // Vorkath's own judges, on her scripted fights (tools/determinism/scenarios/vorkath.mjs).
  const { scenarios: vorkath } = await import("../tools/determinism/scenarios/vorkath.mjs");
  const { attack } = await import("../tools/determinism/scenarios/common.mjs");
  const fight = (name) => vorkath.find((s) => s.name === "vorkath/" + name);
  const { tasks } = getCombatAchievements("vorkath");
  assert.ok(tasks.every((task) => task.tracked), "all eleven judged");

  // The crossbow kill: Crumble Undead on each spawn, the acid walked without attacking, Protect from Missiles on
  // (its drain takes prayer points).
  const kill = await trackScenario(fight("crossbow-kill"));
  const reasons = Object.fromEntries(kill.failed.map(([id, , reason]) => [id, reason]));
  assert.equal(kill.run.ended, "kill");
  assert.equal(reasons.stick_em_with_the_pointy_end, "You attacked with a weapon other than a melee one.");
  assert.equal(reasons.the_fremennik_way, "You attacked with something other than your fists.");
  assert.equal(reasons.faithless_encounter, "You lost prayer points.");
  assert.equal(kill.run.facts.zombieDestroyed, undefined, "Crumble Undead: not Zombie Destroyer");
  assert.equal(kill.run.facts.walked, undefined, "no attack in the acid: not The Walk");
  assert.ok(kill.run.attacks > 0 && kill.run.spells.has("Crumble Undead"));

  // The spawn left to explode: Dodging the Dragon fails, whatever the explosion dealt.
  const exploded = await trackScenario(fight("spawn-explodes"));
  assert.ok(exploded.failed.some(([id, , reason]) => id === "dodging_the_dragon" && reason === "You were hit by a special attack."));

  // The spawn and the acid, tick by tick (a crossbow lands one or two hits on a spawn before it explodes, so these
  // are made-up ticks): what Vorkath's judges keep of them.
  const { vorkathCombatAchievements } = await import("../client/encounters/vorkath/combatAchievements.js");
  const { newRun } = await import("../client/combatAchievements/runs.js");
  const play = (ticks) => {
    const run = newRun("vorkath", 0);
    for (const [state, events = [], hits = {}] of ticks) {
      for (const [source, count] of Object.entries(hits)) run.hits[source] = { count, damage: 0 };
      vorkathCombatAchievements.observe(state, run.facts, { events, run });
    }
    return run.facts;
  };
  const hit = (damage) => ({ type: "hit_applied", targetId: "vorkath-spawn", damage });
  const cast = (spellId) => ({ type: "attack_started", sourceId: "player", targetId: "vorkath-spawn", spellId });
  const spawn = { spawnAlive: true };
  // 38 dealt by hits: destroyed; with Crumble Undead cast at it: not; 37: not.
  assert.equal(play([[spawn, [hit(20)]], [spawn, [hit(18)]], [{}]]).zombieDestroyed, true);
  assert.equal(play([[spawn, [cast("Crumble Undead")]], [spawn, [hit(38)]], [{}]]).zombieDestroyed, undefined);
  assert.equal(play([[spawn, [hit(37)]], [{}]]).zombieDestroyed, undefined);
  // The Walk: 12 attacks on her in one acid special, none hit by it; one hit, or 11 attacks, does not.
  const swing = { type: "attack_started", sourceId: "player", targetId: "vorkath" };
  const acid = { phase: "acid" };
  const walk = (attacks, hits) => play([...Array.from({ length: attacks }, (_, n) => [acid, [swing], n === 5 ? hits : {}]), [{ phase: "active" }]]).walked;
  assert.equal(walk(12, {}), true);
  assert.equal(walk(12, { "Rapid fire": 1 }), undefined);
  assert.equal(walk(11, {}), undefined);

  // Dodging the Dragon: kills in a row without a special's hit, counted by the tracker; a hit starts it again.
  const fakeFight = (specialHit) => {
    let tick = 0;
    const history = [];
    return {
      getEncounterKind: () => "vorkath",
      getState: () => ({ currentTick: tick }),
      player: () => ({ alive: true, equipment: {}, vitals: { hp: 99 } }),
      getEncounterOutcome: () => ({ phase: tick >= 3 ? "victory" : "active" }),
      getEncounterSnapshot: () => ({ state: {} }),
      get damageHistory() {
        return history;
      },
      step() {
        tick++;
        if (specialHit && tick === 2) history.push({ targetId: "player", source: "Zombified spawn", effectiveDamage: 0 });
      },
    };
  };
  const store = createCombatAchievementsStore(memoryStorage());
  const tracker = createCombatAchievementsTracker({ store });
  const fightOnce = (specialHit) => {
    const engine = fakeFight(specialHit);
    for (let n = 0; n < 4; n++) {
      engine.step();
      tracker.observe(engine, []);
    }
  };
  fightOnce(false);
  fightOnce(false);
  assert.equal(tracker.taskStreaks().dodging_the_dragon, 2);
  fightOnce(true);
  assert.equal(tracker.taskStreaks().dodging_the_dragon, 0);
  for (let n = 0; n < 5; n++) fightOnce(false);
  assert.ok(store.completedKeys().has("vorkath:dodging_the_dragon"), "five in a row");
}

{
  // The other bosses' own judges, on made-up fights: what each counts as avoidable, and what it forgives.
  const { newRun } = await import("../client/combatAchievements/runs.js");
  const task = (kind, name) => getCombatAchievements(kind).tasks.find((t) => t.name === name);
  const hit = (count, extra = {}) => ({ count, damage: 0, damaged: 0, unprayed: 0, unprayedDamaged: 0, ...extra });
  const fight = (hits = {}, more = {}) => Object.assign(newRun("x", 0), { ended: "kill", killTick: 50, lastTick: 50, hits }, more);
  const fails = (kind, name, run) => Boolean(task(kind, name).failed(run));

  // Duke: the icicles' chip is forgiven; his magic fails it even for a 0 on the prayer.
  assert.equal(fails("duke_sucellus", "Cold Feet", fight({ "Duke Sucellus' icicles": hit(3, { damaged: 3 }) })), false);
  assert.equal(fails("duke_sucellus", "Cold Feet", fight({ "Duke Sucellus": hit(1) })), true);
  assert.equal(fails("duke_sucellus", "Cold Feet", fight({}, { ran: true })), true);
  const duke = getCombatAchievements("duke_sucellus").judges ?? null;
  assert.equal(duke, null, "the judges are folded into the tasks");
  const { dukeSucellusCombatAchievements } = await import("../client/encounters/duke-sucellus/combatAchievements.js");
  const offBeat = (his) => {
    const facts = {};
    dukeSucellusCombatAchievements.observe({}, facts, { events: [{ type: "attack_started", sourceId: "player", targetId: "duke-sucellus" }, ...(his ? [{ type: "zuk_attack", sourceId: "duke-sucellus" }] : [])] });
    return facts.offBeat;
  };
  assert.equal(offBeat(true), undefined, "on his tick");
  assert.equal(offBeat(false), true, "off his tick");

  // The Leviathan: its roar is forgiven; two stuns fail Serpentine Solo; mithril only, and 25 hitpoints at most.
  assert.equal(fails("leviathan", "Perfect Leviathan", fight({ "The Leviathan's roar": hit(2, { damaged: 2 }) })), false);
  assert.equal(fails("leviathan", "Perfect Leviathan", fight({ "The Leviathan": hit(1, { damaged: 1 }) })), true);
  const { leviathanCombatAchievements } = await import("../client/encounters/leviathan/combatAchievements.js");
  const leviathanFacts = (states, ammoId) => {
    const facts = {};
    for (const state of states) leviathanCombatAchievements.observe(state, facts, { events: [{ type: "attack_started", sourceId: "player", targetId: "leviathan", ammoId }] });
    return facts;
  };
  assert.equal(leviathanFacts([{ stunnedUntil: null }, { stunnedUntil: 30 }, { stunnedUntil: 30 }, { stunnedUntil: null }]).stuns, 1);
  assert.equal(leviathanFacts([{ stunnedUntil: 30 }, { stunnedUntil: null }, { stunnedUntil: 90 }]).stuns, 2);
  assert.equal(leviathanFacts([{}], 888).notMithril, undefined, "mithril arrows (888)");
  assert.equal(leviathanFacts([{}], 892).notMithril, true, "rune arrows (892)");
  assert.equal(task("leviathan", "Unconventional").check(fight({}, { attacks: 3, highestHp: 25 })), true);
  assert.equal(task("leviathan", "Unconventional").check(fight({}, { attacks: 3, highestHp: 26 })), false);

  // Vardorvis: his melee on the prayer, even for damage, is forgiven; off it, or a special's damage, is not.
  assert.equal(fails("vardorvis", "Perfect Vardorvis", fight({ Vardorvis: hit(4, { damaged: 2 }) })), false);
  assert.equal(fails("vardorvis", "Perfect Vardorvis", fight({ Vardorvis: hit(1, { damaged: 1, unprayed: 1, unprayedDamaged: 1 }) })), true);
  assert.equal(fails("vardorvis", "Perfect Vardorvis", fight({ "Vardorvis' axe": hit(1, { damaged: 1 }) })), true);

  // Araxxor: his 0 off the prayer is forgiven, an araxyte's is not; a pool's hit is not.
  assert.equal(fails("araxxor", "Perfect Araxxor", fight({ Araxxor: hit(1, { unprayed: 1 }) })), false);
  assert.equal(fails("araxxor", "Perfect Araxxor", fight({ "Acidic Araxyte": hit(1, { unprayed: 1 }) })), true);
  assert.equal(fails("araxxor", "Perfect Araxxor", fight({ "Acid pool": hit(1) })), true);
  assert.equal(fails("araxxor", "Perfect Araxxor 2", fight({}, { facts: { hitEnraged: true } })), true);

  // The others.
  assert.equal(fails("phosanis_nightmare", "Dreamland Express", fight({ Sleepwalker: hit(1) })), true);
  assert.equal(fails("maggot_king", "Digging in", fight({}, { tilesMoved: 40 })), false);
  assert.equal(fails("maggot_king", "Digging in", fight({}, { tilesMoved: 41 })), true);
  assert.equal(task("doom_of_mokhaiotl", "Doom Adept").check(fight({}, { facts: { delve: 3 } })), true);
  assert.equal(task("doom_of_mokhaiotl", "Doom Veteran").check(fight({}, { facts: { delve: 7 } })), false);
  assert.equal(task("doom_of_mokhaiotl", "Doom Crawler").check(fight({}, { facts: { delve: 1 }, killTick: 49 })), true);
  assert.equal(task("doom_of_mokhaiotl", "Doom Crawler").check(fight({}, { facts: { delve: 1 }, killTick: 50 })), false, "50 ticks are 30 seconds");
  assert.equal(task("doom_of_mokhaiotl", "Mokhaiotl Drift").check(fight({}, { facts: { delve: 8, burrowEnded: true } })), false);
  assert.equal(fails("corrupted_hunllef", "3, 2, 1 - Mage", fight({ "Corrupted Hunllef's tornado": hit(1, { damaged: 1 }) })), false);
  assert.equal(fails("corrupted_hunllef", "3, 2, 1 - Mage", fight({ "Corrupted Hunllef": hit(1, { damaged: 1, unprayed: 1, unprayedDamaged: 1 }) })), true);
  assert.equal(task("corrupted_hunllef", "Corrupted Gauntlet Veteran").target({ kills: 2 }).of, 5);

  // Five perfect kills in one visit: a kill that is not perfect does not start the count again.
  const perfect = task("vardorvis", "Perfect Vardorvis");
  assert.equal(perfect.keepOnMiss, true);
}
