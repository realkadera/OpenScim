// Which of the wiki's monsters (tasks.js, `monster`) each encounter here is, so its tasks are listed with it.
// - `kinds`: the encounter kinds that are this monster; the first is the one the player's progress is kept under
//   (completed tasks, the kills that counted, the tasks chosen), so a variant's kills count with the boss's.
// - `awakened`: the kind that a task of "Awakened <monster>" asks for.
// - `shared`: false where the encounter is only part of what the tasks ask (one phase, one wave): its tasks are
//   listed, and none is judged by the shared rules (judges.js), so a practice of a part never counts as the whole.
// A boss's own judges of its tasks are its descriptor's `combatAchievements` (tracker.js).
// inferred: a variant's kills count with the boss's, as the wiki's kill counts do not tell the two apart.
export const combatAchievementBosses = [
  { monster: "Alchemical Hydra", kinds: ["alchemical_hydra"] },
  { monster: "Araxxor", kinds: ["araxxor"] },
  { monster: "Corrupted Hunllef", kinds: ["corrupted_hunllef"] },
  { monster: "Doom of Mokhaiotl", kinds: ["doom_of_mokhaiotl", "doom_of_mokhaiotl_deep"] },
  { monster: "Duke Sucellus", kinds: ["duke_sucellus", "duke_sucellus_awakened"], awakened: "duke_sucellus_awakened" },
  { monster: "Leviathan", kinds: ["leviathan", "leviathan_awakened"], awakened: "leviathan_awakened" },
  { monster: "Maggot King", kinds: ["maggot_king"] },
  { monster: "Phosani's Nightmare", kinds: ["phosanis_nightmare"] },
  { monster: "Vardorvis", kinds: ["vardorvis", "vardorvis_awakened"], awakened: "vardorvis_awakened" },
  { monster: "Vorkath", kinds: ["vorkath"] },
  // Parts of a whole: Yama's third phase, the Colosseum's last wave, the Inferno as built here.
  { monster: "Yama", kinds: ["yama_p3", "yama_p3_forfeit_breath", "yama_p3_glyphic", "yama_p3_sensory", "yama_p3_divine", "yama_p3_bloodied"], shared: false },
  { monster: "Fortis Colosseum", kinds: ["colosseum", "sol_heredit"], shared: false },
  { monster: "TzKal-Zuk", kinds: ["inferno"], shared: false },
];

/** The boss of an encounter kind, or null. */
export const bossOfKind = (kind) => combatAchievementBosses.find((boss) => boss.kinds.includes(kind)) ?? null;
