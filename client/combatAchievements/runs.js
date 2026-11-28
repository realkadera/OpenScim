// Combat achievements: the record of a fight and the judging of a kill
// (tracker.js says how they are used). This module imports nothing, so a
// boss's task list (client/encounters/<boss>/combatAchievements.js) can use
// its helpers without an import cycle through the encounter registry.
// WIKI: Combat Achievements, the points of a task of each tier.
export const tierPoints = { easy: 1, medium: 2, hard: 3, elite: 4, master: 5, grandmaster: 6 };
export const tierOrder = ["easy", "medium", "hard", "elite", "master", "grandmaster"];
export const tickSeconds = 0.6; // WIKI: Game tick

// A speed task's limit: "less than" `seconds`, as the most ticks that are under it.
export const ticksUnder = (seconds) => Math.ceil(seconds / tickSeconds) - 1;
export const formatTicks = (ticks) => {
  const seconds = ticks * tickSeconds;
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}.${Math.round((seconds - whole) * 10) % 10}`;
};

/** A task's key in the player's progress: its kind and its id. */
export const taskKey = (kind, task) => `${kind}:${task.id}`;

/** A fight's record as it starts. */
export function newRun(kind, startTick) {
  return {
    kind,
    variant: kind, // the encounter kind fought: `kind`, or a variant kept under it (bosses.js)
    startTick,
    lastTick: startTick,
    assisted: new Set(),
    damageTaken: 0,
    hits: {}, // source: { count, damage, damaged, unprayed, unprayedDamaged }, the hits on the player its encounter
    // named: how many, their damage, how many dealt some, how many were of a style the player did not pray against,
    // and how many of those dealt some
    weapons: new Set(),
    highestHp: 0,
    // The player's attacks (each "attack_started" of the player's): how many, their styles ("melee", "range",
    // "magic"), the weapons they were made with ("none" for fists) and the spells cast.
    attacks: 0,
    attackStyles: new Set(),
    attackWeapons: new Set(),
    attackAmmo: new Set(), // the ammunition of the attacks that used some
    spells: new Set(),
    ran: false, // the player ran at some tick
    tilesMoved: 0, // the tiles the player moved, a tick's step as its longer side
    position: null,
    prayerLost: false, // the player's prayer points went down at some tick
    prayerPoints: null,
    killTick: null, // the tick the boss died
    deathTick: null, // the tick the player died
    ended: null, // "kill" | "death"
    failures: {}, // task id: { reason, tick }, each task as it could no longer be met
    aids: {}, // reason: the tick an aid was first seen, that stops the kill counting
    progress: null, // { kills, streak } as a clean kill was judged
    facts: {},
    historyIndex: 0,
    reported: new Set(), // the tasks already told failed, and the aids already told
  };
}

/** The ticks a kill took: from the fight's start to the boss's death. */
export const killTicks = (run) => (run.killTick === null ? null : run.killTick - run.startTick);

/** The ticks the fight has run: to the kill, or to now. */
export const elapsedTicks = (run) => (run.killTick ?? run.lastTick) - run.startTick;

/** How many hits on the player the encounter named `source`. */
export const hitsFrom = (run, source) => run.hits[source]?.count ?? 0;

/** The hits on the player from any source but `except` (a list), counted by `what` (a field of run.hits). */
export const hitsExcept = (run, except = [], what = "count") =>
  Object.entries(run.hits).reduce((sum, [source, seen]) => sum + (except.includes(source) ? 0 : seen[what]), 0);

// The mechanics toggles that make a kill not count.
const aidToggles = { infiniteHealth: "infinite health", infiniteSpecialAttack: "infinite special attack" };

/** Reads one tick of the engine into `run`. */
export function observeTick(run, engine, events, achievements) {
  const state = engine.getState();
  run.lastTick = state.currentTick;
  if (run.ended) return; // what comes after the kill or the death is not the fight
  const mechanics = engine.mechanicsConfig ?? {};
  for (const [key, reason] of Object.entries(aidToggles)) if (mechanics[key]) noteAid(run, reason);

  for (const event of events) {
    if (event.type === "hit_applied" && event.targetId === "player" && event.damage > 0) run.damageTaken += event.damage;
    if (event.type === "attack_started" && event.sourceId === "player") {
      run.attacks++;
      if (event.style) run.attackStyles.add(event.style);
      run.attackWeapons.add(event.weaponId ?? "none");
      if (event.ammoId) run.attackAmmo.add(event.ammoId);
      if (event.spellId) run.spells.add(event.spellId);
    }
  }
  const history = engine.damageHistory ?? [];
  if (run.historyIndex > history.length) run.historyIndex = 0;
  for (; run.historyIndex < history.length; run.historyIndex++) {
    const hit = history[run.historyIndex];
    if (hit.targetId !== "player" || !hit.source) continue;
    const seen = (run.hits[hit.source] ??= { count: 0, damage: 0, damaged: 0, unprayed: 0, unprayedDamaged: 0 });
    seen.count++;
    seen.damage += hit.effectiveDamage ?? 0;
    if ((hit.effectiveDamage ?? 0) > 0) seen.damaged++;
    if (hit.prayedCorrectly === false) seen.unprayed++;
    if (hit.prayedCorrectly === false && (hit.effectiveDamage ?? 0) > 0) seen.unprayedDamaged++;
  }

  const player = engine.player();
  if (player?.equipment?.weapon) run.weapons.add(player.equipment.weapon);
  run.highestHp = Math.max(run.highestHp, player?.vitals?.hp ?? 0);
  if (player?.isRunning) run.ran = true;
  if (player?.position) {
    if (run.position) run.tilesMoved += Math.max(Math.abs(player.position[0] - run.position[0]), Math.abs(player.position[1] - run.position[1]));
    run.position = [...player.position];
  }
  const points = player?.prayerState?.points;
  if (points !== undefined) {
    if (run.prayerPoints !== null && points < run.prayerPoints) run.prayerLost = true;
    run.prayerPoints = points;
  }

  // A boss's own record of the fight: its snapshot's state, this tick's events, and the run so far.
  if (achievements?.observe) achievements.observe(engine.getEncounterSnapshot?.().state ?? {}, run.facts, { events, run, engine });

  const phase = engine.getEncounterOutcome?.().phase;
  if (phase === "resolving" || phase === "victory") {
    run.killTick = state.currentTick;
    run.ended = "kill";
  } else if (player && !player.alive) {
    run.ended = "death";
    run.deathTick = state.currentTick;
  }
}

/** An aid that stops the kill counting, and the tick it was first seen. */
export function noteAid(run, reason) {
  if (!run.assisted.has(reason)) run.aids[reason] = run.lastTick;
  run.assisted.add(reason);
}

/** The tasks a clean kill completes that `completed` (a Set of task keys) does not hold yet. */
export function judgeKill(run, achievements, progress, completed) {
  if (run.ended !== "kill" || run.assisted.size > 0 || !achievements) return [];
  return achievements.tasks.filter((task) => task.check && !completed.has(taskKey(run.kind, task)) && task.check(run, progress));
}

/**
 * The tasks this fight can no longer complete that were not told yet, as
 * { task, reason, repeat }: a task's `failed(run)` gives why it failed (the
 * reason the chat line tells), or nothing while it can still be met; a task
 * without one, a kill count, cannot fail in a fight. `repeat` is a task the
 * player has completed before (`completed`, a Set of task keys). None once
 * the player has died. Marks them told.
 */
export function newlyFailed(run, achievements, completed) {
  if (!achievements || run.ended === "death") return [];
  const failures = [];
  for (const task of achievements.tasks) {
    if (!task.failed || run.reported.has(task.id)) continue;
    const reason = task.failed(run);
    if (!reason) continue;
    run.reported.add(task.id);
    run.failures[task.id] = { reason: String(reason), tick: run.lastTick };
    failures.push({ task, reason: String(reason), repeat: completed.has(taskKey(run.kind, task)) });
  }
  return failures;
}

/** The aids of this fight that were not told yet; marks them told. */
export function newlyAssisted(run) {
  const told = [...run.assisted].filter((reason) => !run.reported.has("aid:" + reason));
  for (const reason of told) run.reported.add("aid:" + reason);
  return told;
}

/**
 * How the boss's tasks went in `run`, for the victory screen: { chosen, notCounted, rows }.
 * - `notCounted`: { reasons, tick } when an aid stopped the kill counting (the aids in the order they were seen,
 *   and the tick of the first), or null.
 * - `rows`, in the boss's order, each { task, status, reason?, tick? }. With tasks chosen to go for
 *   (`selectedIds`; `chosen` true), each of them: "completed" (a clean kill met it, on the kill's tick), "failed"
 *   (its own failure, why and when; the player's death; or the kill not counting), "not completed" (a kill that
 *   did not meet it, nothing having failed it: a kill count still short), or "in progress" while the fight runs.
 *   With none chosen, every task the fight completed or failed on its own, and no other.
 * `progress` is the kills of the boss ({ kills, streak }).
 */
export function runSummary(run, achievements, selectedIds, progress = run?.progress ?? { kills: 0, streak: 0 }) {
  if (!run || !achievements) return { chosen: false, notCounted: null, rows: [] };
  const seen = Object.entries(run.aids).sort((a, b) => a[1] - b[1]);
  const notCounted =
    run.assisted.size > 0
      ? { reasons: [...seen.map(([reason]) => reason), ...[...run.assisted].filter((reason) => !(reason in run.aids))], tick: seen[0]?.[1] ?? run.startTick }
      : null;
  const selected = new Set(selectedIds);
  const chosen = achievements.tasks.some((task) => task.check && selected.has(task.id));
  const clean = run.ended === "kill" && !notCounted;
  const rows = [];
  for (const task of achievements.tasks) {
    if (!task.check) continue; // not tracked
    const failure = run.failures[task.id];
    if (!chosen) {
      if (failure) rows.push({ task, status: "failed", reason: failure.reason, tick: failure.tick });
      else if (clean && task.check(run, progress)) rows.push({ task, status: "completed", tick: run.killTick });
      continue;
    }
    if (!selected.has(task.id)) continue;
    if (failure) rows.push({ task, status: "failed", reason: failure.reason, tick: failure.tick });
    else if (run.ended === "death") rows.push({ task, status: "failed", reason: "You died.", tick: run.deathTick });
    else if (run.ended !== "kill") rows.push({ task, status: "in progress" });
    else if (notCounted) rows.push({ task, status: "failed", reason: "The kill did not count.", tick: notCounted.tick });
    else if (task.check(run, progress)) rows.push({ task, status: "completed", tick: run.killTick });
    else {
      const target = task.target?.(progress);
      rows.push({ task, status: "not completed", reason: target ? target.current + "/" + target.of + " so far." : "Its requirement was not met." });
    }
  }
  return { chosen, notCounted, rows };
}
