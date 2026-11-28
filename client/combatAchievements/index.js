// Combat achievements in the application: one store of the player's progress
// (store.js, in this browser), one tracker reading the live fight
// (tracker.js), the side panel's tab (panel.js, mounted by assets/Grid.js),
// the notice of a task completed and the lines in the chat (chat.js): a task
// completed, a task failed (when the setting is on), a kill that won't count.
// assets/application.js hands it the engine and each tick the game loop
// publishes; replays publish none, so a replay never counts.
import { createCombatAchievementsStore } from "./store.js";
import { createCombatAchievementsTracker, getCombatAchievements, runSummary, tierPoints, tierOrder } from "./tracker.js";
import { clearChat, tellCompleted, tellFailed, tellAssisted } from "./chat.js";

export const combatAchievementsStore = createCombatAchievementsStore(globalThis.localStorage);

const runListeners = new Set();
export function subscribeToRun(listener) {
  runListeners.add(listener);
  return () => runListeners.delete(listener);
}

const tracker = createCombatAchievementsTracker({
  store: combatAchievementsStore,
  onComplete: (kind, tasks, tick) =>
    tasks.forEach((task, n) => {
      tellCompleted(task, tick);
      setTimeout(() => showCompleted(task), n * 2600);
    }),
  onFail: (kind, failures, tick) => {
    // A task chosen to go for (the setup's list) is always told; the others as the settings say.
    const { settings } = combatAchievementsStore.getState();
    const chosen = new Set(combatAchievementsStore.selectedFor(kind));
    const told = failures.filter((failure) => chosen.has(failure.task.id) || (failure.repeat ? settings.repeatFailureMessages : settings.failureMessages));
    if (told.length) tellFailed(told, tick);
  },
  onAssisted: (reasons, tick) => tellAssisted(reasons, tick),
  onRunStart: () => clearChat(),
  onRunChange: (run) => runListeners.forEach((listener) => listener(run)),
});

// The engine of the live fight (application.js).
let getEngine = () => null;
export function setCombatAchievementsEngine(source) {
  getEngine = source;
}
export const getCombatAchievementsEngine = () => getEngine();
export const currentRun = () => tracker.currentRun();
export { getCombatAchievements, tierOrder, tierPoints };

/** How the boss's tasks went in the current fight (runs.js, runSummary), for the victory screen; null for a boss without them. */
export function currentResults() {
  const run = tracker.currentRun();
  const achievements = run && getCombatAchievements(run.kind);
  if (!achievements) return null;
  return runSummary(run, achievements, combatAchievementsStore.selectedFor(run.kind));
}
export const currentStreak = () => tracker.streak();
export const currentTaskStreaks = () => tracker.taskStreaks();

/** After each tick of the live fight, with that tick's events. */
export function observeCombatAchievements(events) {
  tracker.observe(getEngine(), events ?? []);
}

// The notice of a task completed: the game's "Combat Task Completed!" over the
// scene, a few seconds (inferred: the game's pop-up is not timed here).
const noticeStyle = `
.ca-notice { position: fixed; left: 50%; top: 56px; transform: translateX(-50%); z-index: 40; pointer-events: none;
  min-width: 260px; max-width: calc(100vw - 32px); box-sizing: border-box; padding: 8px 14px; text-align: center;
  background: var(--color-bg-solid, #1e1812); border: 1px solid var(--color-border, #5a4a2c); border-radius: 2px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.5); font: 16px/1.2 "RuneScape Plain 12", sans-serif; text-shadow: 1px 1px #000;
  animation: ca-notice 4s ease-out forwards; }
.ca-notice__title { color: #ff981f; font-family: "RuneScape Bold 12", "RuneScape Plain 12", sans-serif; }
.ca-notice__task { color: #ffffff; margin-top: 2px; }
.ca-notice__tier { color: var(--color-text-body, #cec0a3); }
@keyframes ca-notice { 0% { opacity: 0; transform: translate(-50%, -6px); } 8%, 85% { opacity: 1; transform: translate(-50%, 0); } 100% { opacity: 0; } }
`;
function ensureStyle(id, css) {
  if (typeof document === "undefined" || document.getElementById(id)) return;
  const style = document.createElement("style");
  style.id = id;
  style.textContent = css;
  document.head.append(style);
}
export const tierLabel = (tier) => tier[0].toUpperCase() + tier.slice(1);

function showCompleted(task) {
  if (typeof document === "undefined") return;
  ensureStyle("ca-notice-style", noticeStyle);
  const notice = document.createElement("div");
  notice.className = "ca-notice";
  notice.setAttribute("role", "status");
  const title = document.createElement("div");
  title.className = "ca-notice__title";
  title.textContent = "Combat Task Completed!";
  const name = document.createElement("div");
  name.className = "ca-notice__task";
  name.textContent = task.name;
  const tier = document.createElement("div");
  tier.className = "ca-notice__tier";
  const points = tierPoints[task.tier];
  tier.textContent = `${tierLabel(task.tier)} task, ${points} point${points === 1 ? "" : "s"}`;
  notice.append(title, name, tier);
  document.body.append(notice);
  setTimeout(() => notice.remove(), 4200);
}

export { ensureStyle };
