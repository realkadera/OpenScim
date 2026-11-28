// Combat achievements' lines in the chat box: a task completed, a task
// failed, as the game words them, and this client's own line of a kill that
// will not count. The chat box shows the messages the
// fight recorded (assets/Grid.js, its ChatLogProjection); these are not the
// fight's, so they are kept here, for the fight on screen, and merged into
// what the chat box shows by their tick (mergeChatMessages). They are not in
// a replay's recording. A new fight clears them, as it clears the chat.
import { tierPoints } from "./runs.js";

let messages = [];
let serial = 0;
const listeners = new Set();
const publish = () => listeners.forEach((listener) => listener());

export function subscribeToChat(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export const getChatMessages = () => messages;

export function clearChat() {
  if (!messages.length) return;
  messages = [];
  publish();
}

function add(tick, segments) {
  messages = [...messages, { key: "combat-achievements-" + ++serial, tick, kind: "game", segments }].slice(-100);
  publish();
}

// OBS (rsprox, recorded game messages in MRobertEvers/oldschool-clientc,
// docs/rsprox-analysis): a task's name is in <col=0cc919> in both lines, the
// rest in the chat's own colour:
//   "Congratulations, you've completed a master combat task: <col=0cc919>Anvil No More</col> (5 points)."
//   "You have failed <col=0cc919>Perfect Het</col>: Z-Kris was hit by a light beam."
// and tasks failed together are named in one line, " / " between them
// ("You have failed Perfect Verzik / Pop It: ...").
const taskColor = "#0cc919";
// The game's red of a notice (OBS (rsprox): "<col=ef1020>Untradeable drop: ..."), for this client's own line.
const red = "#ef1020";

export function tellCompleted(task, tick) {
  const points = tierPoints[task.tier];
  add(tick, [
    { text: `Congratulations, you've completed ${/^[aeiou]/.test(task.tier) ? "an" : "a"} ${task.tier} combat task: ` },
    { text: task.name, color: taskColor },
    // inferred: " (1 point)." for an easy task; only plural points are recorded.
    { text: ` (${points} point${points === 1 ? "" : "s"}).` },
  ]);
}

/** Tasks failed on one tick, [{ task, reason }]: a line for each reason, its tasks named together. */
export function tellFailed(failures, tick) {
  const byReason = new Map();
  for (const { task, reason } of failures) byReason.set(reason, [...(byReason.get(reason) ?? []), task]);
  for (const [reason, tasks] of byReason) {
    const names = tasks.flatMap((task, n) => [...(n ? [{ text: " / " }] : []), { text: task.name, color: taskColor }]);
    add(tick, [{ text: "You have failed " }, ...names, { text: ": " + reason }]);
  }
}

export function tellAssisted(reasons, tick) {
  add(tick, [{ text: `This kill won't count for combat achievements: ${reasons.join(", ")}.`, color: red }]);
}

/**
 * The chat box's messages with these merged in: each after the fight's
 * messages of its tick, in the order they came. `recorded` is what the chat
 * box would show ({ key, tick, ... }, oldest first); at most the last 100.
 */
export function mergeChatMessages(recorded, extra = messages) {
  if (!extra.length) return recorded;
  const merged = [];
  let i = 0;
  for (const message of recorded) {
    while (i < extra.length && extra[i].tick < message.tick) merged.push(extra[i++]);
    merged.push(message);
  }
  while (i < extra.length) merged.push(extra[i++]);
  return merged.slice(-100);
}
