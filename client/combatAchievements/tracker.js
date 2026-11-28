// Combat achievements: what a fight did, tick by tick, and which of its boss's
// tasks (WIKI: Combat Achievements) a kill completes.
//
// A boss's tasks are the wiki's (tasks.js, written by
// tools/fetch-combat-achievements.mjs), for the encounters bosses.js names. Each
// is judged by its boss's own judge, or else by a shared one when its
// description is worded as many bosses' are (judges.js); a task with neither is
// listed as not tracked. A boss's own judges are in its descriptor
// (encounters/registry.js):
//
//   combatAchievements: {
//     observe(state, facts)   optional: called each tick with the encounter's
//                             snapshot state (getEncounterSnapshot().state);
//                             writes what its tasks need into `facts`
//     judges: { "<task name>": { check(run, progress), failed?(run), target?(progress) } },
//   }
//
// `check` answers on a kill that counts: `run` is what this module kept of the
// fight (below), `progress` the player's kills of the boss, this one included
// ({ kills, streak }). A task whose `target(progress)` is given also shows how
// far along it is ({ current, of }). The player's progress is kept under the
// boss's first kind (bosses.js), `run.kind`; `run.variant` is the kind fought.
//
// Only a clean kill counts, as one with a plugin or a cheat would not in the
// game: none with infinite health or infinite special attack, none where an
// encounter command was run or the boss's hitpoints were set, none taken over
// part-way. Each reason is kept in `run.assisted`. The other mechanics toggles
// are the account's unlocks (upgraded prayers, the prepot) and are allowed.
//
// The tracker reads the engine after each tick: its tick events, its
// `damageHistory` (each hit on the player, with the `source` its encounter
// gave it: "Lightning", "Fire", ...), the player and the outcome. It changes
// nothing in the engine but the three methods it wraps to see an aid used,
// so a fight runs and digests the same with it as without.
import { encounterRegistry } from "../encounters/registry.js";
import { combatAchievementTasks } from "./tasks.js";
import { bossOfKind } from "./bosses.js";
import { sharedJudge } from "./judges.js";
import { newRun, observeTick, judgeKill, taskKey, newlyFailed, newlyAssisted, noteAid as noteRunAid, tierOrder } from "./runs.js";

export * from "./runs.js";

/** A task's id here: its name, in lower case with underscores ("Don't Flame Me": "dont_flame_me"). */
export const taskId = (name) => name.toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

const built = new Map();
/**
 * The combat achievements of a kind: { kind, monster, observe?, tasks }, or null. `kind` is the one the progress
 * is kept under (bosses.js). Each task is { id, gameId, name, monster, description, tier, type, tracked } with its
 * judge's check, failed and target; one not tracked has no check.
 */
export function getCombatAchievements(kind) {
  const boss = kind ? bossOfKind(kind) : null;
  if (!boss) return null;
  if (built.has(boss)) return built.get(boss);
  const own = encounterRegistry.getDescriptorOfKindOrVariant(boss.kinds[0])?.combatAchievements ?? {};
  const judges = own.judges ?? {};
  const tasks = combatAchievementTasks
    .filter((task) => task.monster === boss.monster)
    .map((task) => {
      const judge = judges[task.name] ?? (boss.shared === false ? null : sharedJudge(task, boss));
      const id = taskId(task.name);
      // A task of kills in a row each meeting something (judges.js, inARowUnless): the tracker's count of them.
      const streak = judge?.each && {
        check: (run, progress) => (progress.taskStreaks?.[id] ?? 0) >= judge.times,
        target: (progress) => ({ current: Math.min(progress.taskStreaks?.[id] ?? 0, judge.times), of: judge.times }),
      };
      return { ...task, id, ...judge, ...streak, tracked: Boolean(judge?.check || streak) };
    })
    // By tier, as the wiki's lists of a boss's tasks are, and the game's order within one.
    .sort((a, b) => tierOrder.indexOf(a.tier) - tierOrder.indexOf(b.tier) || a.gameId - b.gameId);
  const achievements = { kind: boss.kinds[0], monster: boss.monster, observe: own.observe, tasks };
  built.set(boss, achievements);
  return achievements;
}

/**
 * A tracker for the application: `observe(engine, events)` after each tick
 * starts a run when a fight starts (its tick goes back, or the kind or the
 * engine changes) and, on a clean kill, counts it and hands the tasks it
 * completed to `onComplete(kind, tasks, tick)`. As the fight runs it hands
 * the tasks that can no longer be met to `onFail(kind, failures, tick)`
 * (runs.js, newlyFailed: { task, reason, repeat }) and the
 * aids that stop the kill counting to `onAssisted(reasons, tick)`, each
 * once a fight; `onRunStart(run)` as a fight starts. `store` keeps the
 * progress (store.js). `noteAid(reason)` marks the current run as assisted.
 */
export function createCombatAchievementsTracker({
  store,
  onComplete = () => {},
  onFail = () => {},
  onAssisted = () => {},
  onRunStart = () => {},
  onRunChange = () => {},
}) {
  let run = null;
  let engineSeen = null;
  let streak = { kind: null, count: 0, tasks: {} }; // clean kills in a row of one boss, without leaving it; and of each task's (inARowUnless)
  const wrapped = new WeakSet();

  function tellAids() {
    const reasons = newlyAssisted(run);
    if (reasons.length) onAssisted(reasons, run.lastTick);
  }

  const noteAid = (reason) => {
    if (run && !run.ended) {
      noteRunAid(run, reason);
      if (getCombatAchievements(run.kind)) tellAids();
      onRunChange(run);
    }
  };

  // The engine's own aids: a command, the boss's hitpoints set.
  function watch(engine) {
    if (wrapped.has(engine)) return;
    wrapped.add(engine);
    for (const [method, reason] of [["executeEncounterCommand", "an encounter command"], ["setBossHp", "boss hitpoints set"], ["applyBossHpPreset", "boss hitpoints set"]]) {
      const original = engine[method];
      if (typeof original !== "function") continue;
      engine[method] = function (...args) {
        noteAid(reason);
        return original.apply(this, args);
      };
    }
  }

  function observe(engine, events = []) {
    if (!engine) return;
    const variant = engine.getEncounterKind?.();
    const achievements = getCombatAchievements(variant);
    // The progress is kept under the boss's first kind (bosses.js); the fights are counted by the kind fought.
    const kind = achievements?.kind ?? variant;
    const tick = engine.getState().currentTick;
    watch(engine);
    if (!run || engine !== engineSeen || variant !== run.variant || tick <= run.lastTick) {
      if (variant !== streak.kind) streak = { kind: variant, count: 0, tasks: {} };
      engineSeen = engine;
      run = newRun(kind, Math.max(0, tick - 1)); // the tick before the first seen: the fight's start
      run.variant = variant;
      // A fight taken over part-way (a replay's Take over) does not count.
      if (tick > 1) noteRunAid(run, "started part-way");
      onRunStart(run);
    }
    const before = run.ended;
    observeTick(run, engine, events, achievements);
    // Every fight that ends, of any boss, counted or not: a kill or a death, once a fight.
    if (!before && run.ended) store.recordFight(variant, run.ended);
    if (!achievements) return;
    if (before) {
      onRunChange(run);
      return;
    }
    tellAids();
    const failures = newlyFailed(run, achievements, store.completedKeys());
    if (failures.length) onFail(kind, failures, tick);
    if (!run.ended || run.ended === "death" || run.assisted.size > 0) {
      if (run.ended === "death") streak = { ...streak, count: 0, tasks: {} };
      onRunChange(run);
      return;
    }
    streak.count++;
    for (const task of achievements.tasks) {
      if (!task.each) continue;
      const count = streak.tasks[task.id] ?? 0;
      streak.tasks[task.id] = task.each(run) ? count + 1 : task.keepOnMiss ? count : 0;
    }
    const kills = store.recordKill(kind);
    run.progress = { kills, streak: streak.count, taskStreaks: { ...streak.tasks } };
    const done = judgeKill(run, achievements, run.progress, store.completedKeys());
    if (done.length) {
      store.complete(done.map((task) => taskKey(kind, task)));
      onComplete(kind, done, tick);
    }
    onRunChange(run);
  }

  return { observe, noteAid, currentRun: () => run, streak: () => streak.count, taskStreaks: () => ({ ...streak.tasks }) };
}
