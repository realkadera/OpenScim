// For each boss here with combat achievements (client/combatAchievements/bosses.js): how many of its wiki tasks are
// tracked, by its own judges or the shared ones (judges.js), and which are not yet. It fails when a boss's own judge
// names a task the wiki does not have (a typo, or a task the wiki renamed: run tools/fetch-combat-achievements.mjs),
// when bosses.js names a monster the wiki has no task of, or a kind that is not an encounter, or when the client's
// tasks.js is not the tasks of bosses.js's monsters in tools/combat-achievements/tasks.json (a boss added without
// running tools/fetch-combat-achievements.mjs --offline).
//
//   node tools/check-combat-achievements.mjs           the counts, and the tasks not tracked
//   node tools/check-combat-achievements.mjs <kind>    the same for one boss
import { readFile } from "node:fs/promises";
import { loadEnvironment } from "./determinism/harness.mjs";

await loadEnvironment(); // its module hooks resolve the client's web-root imports
const { combatAchievementBosses } = await import("../client/combatAchievements/bosses.js");
const { combatAchievementTasks } = await import("../client/combatAchievements/tasks.js");
const { getCombatAchievements } = await import("../client/combatAchievements/tracker.js");
const { encounterRegistry } = await import("../client/encounters/registry.js");

const only = process.argv[2];
const problems = [];
const allTasks = JSON.parse(await readFile(new URL("./combat-achievements/tasks.json", import.meta.url), "utf8"));
const bossMonsters = new Set(combatAchievementBosses.map((boss) => boss.monster));
const expected = allTasks.filter((task) => bossMonsters.has(task.monster));
if (JSON.stringify(expected) !== JSON.stringify(combatAchievementTasks))
  problems.push("client/combatAchievements/tasks.js is not the tasks of bosses.js's monsters: run node tools/fetch-combat-achievements.mjs --offline");
let tracked = 0;
let total = 0;
for (const boss of combatAchievementBosses) {
  if (only && !boss.kinds.includes(only)) continue;
  for (const kind of boss.kinds) if (!encounterRegistry.isRegistered(kind)) problems.push(`${boss.monster}: ${kind} is not an encounter`);
  const achievements = getCombatAchievements(boss.kinds[0]);
  if (!achievements?.tasks.length) {
    problems.push(`${boss.monster}: the wiki has no task of this monster`);
    continue;
  }
  const names = new Set(achievements.tasks.map((task) => task.name));
  const own = encounterRegistry.getDescriptorOfKindOrVariant(boss.kinds[0])?.combatAchievements?.judges ?? {};
  for (const name of Object.keys(own)) if (!names.has(name)) problems.push(`${boss.monster}: its judge of "${name}" is of no task of the wiki's`);
  const untracked = achievements.tasks.filter((task) => !task.tracked);
  tracked += achievements.tasks.length - untracked.length;
  total += achievements.tasks.length;
  const note = boss.shared === false ? " (a part of the whole: only its own judges)" : "";
  console.log(`${boss.monster}: ${achievements.tasks.length - untracked.length} of ${achievements.tasks.length} tracked${note}`);
  for (const task of untracked) console.log(`  not tracked: ${task.name} (${task.type}): ${task.description}`);
}
const monsters = new Set(allTasks.map((task) => task.monster));
console.log(`${tracked} of ${total} tasks tracked, of ${combatAchievementBosses.length} bosses; the wiki has tasks of ${monsters.size} monsters.`);
for (const problem of problems) console.error("problem: " + problem);
if (problems.length) process.exit(1);
