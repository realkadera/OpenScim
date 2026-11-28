// The Maggot King's own judges of his combat achievements (his descriptor's `combatAchievements`,
// client/combatAchievements/tracker.js). His 9 tasks are the wiki's (client/combatAchievements/tasks.js); the kill
// counts and the twelve without leaving are judged by the shared judges, Digging in here. Not tracked yet: Trying to
// fit in (Vampyrium's weapons), King-sized clobbering (his melee punish), Cordoned Off (the back row), Perfect Maggot
// King (the falling bile, "even if no damage is registered", and his healing) and the speed task (the first 5 kills
// of a visit).
// - Digging in: no more than 40 tiles moved (WIKI), each tick's step counted by its longer side, so a run's two
//   tiles a tick are two.
import { unless } from "../../combatAchievements/judges.js";

const mostTiles = 40; // WIKI: Digging in

export const maggotKingCombatAchievements = {
  judges: {
    "Digging in": unless((run) => run.tilesMoved > mostTiles, "You moved more than 40 tiles."),
  },
};
