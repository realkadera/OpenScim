// Every combat achievement task, as the OSRS Wiki keeps them (its `combat_achievement` bucket, the data behind
// WIKI: Combat Achievements/All tasks): the game's id, name, monster, description, tier and type. It writes them all
// to tools/combat-achievements/tasks.json, and to client/combatAchievements/tasks.js the tasks of the bosses
// client/combatAchievements/bosses.js names, so the application carries only those. Run it again when the wiki
// changes (the diff shows the tasks added, renamed or reworded), and with --offline when bosses.js gains a boss:
// that writes the client's file again from tasks.json, without the wiki.
//
//   node tools/fetch-combat-achievements.mjs
//   node tools/fetch-combat-achievements.mjs --offline
import { readFile, writeFile } from "node:fs/promises";
import { combatAchievementBosses } from "../client/combatAchievements/bosses.js";

const all = new URL("./combat-achievements/tasks.json", import.meta.url);
const out = new URL("../client/combatAchievements/tasks.js", import.meta.url);
const offline = process.argv.includes("--offline");
const query = 'bucket("combat_achievement").select("id","name","monster","task","tier","type").limit(5000).run()';
const url = "https://oldschool.runescape.wiki/api.php?action=bucket&format=json&query=" + encodeURIComponent(query);

// The wiki's markup in a description (a "sic" note, a link) is left out: only its text is kept.
const plain = (text) =>
  String(text)
    .replace(/<sup[\s\S]*?<\/sup>/g, "")
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&#91;|&#93;/g, "")
    .replace(/\s+/g, " ")
    .trim();

async function fromWiki() {
  const response = await fetch(url, { headers: { "User-Agent": "openscim-combat-achievements-fetch" } });
  if (!response.ok) throw new Error(`the wiki answered ${response.status}`);
  const rows = (await response.json()).bucket;
  if (!Array.isArray(rows) || rows.length < 100) throw new Error("the wiki gave no task list");
  return rows
    .map((row) => ({
      gameId: Number(row.id),
      name: plain(row.name),
      monster: plain(row.monster),
      description: plain(row.task),
      tier: String(row.tier).toLowerCase(),
      type: plain(row.type),
    }))
    .sort((a, b) => a.gameId - b.gameId);
}

const tasks = offline ? JSON.parse(await readFile(all, "utf8")) : await fromWiki();
if (!offline) await writeFile(all, "[\n" + tasks.map((task) => "  " + JSON.stringify(task)).join(",\n") + "\n]\n");

const monsters = new Set(combatAchievementBosses.map((boss) => boss.monster));
const ours = tasks.filter((task) => monsters.has(task.monster));
const header = [
  "// The combat achievement tasks of the bosses client/combatAchievements/bosses.js names (WIKI: Combat",
  "// Achievements/All tasks, its `combat_achievement` bucket), written by tools/fetch-combat-achievements.mjs from",
  `// tools/combat-achievements/tasks.json, which has every task: do not edit by hand. ${ours.length} of ${tasks.length} tasks.`,
];
await writeFile(out, [...header, "export const combatAchievementTasks = [", ...ours.map((task) => "  " + JSON.stringify(task) + ","), "];", ""].join("\n"));
console.log(
  `${tasks.length} tasks${offline ? " read from" : " written to"} tools/combat-achievements/tasks.json; ` +
    `${ours.length} of them, of ${monsters.size} bosses, to client/combatAchievements/tasks.js`,
);
