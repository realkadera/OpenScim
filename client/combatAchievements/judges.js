// The judging of combat achievement tasks: a helper kit for a boss's own judges
// (client/encounters/<boss>/combatAchievements.js), and the shared judges that read a task's description when it
// is worded as many bosses' are (WIKI: Combat Achievements/All tasks). A task whose description is worded otherwise
// is not judged by them: it waits for its boss's own judge, and until then is listed as not tracked.
//
// A judge is { check(run, progress), failed?(run), target?(progress) } (tracker.js says what each is given).
// This module imports runs.js only, so a boss's task file can use it without an import cycle.
import { ticksUnder, killTicks, elapsedTicks, tickSeconds } from "./runs.js";

export { hitsFrom, hitsExcept } from "./runs.js";

/** A kill-count task: `n` kills that counted, this one included. */
export const kills = (n) => ({
  check: (run, progress) => progress.kills >= n,
  target: (progress) => ({ current: Math.min(progress.kills, n), of: n }),
});

/** A kill on the awakened kind (`kind`): one that counted. */
export const awakenedKill = (kind) => ({ check: (run) => run.variant === kind });

/** A stamina task: `n` kills in a row without leaving or dying. */
export const inARow = (n) => ({
  check: (run, progress) => progress.streak >= n,
  target: (progress) => ({ current: Math.min(progress.streak, n), of: n }),
});

/** A speed task, "less than" `seconds`: met by a kill under the time, failed as the fight runs past it. */
export const under = (seconds, monster) => within(ticksUnder(seconds), monster);
/** A speed task, "within" `seconds`: the time itself is in. inferred: the wiki does not say whether "within" is. */
export const upTo = (seconds, monster) => within(Math.floor(seconds / tickSeconds + 1e-9), monster);
const within = (ticks, monster) => ({
  check: (run) => killTicks(run) <= ticks,
  failed: (run) => elapsedTicks(run) > ticks && `You did not kill ${monster} in time.`,
});

/** A task that holds unless something happens: met while it has not, failed once it has. */
export const unless = (happened, reason) => ({ check: (run) => !happened(run), failed: (run) => happened(run) && reason });

/**
 * A task of `n` kills in a row, each without something happening ("Kill Vorkath 5 times without taking any damage
 * from his special attacks and without leaving his area"): failed in a fight once it has happened, and its count
 * starts again. The tracker keeps the count (`progress.taskStreaks`), by the kills that met `each`.
 */
export const inARowUnless = (n, happened, reason) => ({ each: (run) => !happened(run), times: n, failed: (run) => happened(run) && reason });

/**
 * A task of `n` kills in one visit, each without something happening ("Kill Vardorvis perfectly 5 times without
 * leaving"): a kill that misses it does not count, and the count goes on (WIKI, its task pages: "you must simply
 * achieve 5 perfect kills in a single instance, rather than having to do so 5 kills in a row").
 */
export const inOneVisitUnless = (n, happened, reason) => ({ ...inARowUnless(n, happened, reason), keepOnMiss: true });

/** "Kill the Alchemical Hydra without taking any damage." */
export const noDamage = () => unless((run) => run.damageTaken > 0, "You took damage.");

// A description's time: "54 seconds", "1 minute and 15 seconds", "1 minute 45 seconds", "7 minutes", "1:50",
// "1:00 minutes".
const timePattern = /(\d+):(\d\d)(?: minutes?)?|(\d+) minutes?(?:,? (?:and )?(\d+) seconds?)?|(\d+) seconds?/;
function seconds(match) {
  if (match[1] !== undefined) return Number(match[1]) * 60 + Number(match[2]);
  if (match[3] !== undefined) return Number(match[3]) * 60 + Number(match[4] ?? 0);
  return Number(match[5]);
}
const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The shared judge of `task` (tasks.js) for `boss` (bosses.js), or null when its description is not worded as
 * one of these:
 * - "Kill [the] <monster>." / "... once." / "... <n> times.": kills that counted (Kill Count);
 * - "Kill [the] Awakened <monster>.": a kill of the awakened kind;
 * - "Kill [the] <monster> <n> times [in a row] without leaving[ ...].": kills in a row (Stamina);
 * - "Kill [the] <monster> in less than <time>[ without a slayer task].", "... within <time>.": the kill's time.
 *   There are no slayer tasks here, so every kill is one without (Speed);
 * - "Kill [the] <monster> without taking any damage." (Perfection).
 * "Defeat" is read as "Kill". The monster's name is the task's own, as the wiki writes it.
 */
export function sharedJudge(task, boss) {
  const name = `(?:the )?${escape(task.monster)}`;
  const say = task.description.replace(/^Defeat /, "Kill ");
  const is = (rest) => new RegExp(`^Kill ${rest}$`, "i").exec(say);
  let match;
  if ((match = is(`${name}(?: once| (\\d+) times)?\\.`))) return kills(Number(match[1] ?? 1));
  if (boss.awakened && is(`(?:the )?Awakened ${escape(task.monster)}\\.`)) return awakenedKill(boss.awakened);
  if ((match = is(`${name} (\\d+) times(?: in a row)? without leaving(?: [^.]+)?\\.`))) return inARow(Number(match[1]));
  if ((match = is(`${name} (in less than|within) (.+?)(?: without a slayer task)?\\.`))) {
    const time = new RegExp(`^(?:${timePattern.source})$`).exec(match[2]);
    if (!time) return null;
    const monster = /^the /i.test(task.description.split(" ").slice(1).join(" ")) ? "the " + task.monster : task.monster;
    return match[1] === "within" ? upTo(seconds(time), monster) : under(seconds(time), monster);
  }
  if (is(`${name} without taking any damage\\.`)) return noDamage();
  return null;
}
