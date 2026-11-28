// Phosani's Nightmare's own judges of her combat achievements (her descriptor's `combatAchievements`,
// client/combatAchievements/tracker.js). Her 10 tasks are the wiki's (client/combatAchievements/tasks.js); the kill
// counts, the speed tasks and the five in a row are judged by the shared judges, Dreamland Express here. Not tracked
// yet: Crush Hour (each husk and parasite killed in one hit), I Would Simply React (her disabling the prayers) and
// Perfect Phosani's Nightmare (the spores' slowing, and the weakened parasites' hits told from the others').
// - Dreamland Express: no sleepwalker reaching her in her desperation phase (WIKI: "and damaging the player"), the
//   hit minions.js names "Sleepwalker", which only a sleepwalker absorbed in the desperation phase deals.
import { hitsFrom, unless } from "../../combatAchievements/judges.js";

export const phosanisNightmareCombatAchievements = {
  judges: {
    "Dreamland Express": unless((run) => hitsFrom(run, "Sleepwalker") > 0, "A sleepwalker reached Phosani's Nightmare."),
  },
};
